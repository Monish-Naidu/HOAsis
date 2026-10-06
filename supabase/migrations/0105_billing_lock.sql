-- A board that stops paying us loses nothing. Until now the only lock was
-- a React wall for a trial that ran out with no card; a failed card showed a
-- banner and a cancelled subscription showed nothing, and the database let
-- every write through.
--
-- The rule (src/lib/billing.ts, boardLocked): the board side is read-only
--   * for a trial that ended with no card, 14 days after it ended;
--   * when the subscription is past due and past_due_since is 14 or more
--     days ago;
--   * when the subscription is cancelled.
-- association_writable() below is that rule in SQL, branch for branch:
-- canceled, then past_due, then active or a subscription id on file, else
-- the trial date. billing.ts counts days between YYYY-MM-DD strings, and so
-- does this function, in UTC. They cannot be identical to the minute: the
-- browser's "today" is the date it loaded the page with, the database's is
-- now() when the row is written, so near midnight UTC they can differ by a
-- day for one request. The database is the one that decides.
--
-- WHO IS REFUSED. A trigger on the tables the board writes refuses an
-- insert, update or delete from a signed-in browser (current_user is
-- 'authenticated' or 'anon') when the row's association is locked. It asks
-- current_user, not auth.role(), the way 0065 does, and for the same reason:
-- inside a security definer function current_user is the function's owner.
-- That is what keeps owners working. record_payment, cast_votes,
-- start_owner_thread, claim_my_seats, update_my_contact, set_my_autopay,
-- rsvp_meeting and the rest write charges, ledger rows or memberships on an
-- owner's behalf; triggers fire under them, current_user is not
-- 'authenticated', and the trigger lets them through. auth.role() would say
-- 'authenticated' inside them and lock owners out of paying, which is the
-- one mistake this migration must not make. The service role (webhooks,
-- crons, the Stripe settlement path) is skipped by both tests.
--
-- WHAT THIS DOES NOT COVER. A board member calling a security definer RPC
-- (add_charge, record_manual_payment, add_household, transfer_home, ...)
-- also runs as the owner, so the trigger cannot tell it from an owner's
-- call. Those functions get the lock from assert_association_writable()
-- below, one line each, added where each is next rewritten.
--
-- Left alone on purpose, so owners keep writing: payments, threads, votes,
-- payment_instruments, autopay_runs, requests, profiles.

create or replace function association_writable(p_association_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when a.subscription_status = 'canceled' then false
      when a.subscription_status = 'past_due' then not (
        a.past_due_since is not null
        and (now() at time zone 'utc')::date - (a.past_due_since at time zone 'utc')::date >= 14
      )
      when a.subscription_status = 'active' or a.billing_subscription_id is not null then true
      -- Trial, or ended: locked once more than 14 days (GRACE_DAYS) past it.
      else not (
        (now() at time zone 'utc')::date - (a.trial_ends_at at time zone 'utc')::date > 14
      )
    end
    from associations a
    where a.id = p_association_id
  ), true);  -- no such association (a cascade in progress): nothing to lock
$$;

revoke all on function association_writable(uuid) from public;
grant execute on function association_writable(uuid) to anon;
grant execute on function association_writable(uuid) to authenticated;
grant execute on function association_writable(uuid) to service_role;

-- The same answer as an error, for a board RPC to call first.
create or replace function assert_association_writable(p_association_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not association_writable(p_association_id) then
    raise exception 'The board side is read-only until the subscription is paid'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function assert_association_writable(uuid) from public;
grant execute on function assert_association_writable(uuid) to anon;
grant execute on function assert_association_writable(uuid) to authenticated;
grant execute on function assert_association_writable(uuid) to service_role;

-- ballot_options has no association_id of its own. Security definer so a
-- row the caller cannot read through RLS still resolves.
create or replace function association_of_ballot(p_ballot_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select association_id from ballots where id = p_ballot_id;
$$;

revoke all on function association_of_ballot(uuid) from public;
grant execute on function association_of_ballot(uuid) to anon;
grant execute on function association_of_ballot(uuid) to authenticated;
grant execute on function association_of_ballot(uuid) to service_role;

create or replace function refuse_when_locked()
returns trigger
language plpgsql
-- Security invoker on purpose: current_user has to be the role that ran the
-- statement, which is the whole test (see the header).
set search_path = public
as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if current_user not in ('authenticated', 'anon')
     or coalesce(auth.role(), '') = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old := case when tg_table_name = 'ballot_options'
                  then association_of_ballot((to_jsonb(old) ->> 'ballot_id')::uuid)
                  else (to_jsonb(old) ->> 'association_id')::uuid end;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := case when tg_table_name = 'ballot_options'
                  then association_of_ballot((to_jsonb(new) ->> 'ballot_id')::uuid)
                  else (to_jsonb(new) ->> 'association_id')::uuid end;
  end if;

  if (v_old is not null and not association_writable(v_old))
     or (v_new is not null and not association_writable(v_new)) then
    raise exception 'The board side is read-only until the subscription is paid'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'charges', 'ledger_entries', 'payouts', 'vendors', 'violations', 'meetings',
    'ballots', 'ballot_options', 'documents', 'announcements', 'memberships', 'units'
  ] loop
    execute format('drop trigger if exists billing_lock on %I', t);
    execute format(
      'create trigger billing_lock before insert or update or delete on %I '
      'for each row execute function refuse_when_locked()', t);
  end loop;
end;
$$;
