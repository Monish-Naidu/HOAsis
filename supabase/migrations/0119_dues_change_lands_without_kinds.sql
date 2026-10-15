-- The daily run could not land a dues change that had no rates by kind.
--
-- apply_dues_change (0117) copied dues_change_by_type into dues_by_type as
-- it was, and a change scheduled with one rate for every home carries null
-- there. dues_by_type is not null with '{}' as its default, so the update
-- failed with "null value in column dues_by_type", the change stayed
-- waiting, and the rate never moved. Found by scripts/verify-dues-change.mjs
-- the first time it ran, on 2026-10-15.
--
-- Copied whole from 0117: the service-role gate, the advisory lock shared
-- with the dues run, the signature, the security settings and the grants are
-- as they were. The one change is coalesce on the rates by kind.
create or replace function apply_dues_change(p_association_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cents integer;
  v_bytype jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the daily run applies a dues change' using errcode = '42501';
  end if;

  select dues_change_cents, dues_change_by_type
    into v_cents, v_bytype
  from associations
  where id = p_association_id
    and deleted_at is null
    and dues_change_on is not null
    and dues_change_on <= current_date;
  if v_cents is null then
    return false;
  end if;

  -- The same lock the dues run holds, so a change cannot land halfway
  -- through a billing run.
  perform pg_advisory_xact_lock(hashtext('dues:' || p_association_id::text));

  update associations
     set dues_cents = v_cents,
         -- One rate for every home is stored as no rates by kind, never null.
         dues_by_type = coalesce(v_bytype, '{}'::jsonb),
         dues_change_cents = null,
         dues_change_by_type = null,
         dues_change_on = null
   where id = p_association_id;

  return true;
end;
$$;

revoke all on function apply_dues_change(uuid) from public;
revoke execute on function apply_dues_change(uuid) from anon;
revoke execute on function apply_dues_change(uuid) from authenticated;
grant execute on function apply_dues_change(uuid) to service_role;
