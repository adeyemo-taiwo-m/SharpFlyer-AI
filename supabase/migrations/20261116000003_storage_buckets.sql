-- Step 3.4: Private storage buckets (`uploads` and `renders`) and RLS policies
-- Invariant 8 & Section 12: Both buckets are private; downloads use short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads', 'uploads', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('renders', 'renders', false, 20971520, array['image/png', 'image/jpeg'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users may only access objects under their own `<user_id>/...` folder in `uploads` and `renders`
create policy "uploads_select_own_folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "renders_select_own_folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'renders' and (storage.foldername(name))[1] = auth.uid()::text);
