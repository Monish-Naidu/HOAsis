-- Document files.
--
-- The documents table has carried a storage_path since 0005 and nothing has
-- ever written one: an upload kept the file's name and dropped its bytes. This
-- gives the bytes somewhere to live.
--
-- Private bucket. A file is opened through a signed link, and whether a person
-- may make that link is decided by reading the document's row, so Storage
-- applies exactly the visibility rule the table already applies. Public
-- records are still gated to members here; the public records page does not
-- exist yet, and when it does it will hand out links from the server.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  25 * 1024 * 1024,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Reading follows the row. The board reads everything; an owner reads what is
-- published to owners or to the public; a file with no row is unreachable,
-- which is what makes an orphaned upload harmless.
create policy "document files follow the row's visibility"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
        and (
          has_capability(d.association_id, 'documents')
          or (d.visibility in ('public', 'owners') and is_member_of(d.association_id))
        )
    )
  );

-- Writing is by capability, keyed on the first path segment, the same shape
-- the community photos use.
create policy "documents holders upload into their own association"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and has_capability((storage.foldername(name))[1]::uuid, 'documents')
  );

create policy "documents holders replace their own association's files"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and has_capability((storage.foldername(name))[1]::uuid, 'documents')
  );

create policy "documents holders remove their own association's files"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and has_capability((storage.foldername(name))[1]::uuid, 'documents')
  );
