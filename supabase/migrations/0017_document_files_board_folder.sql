-- The board can reach every file in its own folder, row or no row.
--
-- 0016 made a file readable only through its row. That meant that once the
-- row was deleted the file could not be deleted either: Storage looks an
-- object up before removing it, and the lookup came back empty, so the app's
-- delete left an orphan. The board now sees its own folder outright, which
-- makes removal work in either order and lets an orphan be cleaned up. Owners
-- and the public still go through the row, so nothing widens for them.

drop policy "document files follow the row's visibility" on storage.objects;

create policy "document files follow the row's visibility"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (
      has_capability((storage.foldername(name))[1]::uuid, 'documents')
      or exists (
        select 1 from public.documents d
        where d.storage_path = storage.objects.name
          and d.visibility in ('public', 'owners')
          and is_member_of(d.association_id)
      )
    )
  );
