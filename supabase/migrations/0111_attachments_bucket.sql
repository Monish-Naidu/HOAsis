-- 0111: a private bucket for the files on a request and the photos on a
-- notice.
--
-- A request's attachments were names and sizes (requests.attachments) and
-- a notice's photos were briefs with an optional src that nothing could
-- set. For most owners the photo of the problem is the request. The
-- `attachments` bucket holds the files, private, with the row's own
-- visibility applied to its folder:
--
--   {association_id}/requests/{request_id}/{file}
--   {association_id}/violations/{violation_id}/{file}
--
-- Who may read: whoever may read the row (the home's own people since they
-- owned it, or the board with the matching capability). Who may add: an
-- owner on their own request; the board on any request or notice. Nothing
-- is replaced or deleted by a person: a wrong photo is answered with
-- another, the way a wrong line is answered with a reversal. The row keeps
-- the path (requests.attachments[].path, violations.photos[].path) and the
-- app opens a short-lived signed link, as documents do.
--
-- Limits: 10 MB a file; images and PDFs only. A phone photo is 3 to 6 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Whether the caller may read the row a path belongs to. Mirrors
-- requests_read and violations_read (0089) so the file and the row agree.
create or replace function attachment_readable(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_assoc uuid;
  v_kind  text;
  v_row   uuid;
begin
  if array_length(v_parts, 1) < 3 then
    return false;
  end if;
  v_assoc := v_parts[1]::uuid;
  v_kind  := v_parts[2];
  v_row   := v_parts[3]::uuid;

  if v_kind = 'requests' then
    return exists (
      select 1 from requests r
      where r.id = v_row and r.association_id = v_assoc
        and (
          (r.unit_id in (select my_unit_ids()) and r.submitted_on >= unit_owned_since(r.unit_id))
          or has_capability(v_assoc, 'requests')
        )
    );
  elsif v_kind = 'violations' then
    return exists (
      select 1 from violations v
      where v.id = v_row and v.association_id = v_assoc
        and (
          (v.unit_id in (select my_unit_ids()) and v.opened_on >= unit_owned_since(v.unit_id))
          or has_capability(v_assoc, 'compliance')
        )
    );
  end if;
  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;

-- Whether the caller may add a file under a path: the board for either
-- kind, an owner for a request on their own home only.
create or replace function attachment_writable(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_assoc uuid;
  v_kind  text;
  v_row   uuid;
begin
  if array_length(v_parts, 1) < 3 then
    return false;
  end if;
  v_assoc := v_parts[1]::uuid;
  v_kind  := v_parts[2];
  v_row   := v_parts[3]::uuid;

  if not association_writable(v_assoc) and not (
    -- A locked board still lets an owner add to their own request.
    v_kind = 'requests' and exists (
      select 1 from requests r where r.id = v_row and r.unit_id in (select my_unit_ids())
    )
  ) then
    return false;
  end if;

  if v_kind = 'requests' then
    return exists (
      select 1 from requests r
      where r.id = v_row and r.association_id = v_assoc
        and (r.unit_id in (select my_unit_ids()) or has_capability(v_assoc, 'requests'))
    );
  elsif v_kind = 'violations' then
    return exists (
      select 1 from violations v
      where v.id = v_row and v.association_id = v_assoc and has_capability(v_assoc, 'compliance')
    );
  end if;
  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function attachment_readable(text) from public;
revoke all on function attachment_writable(text) from public;
grant execute on function attachment_readable(text) to authenticated;
grant execute on function attachment_writable(text) to authenticated;

drop policy if exists "attachments are read with their row" on storage.objects;
create policy "attachments are read with their row"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and attachment_readable(name));

drop policy if exists "attachments are added by the row's people" on storage.objects;
create policy "attachments are added by the row's people"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and attachment_writable(name));

-- The row learns about the file through a function, because an owner has
-- no update policy on requests (filing is their only write) and because
-- the path is checked once, here, against the row it names.
create or replace function add_request_attachment(p_request_id uuid, p_name text, p_size_bytes integer, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request requests%rowtype;
begin
  select * into v_request from requests where id = p_request_id;
  if not found then
    raise exception 'No such request' using errcode = 'P0002';
  end if;
  if p_path <> v_request.association_id || '/requests/' || v_request.id || '/' || (storage.filename(p_path)) then
    raise exception 'That file is not on this request' using errcode = '22023';
  end if;
  if not attachment_writable(p_path) then
    raise exception 'You cannot add a file to that request' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'attachments' and name = p_path) then
    raise exception 'The file has not been uploaded' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 or length(p_name) > 120 then
    raise exception 'Name the file, in 120 characters' using errcode = '22023';
  end if;

  update requests
     set attachments = attachments || jsonb_build_array(jsonb_build_object(
           'name', trim(p_name),
           'size', case
             when p_size_bytes >= 1048576 then round(p_size_bytes / 1048576.0, 1) || ' MB'
             else greatest(1, round(p_size_bytes / 1024.0)) || ' KB' end,
           'path', p_path,
           'addedOn', current_date
         ))
   where id = p_request_id;
end;
$$;

revoke all on function add_request_attachment(uuid, text, integer, text) from public;
grant execute on function add_request_attachment(uuid, text, integer, text) to authenticated;

create or replace function add_violation_photo(p_violation_id uuid, p_brief text, p_vantage text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_violation violations%rowtype;
  v_name text;
begin
  select * into v_violation from violations where id = p_violation_id;
  if not found then
    raise exception 'No such notice' using errcode = 'P0002';
  end if;
  if not has_capability(v_violation.association_id, 'compliance') then
    raise exception 'You cannot add a photo to that notice' using errcode = '42501';
  end if;
  perform assert_association_writable(v_violation.association_id);
  if p_path <> v_violation.association_id || '/violations/' || v_violation.id || '/' || (storage.filename(p_path)) then
    raise exception 'That file is not on this notice' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'attachments' and name = p_path) then
    raise exception 'The file has not been uploaded' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_brief, ''))) < 3 then
    raise exception 'Say what the photo shows' using errcode = '22023';
  end if;
  select coalesce(
    (select m.full_name from memberships m
      where m.association_id = v_violation.association_id and m.profile_id = auth.uid() and m.ends_on is null limit 1),
    'The board') into v_name;

  update violations
     set photos = photos || jsonb_build_array(jsonb_build_object(
           'id', gen_random_uuid(),
           'brief', trim(p_brief),
           'takenOn', current_date,
           'takenBy', v_name,
           'vantage', coalesce(nullif(trim(p_vantage), ''), 'street'),
           'path', p_path
         ))
   where id = p_violation_id;
end;
$$;

revoke all on function add_violation_photo(uuid, text, text, text) from public;
grant execute on function add_violation_photo(uuid, text, text, text) to authenticated;
