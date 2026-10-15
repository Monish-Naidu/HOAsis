-- New dues with the day they start.
--
-- Budget season is when a board adopts next year's rate, and until now the
-- only change was immediate: the rate moved the moment Save was pressed, and
-- a rate "effective January 1" had no home. So a change can now be held with
-- the day it bills from, and the dues run applies it on that day.
--
-- WHAT THE BOARD SETS. Three columns on associations, all null together
-- (associations_dues_change_shape below):
--   dues_change_cents    the new standard rate, in cents
--   dues_change_by_type  the new rates by kind of home, or null for one rate
--   dues_change_on       the first day the new rates bill from
-- A bill is at the new rates when its due date falls on or after that day,
-- at the old ones when it falls before it, so a catch-up run after a missed
-- day still bills the old rate for a period that closed before the change.
-- A home that carries its own amount (0084) keeps it: a general change moves
-- the association's and each kind's rate, not one home's own, which has its
-- own action on Homeowners.
--
-- WHO APPLIES IT. apply_dues_change, called by the daily dues run after it
-- bills: the stored rate becomes the new one and the three columns clear,
-- so every reader of dues_cents reads one current rate again. Until that run
-- lands, the app derives the rate of the day from the waiting change
-- (duesTerms in src/lib/home-types.ts), so no screen shows a rate the bills
-- do not match. Only the service role can call it: a person cannot move the
-- rate by hand and skip the day the board picked.
--
-- WHAT IT DOES NOT DO. Only one change waits at a time: scheduling again
-- replaces the one waiting, because no bill has moved either way. The day
-- cannot be in the past (the run cannot bill it) and not more than a year
-- out, the same window add_charge_to_all holds. Cancel clears the three
-- columns, which is safe: nothing billed at the waiting rate yet.
--
-- budget_lines.approved_on: the Budget screen names the day the board
-- adopted the plan it measures against. A line added before adoption, or by
-- the wizard, carries no day.

alter table associations
  add column if not exists dues_change_cents integer,
  add column if not exists dues_change_by_type jsonb,
  add column if not exists dues_change_on date;

comment on column associations.dues_change_cents is
  'The standard rate dues become on dues_change_on, in cents. Null with the other two when no change is waiting.';
comment on column associations.dues_change_by_type is
  'The rates by kind of home that take effect on dues_change_on, or null when every kind pays dues_change_cents.';
comment on column associations.dues_change_on is
  'The first day the waiting change bills from: a period due on or after it bills the new rates.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'associations_dues_change_shape') then
    alter table associations add constraint associations_dues_change_shape check (
      (dues_change_cents is null and dues_change_by_type is null and dues_change_on is null)
      or (
        dues_change_cents is not null and dues_change_on is not null
        and dues_change_cents >= 1 and dues_change_cents <= 10000000
      )
    );
  end if;
end
$$;

alter table budget_lines
  add column if not exists approved_on date;

comment on column budget_lines.approved_on is
  'The day the board adopted the budget this line belongs to. Null until they say.';

-- The rule of 0084 at a day's rates. The same three steps (own, kind,
-- association), each taken from the rates in effect on the day asked for.
-- unit_dues_cents below reads this for today, so there is one place that
-- knows the order.
create or replace function unit_dues_cents_on(p_unit units, p_on date)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(p_unit.dues_cents, 0),
    nullif((t.dues_by_type ->> p_unit.home_type::text)::integer, 0),
    t.dues_cents
  )
  from (
    select
      case when a.dues_change_on is not null and p_on >= a.dues_change_on
             then a.dues_change_cents else a.dues_cents end as dues_cents,
      case when a.dues_change_on is not null and p_on >= a.dues_change_on
             then a.dues_change_by_type else a.dues_by_type end as dues_by_type
    from associations a
    where a.id = p_unit.association_id
  ) t;
$$;

revoke all on function unit_dues_cents_on(units, date) from public;
revoke execute on function unit_dues_cents_on(units, date) from anon;
grant execute on function unit_dues_cents_on(units, date) to authenticated;
grant execute on function unit_dues_cents_on(units, date) to service_role;

-- Redefined whole (0084's shape, grants and settings untouched): today's
-- answer of the rule above.
create or replace function unit_dues_cents(p_unit units)
returns integer
language sql
stable
set search_path = public
as $$
  select unit_dues_cents_on(p_unit, current_date);
$$;

revoke all on function unit_dues_cents(units) from public;
revoke execute on function unit_dues_cents(units) from anon;
grant execute on function unit_dues_cents(units) to authenticated;
grant execute on function unit_dues_cents(units) to service_role;

-- issue_assessment, copied whole from 0099. The permission check, the
-- advisory lock, the billing_starts_on guard, the one-bill-per-period guard,
-- the retired-home guard, the signature, the security settings and the
-- grants are as they were. The one change is the amount each home is
-- billed: the rates of the due date, not of the day the run happens.
create or replace function issue_assessment(
  p_association_id uuid,
  p_label          text,
  p_due_on         date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer := 0;
  v_dues   integer;
  v_bytype jsonb;
  v_starts date;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  -- One billing run per association at a time. The "already billed" tests
  -- below read what is committed; without this, two runs that start
  -- together each see nothing and both insert. Held until this transaction
  -- ends, and every statement after it takes a fresh look, so the second
  -- run finds the first run's lines. Shared with assess_late_fees.
  perform pg_advisory_xact_lock(hashtext('dues:' || p_association_id::text));

  select dues_cents, dues_by_type, coalesce(billing_starts_on, created_at::date)
    into v_dues, v_bytype, v_starts
    from associations where id = p_association_id;
  if v_dues is null or v_dues <= 0 then
    return 0;
  end if;
  if p_due_on < v_starts then
    return 0;
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select p_association_id, u.id, 'charge', 'dues', p_label,
         unit_dues_cents_on(u, p_due_on),
         p_due_on
  from units u
  where u.association_id = p_association_id
    -- A retired home is off the register: no bill, no late fee on it.
    and u.retired_on is null
    and not exists (
      select 1 from charges c
      where c.unit_id = u.id
        and c.kind = 'charge'
        and c.category = 'dues'
        and c.due_on = p_due_on
    )
    and not exists (
      select 1 from charges c
      where c.unit_id = u.id
        and c.label = 'Balance brought forward'
        and c.due_on >= p_due_on
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function issue_assessment(uuid, text, date) from public;
revoke execute on function issue_assessment(uuid, text, date) from anon;
grant execute on function issue_assessment(uuid, text, date) to authenticated;

-- Hold a change, or cancel the one waiting. p_dues_cents, p_dues_by_type and
-- p_effective_on all null cancels. The activity row is written by hand: the
-- settings audit trigger (0059) fires on dues_cents, which this does not
-- touch, and a waiting change is as much a decision as the move itself.
create or replace function schedule_dues_change(
  p_association_id uuid,
  p_dues_cents     integer,
  p_dues_by_type   jsonb,
  p_effective_on   date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_cadence text;
  v_cents  integer;
  v_on     date;
  v_kind   text;
  v_amount integer;
begin
  if v_caller is null then
    raise exception 'Sign in to change dues' using errcode = '42501';
  end if;

  select dues_cadence::text, dues_change_cents, dues_change_on
    into v_cadence, v_cents, v_on
  from associations where id = p_association_id and deleted_at is null;
  if v_cadence is null then
    raise exception 'No such association' using errcode = '23503';
  end if;

  -- The Settings screen holds dues, so the same capability that edits the
  -- association edits the change. The lock answers the write (0107): a
  -- read-only board cannot schedule anything.
  if not has_capability(p_association_id, 'settings') then
    raise exception 'You cannot change dues for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(p_association_id);

  -- Cancel: nothing billed at the waiting rate yet, so clearing it is safe.
  -- The columns are all null or all set (the constraint above), so one test
  -- covers the three.
  if p_dues_cents is null and p_dues_by_type is null and p_effective_on is null then
    if v_on is null then
      raise exception 'No dues change is waiting' using errcode = '22000';
    end if;
    update associations
       set dues_change_cents = null, dues_change_by_type = null, dues_change_on = null
     where id = p_association_id;
    perform record_activity(p_association_id, 'association', p_association_id,
      format('Dues change set for %s cancelled', v_on),
      jsonb_build_object('cancelled_on', v_on, 'was_cents', v_cents));
    return;
  end if;

  if p_dues_cents is null or p_dues_cents < 1 or p_dues_cents > 10000000 then
    raise exception 'New dues have to be between $0.01 and $100,000' using errcode = '22000';
  end if;
  if p_effective_on is null or p_effective_on < current_date then
    raise exception 'The day new dues start cannot be in the past' using errcode = '22000';
  end if;
  if p_effective_on > current_date + 366 then
    raise exception 'Pick a day within the next year' using errcode = '22000';
  end if;
  if p_dues_by_type is not null then
    if jsonb_typeof(p_dues_by_type) <> 'object' then
      raise exception 'Rates by kind of home have to name each kind' using errcode = '22000';
    end if;
    for v_kind, v_amount in
      select key, coalesce((value #>> '{}')::integer, 0) from jsonb_each(p_dues_by_type)
    loop
      if v_amount < 1 or v_amount > 10000000 then
        raise exception 'New dues for %s have to be between $0.01 and $100,000', v_kind
          using errcode = '22000';
      end if;
    end loop;
  end if;

  update associations
     set dues_change_cents = p_dues_cents,
         dues_change_by_type = p_dues_by_type,
         dues_change_on = p_effective_on
   where id = p_association_id;

  perform record_activity(p_association_id, 'association', p_association_id,
    case when p_dues_by_type is null
      then format('Dues set to $%s %s from %s',
           to_char(p_dues_cents / 100.0, 'FM999,999,990.00'), v_cadence, p_effective_on)
      else format('Dues for each kind of home set from %s', p_effective_on)
    end,
    jsonb_build_object(
      'dues_cents', p_dues_cents,
      'dues_by_type', coalesce(p_dues_by_type, 'null'::jsonb),
      'effective_on', p_effective_on,
      'replaced', v_on
    ));
end;
$$;

revoke all on function schedule_dues_change(uuid, integer, jsonb, date) from public;
revoke execute on function schedule_dues_change(uuid, integer, jsonb, date) from anon;
grant execute on function schedule_dues_change(uuid, integer, jsonb, date) to authenticated;
grant execute on function schedule_dues_change(uuid, integer, jsonb, date) to service_role;

-- Move a waiting change into the rate once its day has come. The daily dues
-- run calls it after billing, so the run of the day applies the rate of the
-- day. The settings audit trigger logs the move under "dues set to", in the
-- service role's name, which is the record of the change taking effect.
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
         dues_by_type = v_bytype,
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
