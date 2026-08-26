-- One sitting President, checked when the transaction ends rather than on
-- every row it touches.
--
-- The previous pair of rules was individually correct and jointly impossible.
-- A partial unique index refused a second President even for an instant, and a
-- row level trigger refused to demote the last one. Handing over the office
-- needs both to happen, so the only supported way to leave was blocked by the
-- rules meant to protect it.
--
-- Both are replaced by one deferred constraint trigger. Inside a transaction
-- the count may be anything; at commit it has to be exactly one. That permits
-- promote-then-demote in either order and still refuses every way of ending up
-- with no President, including a server side delete.

drop trigger if exists keep_a_president on memberships;
drop index if exists one_president_per_association;

create or replace function assert_one_president()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid := coalesce(new.association_id, old.association_id);
  v_count integer;
  v_exists boolean;
begin
  -- An association being deleted outright takes its memberships with it, and
  -- has no invariant left to hold.
  select exists (select 1 from associations where id = v_association) into v_exists;
  if not v_exists then return null; end if;

  select count(*) into v_count
  from memberships
  where association_id = v_association
    and role = 'president'
    and ends_on is null;

  if v_count = 0 then
    raise exception
      'An association needs a President. Hand the office to somebody before you step down, or nobody will be able to grant access back.'
      using errcode = '23514';
  end if;

  if v_count > 1 then
    raise exception 'An association can only have one President at a time'
      using errcode = '23505';
  end if;

  return null;
end;
$$;

create constraint trigger one_president
  after insert or update or delete on memberships
  deferrable initially deferred
  for each row execute function assert_one_president();

/**
 * Hands over the office.
 *
 * Both halves in one transaction, which the deferred check now permits. The
 * outgoing President becomes a resident rather than disappearing, because they
 * still own a home and still owe assessments on it.
 */
create or replace function transfer_presidency(p_to_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_caller uuid := auth.uid();
begin
  select association_id into v_association
  from memberships
  where profile_id = v_caller and role = 'president' and ends_on is null
  limit 1;

  if v_association is null then
    raise exception 'Only the sitting President can hand over the office'
      using errcode = '42501';
  end if;

  if p_to_profile = v_caller then
    raise exception 'You already hold the office' using errcode = '22000';
  end if;

  if not exists (
    select 1 from memberships
    where association_id = v_association and profile_id = p_to_profile and ends_on is null
  ) then
    raise exception 'That person is not a current member of this association'
      using errcode = '23503';
  end if;

  update memberships
     set role = 'resident', capabilities = '{}'::capability[]
   where association_id = v_association and profile_id = v_caller and ends_on is null;

  update memberships
     set role = 'president',
         capabilities = array[
           'finances', 'requests', 'documents', 'communications', 'voting',
           'vendors', 'compliance', 'forum', 'settings', 'permissions'
         ]::capability[]
   where association_id = v_association and profile_id = p_to_profile and ends_on is null;
end;
$$;

revoke all on function transfer_presidency from public;
grant execute on function transfer_presidency to authenticated;
