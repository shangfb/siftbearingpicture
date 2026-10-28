-- Run AFTER 202610270001. Adds an atomic product + image metadata save.
begin;
create function public.sift_save_product(p_product jsonb, p_images jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  target uuid := (p_product->>'id')::uuid;
  image_count integer;
begin
  if not public.sift_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform 1 from public.sift_products where id = target for update;
  if not found then raise exception 'Product not found'; end if;
  if jsonb_typeof(p_images) is distinct from 'array' then
    raise exception 'Image array required';
  end if;
  image_count := jsonb_array_length(p_images);
  if image_count > 30 then raise exception 'Maximum 30 images per product'; end if;
  if p_product->>'status' = 'published' and image_count = 0 then
    raise exception 'At least one image required to publish';
  end if;
  -- Every metadata entry must refer to an actual stored object in this product folder.
  if exists (
    select 1 from jsonb_array_elements(p_images) i
    where not exists (
      select 1 from storage.objects o where o.bucket_id = 'sift-product-images'
        and o.name = i->>'object_path'
        and split_part(o.name, '/', 1) = target::text
    )
  ) then raise exception 'Image object missing or belongs to another product'; end if;

  delete from public.sift_product_images where product_id = target;
  insert into public.sift_product_images(id, product_id, object_path, position, alt_en, alt_es)
  select (i->>'id')::uuid, target, i->>'object_path', (n-1)::integer,
    coalesce(i->>'alt_en',''), coalesce(i->>'alt_es','')
  from jsonb_array_elements(p_images) with ordinality entries(i,n);

  update public.sift_products set
    brand = btrim(p_product->>'brand'), model = btrim(p_product->>'model'),
    bearing_type = coalesce(p_product->>'bearing_type',''),
    description_en = coalesce(p_product->>'description_en',''),
    description_es = coalesce(p_product->>'description_es',''),
    status = p_product->>'status'
  where id = target;
  return target;
end;
$$;
revoke all on function public.sift_save_product(jsonb,jsonb) from public;
grant execute on function public.sift_save_product(jsonb,jsonb) to authenticated;
commit;
