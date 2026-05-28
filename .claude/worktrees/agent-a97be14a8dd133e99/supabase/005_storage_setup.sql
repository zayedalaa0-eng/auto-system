insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-attachments',
  'customer-attachments',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "customer_attachments_bucket_select_authenticated" on storage.objects;
create policy "customer_attachments_bucket_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-attachments'
);

drop policy if exists "customer_attachments_bucket_insert_authenticated" on storage.objects;
create policy "customer_attachments_bucket_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'customer-attachments'
);

drop policy if exists "customer_attachments_bucket_update_authenticated" on storage.objects;
create policy "customer_attachments_bucket_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'customer-attachments'
)
with check (
  bucket_id = 'customer-attachments'
);

drop policy if exists "customer_attachments_bucket_delete_manager_only" on storage.objects;
create policy "customer_attachments_bucket_delete_manager_only"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-attachments'
  and public.is_manager()
);
