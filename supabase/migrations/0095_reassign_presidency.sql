-- The presidency can be reassigned when the President cannot be reached.
--
-- transfer_presidency (0010) is the sitting President's to call, and nobody
-- else's: that is what keeps a board from voting its President out of their
-- own account. But a President who has died, sold up without a handover, or
-- lost their email leaves an association nobody can run, because every
-- grant of access runs through that office.
--
-- reassign_presidency is the way out, and it is support's, not the board's:
-- only the service role may call it, after the platform owner has heard from
-- the association and satisfied themselves of who should hold the office.
-- It does what a handover does, to a person who already holds a seat here,
-- and the activity trigger on memberships records both changes.

create or replace function reassign_presidency(p_association_id uuid, p_to_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only support can reassign the presidency' using errcode = '42501';
  end if;

  if not exists (
    select 1 from associations where id = p_association_id and deleted_at is null
  ) then
    raise exception 'No such association' using errcode = '23503';
  end if;

  if not exists (
    select 1 from memberships
     where association_id = p_association_id and profile_id = p_to_profile and ends_on is null
  ) then
    raise exception 'That person is not a current member of this association'
      using errcode = '23503';
  end if;

  update memberships
     set role = 'resident', capabilities = '{}'::capability[]
   where association_id = p_association_id and role = 'president' and ends_on is null
     and profile_id is distinct from p_to_profile;

  update memberships
     set role = 'president',
         capabilities = array[
           'finances', 'requests', 'documents', 'communications', 'voting',
           'vendors', 'compliance', 'forum', 'settings', 'permissions'
         ]::capability[]
   where association_id = p_association_id and profile_id = p_to_profile and ends_on is null;
end;
$$;

revoke all on function reassign_presidency(uuid, uuid) from public;
revoke execute on function reassign_presidency(uuid, uuid) from anon, authenticated;
grant execute on function reassign_presidency(uuid, uuid) to service_role;
