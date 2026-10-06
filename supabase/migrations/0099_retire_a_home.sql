-- A home that is no longer a home can be retired, and its records kept.
--
-- remove_household (0018) refuses any home with a statement line, which is
-- every home after the first bill. A board that merged two lots, found a
-- duplicate row after import, or lost a home to the county had no way out:
-- the row kept being billed and counted. Deleting it would have taken the
-- charges and payments with it (they cascade), and a board is required to
-- keep those for years.
--
-- retire_home sets retired_on and ends every seat on the home. The statement
-- stays readable to the board; the home is no longer billed, charged, counted
-- or listed (the register reads where retired_on is null). It needs the
-- settings capability, a zero balance, nothing clearing, and no President
-- seated there. issue_assessment and add_charge_to_all are copied whole from
-- 0084 and 0086 with the one condition added.

alter table units add column if not exists retired_on date;

create or replace function retire_home(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_balance     integer;
begin
  select association_id into v_association from units where id = p_unit_id and retired_on is null;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if not has_capability(v_association, 'settings') then
    raise exception 'Only a settings holder can retire a home' using errcode = '42501';
  end if;
  if exists (
    select 1 from memberships
     where unit_id = p_unit_id and role = 'president' and ends_on is null
  ) then
    raise exception 'Transfer the presidency before retiring this home' using errcode = '42501';
  end if;
  select coalesce(sum(amount_cents), 0) into v_balance from charges where unit_id = p_unit_id;
  if v_balance <> 0 then
    raise exception 'This home''s balance is not zero. Settle it first, then retire the home.'
      using errcode = '22000';
  end if;
  if exists (
    select 1 from payments where unit_id = p_unit_id and state = 'pending'
  ) then
    raise exception 'A payment is still clearing on this home. Wait for it, then retire the home.'
      using errcode = '22000';
  end if;

  update memberships
     set ends_on = greatest(current_date, starts_on), autopay = null
   where unit_id = p_unit_id and ends_on is null;
  update units set retired_on = current_date where id = p_unit_id;
end;
$$;

revoke all on function retire_home(uuid) from public;
revoke execute on function retire_home(uuid) from anon;
grant execute on function retire_home(uuid) to authenticated;
grant execute on function retire_home(uuid) to service_role;

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
         unit_dues_cents(u),
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

create or replace function add_charge_to_all(
  p_association_id uuid,
  p_amount_cents   integer,
  p_label          text,
  p_due_on         date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_label  text := btrim(coalesce(p_label, ''));
  v_count  integer := 0;
begin
  if v_caller is null then
    raise exception 'Sign in to add a charge' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 10000000 then
    raise exception 'A charge has to be between $0.01 and $100,000' using errcode = '22000';
  end if;
  if length(v_label) = 0 then
    raise exception 'Say what the charge is for' using errcode = '22000';
  end if;
  if length(v_label) > 80 then
    raise exception 'Keep what the charge is for to 80 characters' using errcode = '22000';
  end if;
  if p_due_on is null
     or p_due_on > current_date + 366
     or p_due_on < current_date - 366 then
    raise exception 'The due date has to be within a year of today' using errcode = '22000';
  end if;

  if not exists (
    select 1 from associations where id = p_association_id and deleted_at is null
  ) then
    raise exception 'No such association' using errcode = '23503';
  end if;

  if not has_capability(p_association_id, 'finances') then
    raise exception 'You cannot add a charge for that association' using errcode = '42501';
  end if;

  -- The same lock the dues run and the late-fee run take, so a charge cannot
  -- land halfway through either.
  perform pg_advisory_xact_lock(hashtext('dues:' || p_association_id::text));

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select p_association_id, u.id, 'charge', 'other', v_label, p_amount_cents, p_due_on
  from units u
  where u.association_id = p_association_id
    and u.retired_on is null;

  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform record_activity(p_association_id, 'charge', null,
      format('Charge of $%s added to %s homes: %s',
        to_char(p_amount_cents / 100.0, 'FM999,999,990.00'), v_count, v_label),
      jsonb_build_object('homes', v_count, 'amount_cents', p_amount_cents, 'due_on', p_due_on));
  end if;

  return v_count;
end;
$$;
