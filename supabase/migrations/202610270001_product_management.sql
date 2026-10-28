-- SIFT: product management foundation. Run once via Supabase SQL Editor.
-- No destructive DROP/TRUNCATE and no automatic administrator enrollment.
begin;

create schema if not exists sift_private;
revoke all on schema sift_private from public, anon, authenticated;

create table sift_private.administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table sift_private.administrators enable row level security;
revoke all on sift_private.administrators from public, anon, authenticated;

-- Only returns a boolean about the caller; never accepts a target user ID.
create function public.sift_is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from sift_private.administrators a
    where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.sift_is_admin() from public;
grant execute on function public.sift_is_admin() to anon, authenticated;

create table public.sift_products (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand = btrim(brand) and length(brand) between 1 and 80),
  model text not null check (model = btrim(model) and length(model) between 1 and 150),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 220),
  bearing_type text not null default '',
  description_en text not null default '',
  description_es text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sift_products_brand_model_unique
  on public.sift_products (lower(brand), lower(model));
create index sift_products_status_idx on public.sift_products(status);

-- Position zero is the cover. Each product may have one image at each position.
-- Objects are immutable UUID names, never customer folder names.
create table public.sift_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.sift_products(id) on delete cascade,
  object_path text not null unique,
  position integer not null check (position >= 0),
  alt_en text not null default '',
  alt_es text not null default '',
  created_at timestamptz not null default now(),
  constraint sift_image_object_path check (
    object_path ~ ('^' || product_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
  ),
  constraint sift_image_position_unique unique(product_id, position)
    deferrable initially immediate
);

create function sift_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function sift_private.touch_updated_at() from public;
create trigger sift_product_touch before update on public.sift_products
for each row execute function sift_private.touch_updated_at();

alter table public.sift_products enable row level security;
alter table public.sift_product_images enable row level security;
revoke all on public.sift_products, public.sift_product_images from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.sift_products, public.sift_product_images to anon, authenticated;
grant insert, update, delete on public.sift_products, public.sift_product_images to authenticated;

create policy sift_product_read on public.sift_products for select to anon, authenticated
using (status = 'published' or (select public.sift_is_admin()));
create policy sift_product_admin_write on public.sift_products for all to authenticated
using ((select public.sift_is_admin())) with check ((select public.sift_is_admin()));
create policy sift_image_read on public.sift_product_images for select to anon, authenticated
using (
  (select public.sift_is_admin()) or exists (
    select 1 from public.sift_products p
    where p.id = product_id and p.status = 'published'
  )
);
create policy sift_image_admin_write on public.sift_product_images for all to authenticated
using ((select public.sift_is_admin())) with check ((select public.sift_is_admin()));

-- Atomic admin operation, so partial image reordering cannot corrupt positions.
create function public.sift_reorder_product_images(p_product_id uuid, p_image_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare total integer;
begin
  if not public.sift_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform 1 from public.sift_products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  select count(*) into total from public.sift_product_images where product_id = p_product_id;
  if p_image_ids is null or cardinality(p_image_ids) <> total
     or (select count(distinct x) from unnest(p_image_ids) x) <> total
     or exists (select 1 from unnest(p_image_ids) x where not exists (
       select 1 from public.sift_product_images i where i.id = x and i.product_id = p_product_id
     )) then
    raise exception 'Provide every image ID exactly once';
  end if;
  set constraints public.sift_image_position_unique deferred;
  update public.sift_product_images i set position = ordered.n - 1
  from unnest(p_image_ids) with ordinality ordered(id, n)
  where i.id = ordered.id and i.product_id = p_product_id;
  set constraints public.sift_image_position_unique immediate;
end;
$$;
revoke all on function public.sift_reorder_product_images(uuid, uuid[]) from public;
grant execute on function public.sift_reorder_product_images(uuid, uuid[]) to authenticated;

-- PRIVATE original bucket. Public read requires a published image relationship.
-- Short-lived signed URLs will be generated by the application.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('sift-product-images', 'sift-product-images', false, 10485760,
        array['image/jpeg','image/png','image/webp']);

create policy sift_storage_read on storage.objects for select to anon, authenticated
using (bucket_id = 'sift-product-images' and (
  (select public.sift_is_admin()) or exists (
    select 1 from public.sift_product_images i
    join public.sift_products p on p.id = i.product_id
    where i.object_path = name and p.status = 'published'
  )
));
create policy sift_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'sift-product-images' and (select public.sift_is_admin())
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  and exists (select 1 from public.sift_products p where p.id::text = split_part(name, '/', 1))
);
-- No UPDATE policy: upload a new UUID object instead of overwriting existing files.
create policy sift_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'sift-product-images' and (select public.sift_is_admin()));

commit;
