-- Guards on the ways an association can destroy itself, and a way to leave.
--
-- Removing yourself as the only officer worked, silently, and dropped you at
-- the login page. The association was then unreachable: nobody could grant
-- capabilities back, because the only person who could had just deleted the
-- row that said so. There is no undo for that from inside the product.
--
-- A confirmation dialog is not a guard. It is a speed bump in one client, and
-- the next client, the API, and a mistaken script all drive straight past it.
-- So the rules live here.
--
-- The rules:
--   an association always has exactly one sitting President
--   the President cannot leave without handing the office to somebody
--   deleting an association is soft, reversible for thirty days, and requires
--     typing its name, because owners have records in there that they are
--     entitled to and that the association is usually obliged to keep
--   cancelling a subscription stops billing and changes nothing else

alter table associations
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_requested_by uuid references profiles (id) on delete set null,
  -- active, past_due, canceled. Cancelling stops billing; it does not delete.
  add column if not exists subscription_status text not null default 'active',
  add column if not exists canceled_at timestamptz,
  add column if not exists cancel_reason text;

-- ---------------------------------------------------------------- guards

/**
 * An association cannot be left without a President.
 *
 * Fires on the two ways it could happen: deleting the membership outright, or
 * ending it with a date. Handing the office over first is the supported path,
 * and transfer_presidency below does both halves in one transaction so this
 * never trips for somebody doing the right thing.
 */
create or replace function protect_last_president()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role board_role;
  v_association uuid;
  v_remaining integer;
begin
  if tg_op = 'DELETE' then
    v_role := old.role;
    v_association := old.association_id;
  else
    -- Only interesting when a sitting membership is being ended or demoted.
    if old.ends_on is not null then return new; end if;
    if new.ends_on is null and new.role = old.role then return new; end if;
    v_role := old.role;
    v_association := old.association_id;
  end if;

  if v_role <> 'president' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select count(*) into v_remaining
  from memberships m
  where m.association_id = v_association
    and m.role = 'president'
    and m.ends_on is null
    and m.id <> old.id;

  if v_remaining = 0 then
    raise exception
      'Hand the presidency to somebody before you leave. An association with no President has nobody who can grant access back.'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists keep_a_president on memberships;
create trigger keep_a_president
  before update or delete on memberships
  for each row execute function protect_last_president();

/**
 * Hands the presidency to another household, in one transaction.
 *
 * The outgoing President becomes a resident rather than disappearing, because
 * they still own a home and still owe assessments on it. Leaving the
 * association is a separate act from ceasing to run it.
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

  if not exists (
    select 1 from memberships
    where association_id = v_association and profile_id = p_to_profile and ends_on is null
  ) then
    raise exception 'That person is not a current member of this association'
      using errcode = '23503';
  end if;

  -- Raise the successor first, so the association is never without a President
  -- even for the length of one statement.
  update memberships
     set role = 'president',
         capabilities = array[
           'finances', 'requests', 'documents', 'communications', 'voting',
           'vendors', 'compliance', 'forum', 'settings', 'permissions'
         ]::capability[]
   where association_id = v_association and profile_id = p_to_profile and ends_on is null;

  update memberships
     set role = 'resident', capabilities = '{}'::capability[]
   where association_id = v_association and profile_id = v_caller and ends_on is null;
end;
$$;

revoke all on function transfer_presidency from public;
grant execute on function transfer_presidency to authenticated;

/**
 * Leaving an association.
 *
 * Ends the membership with a date rather than deleting it, so the record of
 * who owned what when survives, which is the whole reason memberships carry
 * dates. Refused for a sitting President by the trigger above.
 */
create or replace function leave_association(p_association_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update memberships
     set ends_on = current_date
   where association_id = p_association_id
     and profile_id = auth.uid()
     and ends_on is null;
end;
$$;

revoke all on function leave_association from public;
grant execute on function leave_association to authenticated;

-- ------------------------------------------------------------- deletion

/**
 * Deleting an association, slowly and on purpose.
 *
 * Soft, because owners have payment records in here that they are entitled to
 * and that most states require the association to keep for years. A board that
 * deletes in anger on a Tuesday has thirty days to change their mind, and
 * anybody who needs a statement in that window can still get one.
 *
 * The name has to be typed. Not because typing proves care, but because it
 * makes the act deliberate enough that nobody does it while meaning to click
 * something adjacent.
 */
create or replace function request_association_deletion(
  p_association_id uuid,
  p_typed_name     text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not exists (
    select 1 from memberships
    where association_id = p_association_id
      and profile_id = auth.uid()
      and role = 'president'
      and ends_on is null
  ) then
    raise exception 'Only the President can delete an association' using errcode = '42501';
  end if;

  select name into v_name from associations where id = p_association_id;

  if lower(trim(coalesce(p_typed_name, ''))) <> lower(trim(v_name)) then
    raise exception 'The name did not match' using errcode = '22000';
  end if;

  update associations
     set deleted_at = now(),
         deletion_requested_by = auth.uid(),
         subscription_status = 'canceled',
         canceled_at = now()
   where id = p_association_id;

  return now() + interval '30 days';
end;
$$;

revoke all on function request_association_deletion from public;
grant execute on function request_association_deletion to authenticated;

/** Changing their mind, any time inside the window. */
create or replace function cancel_association_deletion(p_association_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from memberships
    where association_id = p_association_id
      and profile_id = auth.uid()
      and role = 'president'
      and ends_on is null
  ) then
    raise exception 'Only the President can restore an association' using errcode = '42501';
  end if;

  update associations
     set deleted_at = null,
         deletion_requested_by = null,
         subscription_status = 'active',
         canceled_at = null
   where id = p_association_id;
end;
$$;

revoke all on function cancel_association_deletion from public;
grant execute on function cancel_association_deletion to authenticated;

/**
 * Cancelling the subscription.
 *
 * Stops the bill. Does not touch a single record, because those belong to the
 * association rather than to us, and holding them hostage to a payment is not
 * a business we want to be in. A cancelled association stays readable so a
 * board can export what they need on their way out.
 */
create or replace function cancel_subscription(
  p_association_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_capability(p_association_id, 'settings') then
    raise exception 'You do not have the settings capability' using errcode = '42501';
  end if;

  update associations
     set subscription_status = 'canceled',
         canceled_at = now(),
         cancel_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_association_id;
end;
$$;

create or replace function resume_subscription(p_association_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_capability(p_association_id, 'settings') then
    raise exception 'You do not have the settings capability' using errcode = '42501';
  end if;

  update associations
     set subscription_status = 'active', canceled_at = null, cancel_reason = null
   where id = p_association_id;
end;
$$;

revoke all on function cancel_subscription from public;
revoke all on function resume_subscription from public;
grant execute on function cancel_subscription to authenticated;
grant execute on function resume_subscription to authenticated;

-- A deleted association disappears from every list without the callers having
-- to remember to filter it.
create or replace function my_associations()
returns table (
  association_id uuid,
  name           text,
  role           board_role,
  capabilities   capability[]
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, m.role, m.capabilities
  from memberships m
  join associations a on a.id = m.association_id
  where m.profile_id = auth.uid()
    and m.ends_on is null
    and a.deleted_at is null
  order by a.name;
$$;
