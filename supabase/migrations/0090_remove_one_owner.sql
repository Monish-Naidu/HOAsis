-- Ending one owner's seat on a home with two, and keeping a changed sign-in
-- email in step on the register.
--
-- 1. remove_owner
--
-- add_second_owner (0080) puts two people on a home. If one leaves (a divorce,
-- a death) or was added by mistake there was no way to end just that seat:
-- transfer_home (0081) ends every seat and is the wrong record of what
-- happened, and remove_household (0018) refuses any home that was ever billed.
-- This ends the one seat, today, and nothing else on the home.
--
-- Who may call it is who may add a second owner: the settings capability on
-- the association. It refuses, in words the board can act on:
--   the home's only owner       a sale is the record for that;
--   the President's seat        hand over the office first (as 0010 and 0081);
--   a seat with an office       a role, or any capability to change or see,
--                               comes off first, so nobody loses a board seat
--                               by a click on the roster;
--   a seat that already ended;
--   the caller's own seat       leaving is its own flow (leave_association,
--                               "Leave this association" in the danger zone).
--
-- It sets ends_on and nothing else that a sale sets, the same way
-- transfer_home does, and clears the seat's autopay plan. Saved payment
-- methods are NOT handled here: memberships_take_saved_methods (0075) is a
-- trigger on any update of ends_on, so it already removes the saved methods of
-- that person only (payment_instruments.profile_id = the seat's profile on that
-- home, unless they hold another seat on it) and forgets the home's Stripe
-- customer only when no current member has a method left. A co-owner who saved
-- a method keeps it and the customer it hangs from. Autopay is a column of the
-- seat (memberships.autopay, 0029), so the other owner's plan is a different
-- row and is not touched; the autopay run reads current seats only.
--
-- The activity log needs no call from here either: activity_memberships (0059)
-- records "<name> left the register" when a seat's ends_on is set, with the
-- caller as the actor, which is what transfer_home relies on too.
--
-- The 0089 read rule: unit_owned_since is the earliest start among the seats
-- still open, and only counts when a seat ENDED on or before that day. A
-- removed co-owner ended today, after the remaining owner's seat began, so
-- they bound nothing and the remaining owner keeps the household's whole
-- history. (If the remaining owner's own seat began today, a seat ended today
-- does satisfy the test and the bound is today; that is a home whose only
-- seats were made today, so there is no older history to lose.)
--
-- 2. Auth email and the register
--
-- profiles.email is written by handle_new_user (0003) when the account is
-- created and by nothing since; 0066 closed the browser's way to write it.
-- A person who changes their email through Supabase Auth (the resident
-- Settings screen now offers it) changes auth.users.email only, so dues
-- emails, which read memberships.invited_email, kept going to the old
-- address, and claim_my_seats / add_household, which match profiles.email,
-- matched the old one. sync_auth_email copies a changed address to the
-- profile and to the person's current seats.
--
-- New names, no changed signatures. Supabase grants EXECUTE to anon,
-- authenticated and service_role individually, so anon is revoked by name.

create or replace function remove_owner(p_membership_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat memberships%rowtype;
  v_open integer;
begin
  select * into v_seat from memberships where id = p_membership_id for update;
  if not found or v_seat.unit_id is null then
    raise exception 'No such owner' using errcode = '22000';
  end if;

  -- The service role has no auth.uid(); the signed in rule is the one
  -- add_second_owner asks, and the service role is let through as elsewhere.
  -- coalesce, because auth.role() is null with no claims and a null here
  -- would let the check pass.
  if not (coalesce(auth.role(), '') = 'service_role'
          or has_capability(v_seat.association_id, 'settings')) then
    raise exception 'Only a settings holder can remove an owner' using errcode = '42501';
  end if;

  if v_seat.ends_on is not null then
    raise exception 'That owner has already been removed' using errcode = '22000';
  end if;

  if v_seat.profile_id is not null and v_seat.profile_id = auth.uid() then
    raise exception 'To leave this association yourself, use Leave this association in your own settings'
      using errcode = '22000';
  end if;

  if v_seat.role = 'president' then
    raise exception 'Hand over the presidency first.' using errcode = '23514';
  end if;

  if v_seat.role <> 'resident'
     or coalesce(cardinality(v_seat.capabilities), 0) > 0
     or coalesce(cardinality(v_seat.views), 0) > 0 then
    raise exception 'Take this person off the board first.' using errcode = '23514';
  end if;

  select count(*) into v_open
    from memberships
   where unit_id = v_seat.unit_id and ends_on is null;
  if v_open < 2 then
    raise exception 'This is the home''s only owner. Record a sale instead.' using errcode = '22000';
  end if;

  -- No seat may end before it began, as transfer_home checks. starts_on
  -- defaults to the day the row was made, so this is a seat made today.
  update memberships
     set ends_on  = greatest(current_date, v_seat.starts_on),
         autopay  = null
   where id = v_seat.id;

  return v_seat.unit_id;
end;
$$;
revoke all on function remove_owner(uuid) from public;
revoke execute on function remove_owner(uuid) from anon;
grant execute on function remove_owner(uuid) to authenticated;
grant execute on function remove_owner(uuid) to service_role;

-- Keeps the register's copy of an account's email in step with the account.
-- Runs as its owner (security definer) because the person changing their
-- email has no right to write profiles.email (0066) and the statement that
-- fires this is Supabase Auth's own, not theirs. The trigger on auth.users is
-- created by the migration role, as 0003's is.
create or replace function sync_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A phone only account has no email to copy.
  if new.email is null or new.email is not distinct from old.email then
    return new;
  end if;

  update profiles set email = new.email where id = new.id;

  -- The address the board's emails go to, on every seat this person holds
  -- today. A seat that ended keeps the address it had, as a record.
  update memberships
     set invited_email = new.email
   where profile_id = new.id
     and ends_on is null;

  return new;
end;
$$;
revoke all on function sync_auth_email() from public;
revoke execute on function sync_auth_email() from anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function sync_auth_email();
