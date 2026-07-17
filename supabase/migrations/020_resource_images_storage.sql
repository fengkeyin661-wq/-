-- 资源运营台图片：Supabase Storage 公开读、匿名可写（与 app_content 运营台模式一致）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resource-images',
  'resource-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resource_images_public_read" on storage.objects;
create policy "resource_images_public_read"
  on storage.objects for select
  using (bucket_id = 'resource-images');

drop policy if exists "resource_images_anon_insert" on storage.objects;
create policy "resource_images_anon_insert"
  on storage.objects for insert
  with check (bucket_id = 'resource-images');

drop policy if exists "resource_images_anon_update" on storage.objects;
create policy "resource_images_anon_update"
  on storage.objects for update
  using (bucket_id = 'resource-images')
  with check (bucket_id = 'resource-images');

drop policy if exists "resource_images_anon_delete" on storage.objects;
create policy "resource_images_anon_delete"
  on storage.objects for delete
  using (bucket_id = 'resource-images');
