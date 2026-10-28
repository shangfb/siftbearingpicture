-- Read-only checks. Run after migration; no secrets are returned.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('sift_products','sift_product_images');
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where tablename in ('sift_products','sift_product_images')
   or (schemaname='storage' and policyname like 'sift_%')
order by schemaname, tablename, policyname;
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='sift-product-images';
select count(*) as administrator_count from sift_private.administrators;
-- Initially zero. After explicit enrollment, expect one.
