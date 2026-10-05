-- A board can bill a home for a one-off charge.
--
-- Missing until now: the only money a home could be billed was recurring
-- dues (issue_assessment) and late fees. A special assessment for a roof, a
-- key fob fee, a repair billed to one home had nowhere to go. The shared-costs
-- function levy_special_assessment (0013) belongs to a module that is switched
-- off and splits a total across homes, which is not this.
--
-- A one-off charge is an ordinary charges row: kind 'charge', so it raises the
-- home's balance, shows on the owner's statement under its label, and is paid
-- oldest first by record_payment and record_manual_payment like any other.
--
-- Its category is 'other', which charge_category (0013) already has. It must
-- not be 'dues': assess_late_fees (0079) looks only at dues lines, so a
-- one-off charge never draws a late fee, and the figures that count dues
-- collected do not count it. 'special_assessment' is left for the shared-costs
-- module that writes it. No type is added, so nothing here changes the enum.
--
-- Who may call them: a finance holder, signed in, as record_manual_payment
-- does. There is no service-role path; a charge is a board decision and the
-- activity record has to name the person.
--
-- The amount is bounded to $100,000 and the due date to a year either way, so
-- a slipped digit or a wrong year is refused rather than billed.

create or replace function add_charge(
  p_unit_id      uuid,
  p_amount_cents integer,
  p_label        text,
  p_due_on       date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller      uuid := auth.uid();
  v_association uuid;
  v_unit_label  text;
  v_closed      timestamptz;
  v_label       text := btrim(coalesce(p_label, ''));
  v_charge      uuid;
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

  select u.association_id, u.label, a.deleted_at
    into v_association, v_unit_label, v_closed
  from units u
  join associations a on a.id = u.association_id
  where u.id = p_unit_id;
  if v_association is null or v_closed is not null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'finances') then
    raise exception 'You cannot add a charge for that home' using errcode = '42501';
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  values (v_association, p_unit_id, 'charge', 'other', v_label, p_amount_cents, p_due_on)
  returning id into v_charge;

  perform record_activity(v_association, 'charge', v_charge,
    format('Charge of $%s added for %s: %s',
      to_char(p_amount_cents / 100.0, 'FM999,999,990.00'), coalesce(v_unit_label, 'a home'), v_label),
    jsonb_build_object('unit_id', p_unit_id, 'amount_cents', p_amount_cents, 'due_on', p_due_on));

  return v_charge;
end;
$$;

-- By name: Supabase's default grants give anon EXECUTE, and revoking from
-- public does not touch them (see 0062). Signed in only, so anon stays out.
revoke all on function add_charge(uuid, integer, text, date) from public;
revoke execute on function add_charge(uuid, integer, text, date) from anon;
grant execute on function add_charge(uuid, integer, text, date) to authenticated;
grant execute on function add_charge(uuid, integer, text, date) to service_role;

-- The same charge to every home in the association, in one transaction.
-- The homes are the ones issue_assessment bills: every unit of the
-- association. Returns how many were charged.
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
  where u.association_id = p_association_id;

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

revoke all on function add_charge_to_all(uuid, integer, text, date) from public;
revoke execute on function add_charge_to_all(uuid, integer, text, date) from anon;
grant execute on function add_charge_to_all(uuid, integer, text, date) to authenticated;
grant execute on function add_charge_to_all(uuid, integer, text, date) to service_role;
