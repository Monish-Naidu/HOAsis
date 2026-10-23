-- Form files.
--
-- The settings form upload has kept a row since 0018 and nothing has ever
-- written the file: a board uploaded a form, the row remembered its name and
-- size, and the bytes went nowhere. This gives the bytes somewhere to live
-- and lets the people the form is for open it.
--
-- Files live in the private documents bucket (0016) under a forms folder:
-- {association}/forms/{form id}.{ext}. The board writes them with the
-- settings capability the forms table already requires; every member of the
-- association reads one through its row, the same rule the table applies.

alter table forms add column if not exists storage_path text;

-- Reading: the board reaches its own folder outright (0017), now through the
-- settings capability too, and a member reaches a form's file through its
-- row, the same rule the forms table applies.
drop policy "document files follow the row's visibility" on storage.objects;
create policy "document files follow the row's visibility"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (
      has_capability((storage.foldername(name))[1]::uuid, 'documents')
      or has_capability((storage.foldername(name))[1]::uuid, 'settings')
      or exists (
        select 1 from public.documents d
        where d.storage_path = storage.objects.name
          and d.visibility in ('public', 'owners')
          and is_member_of(d.association_id)
      )
      or exists (
        select 1 from public.forms f
        where f.storage_path = storage.objects.name
          and is_member_of(f.association_id)
      )
    )
  );

-- Writing: the settings capability, scoped to the forms folder, so managing
-- forms cannot put a file where a document lives or take one away.
create policy "settings holders upload their association's forms"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'forms'
    and has_capability((storage.foldername(name))[1]::uuid, 'settings')
  );

create policy "settings holders replace their association's forms"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'forms'
    and has_capability((storage.foldername(name))[1]::uuid, 'settings')
  );

create policy "settings holders remove their association's forms"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'forms'
    and has_capability((storage.foldername(name))[1]::uuid, 'settings')
  );
