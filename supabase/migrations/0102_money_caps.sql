-- Money caps the database holds, not only the forms.
--
-- A walk found $10,000,000 accepted as one home's dues, 99,999,999 as the
-- association's rate, and $999,999,999 recorded by hand against a $285
-- balance. The screens now refuse each; this is the same limit where a
-- direct call would otherwise get past them.
--
--   * set_home_dues (0084): dues for one home are at most $100,000 a period.
--   * record_manual_payment (0083): a check or cash is at most what the home
--     owes plus $10,000, the ceiling an owner's "Other amount" has.
--   * associations.dues_cents: the association's rate is a plain row update,
--     so it gets a check constraint, at most $100,000. Added NOT VALID so a
--     row already over it cannot block this migration; every new write and
--     every update of that column is held to it.
--
-- Both functions are copied whole from their latest definitions (0083 and
-- 0084) with only the check added, and carry the grants they had.

create or replace function record_manual_payment(
  p_unit_id      uuid,
  p_amount_cents integer,
  p_method       text,
  p_reference    text,
  p_received_on  date
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
  v_payment     uuid;
  v_remaining   integer := p_amount_cents;
  v_take        integer;
  v_charge      record;
  v_operating   uuid;
  v_payer_name  text;
  v_rail        payment_rail;
  v_reference   text := nullif(btrim(coalesce(p_reference, '')), '');
  v_label       text;
  v_owed        integer;
begin
  if v_caller is null then
    raise exception 'Sign in to record a payment' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'A payment has to be for a positive amount' using errcode = '22000';
  end if;
  if p_method is null or p_method not in ('check', 'cash', 'other') then
    raise exception 'A payment is a check, cash or other' using errcode = '22000';
  end if;
  -- current_date is UTC, so a board in the evening west of Greenwich is
  -- already a day ahead of it.
  if p_received_on is null or p_received_on > current_date + 1 then
    raise exception 'A payment cannot be dated in the future' using errcode = '22000';
  end if;

  select association_id, label into v_association, v_unit_label
  from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'finances') then
    raise exception 'You cannot record a payment for that home' using errcode = '42501';
  end if;

  -- A slipped key cannot book nine figures: no more than the home owes plus
  -- $10,000, the ceiling the owner's own "Other amount" has. The same sum
  -- unit_balances makes, summed here because the caller is checked above and
  -- the view answers by auth.uid().
  select coalesce(sum(amount_cents), 0)::integer into v_owed
  from charges where unit_id = p_unit_id and due_on <= current_date;
  if p_amount_cents > greatest(v_owed, 0) + 1000000 then
    raise exception 'A payment can be at most %, what the home owes plus $10,000',
      '$' || to_char((greatest(v_owed, 0) + 1000000) / 100.0, 'FM999,999,990.00')
      using errcode = '22000';
  end if;

  v_rail := case p_method when 'check' then 'check' when 'cash' then 'cash' else 'ach' end;
  v_label := case p_method
               when 'check' then 'Check payment'
               when 'cash'  then 'Cash payment'
               else 'Payment'
             end
             || case when v_reference is not null then ' #' || v_reference else '' end;

  select full_name into v_payer_name
  from memberships
  where unit_id = p_unit_id and ends_on is null
  order by created_at
  limit 1;

  -- paid_by is the finance holder who entered it, as record_payment stores
  -- the signed-in caller; the activity record reads the same.
  insert into payments (
    association_id, unit_id, paid_by, amount_cents,
    processor_fee_cents, platform_fee_cents, rail, state, settled_at
  )
  values (
    v_association, p_unit_id, v_caller, p_amount_cents,
    0, 0, v_rail, 'settled', now()
  )
  returning id into v_payment;

  insert into charges (association_id, unit_id, kind, label, amount_cents, due_on)
  values (v_association, p_unit_id, 'payment', v_label, -p_amount_cents, p_received_on);

  -- Oldest open charge first, as record_payment does it.
  for v_charge in
    select c.id, c.amount_cents,
           coalesce((
             select sum(pa.amount_cents) from payment_allocations pa where pa.charge_id = c.id
           ), 0) as already_applied
    from charges c
    where c.unit_id = p_unit_id
      and c.kind = 'charge'
      and c.due_on <= current_date
    order by c.due_on asc, c.created_at asc
  loop
    exit when v_remaining <= 0;
    v_take := least(v_charge.amount_cents - v_charge.already_applied, v_remaining);
    continue when v_take <= 0;

    insert into payment_allocations (payment_id, charge_id, amount_cents)
    values (v_payment, v_charge.id, v_take);

    v_remaining := v_remaining - v_take;
  end loop;

  select id into v_operating
  from bank_accounts
  where association_id = v_association and kind = 'operating'
  limit 1;

  insert into ledger_entries (
    association_id, bank_account_id, occurred_on, description,
    counterparty, category, amount_cents, confirmed_at, payment_id
  )
  values (
    v_association,
    v_operating,
    p_received_on,
    'Assessment payment, unit ' || v_unit_label,
    coalesce(v_payer_name, 'Owner'),
    'Assessments',
    p_amount_cents,
    now(),
    v_payment
  );

  return v_payment;
end;
$$;

-- By name: Supabase's default grants give anon EXECUTE, and revoking from
-- public does not touch them (see 0062).
revoke all on function record_manual_payment(uuid, integer, text, text, date) from public;
revoke all on function record_manual_payment(uuid, integer, text, text, date) from anon;
grant execute on function record_manual_payment(uuid, integer, text, text, date) to authenticated;

-- Set or clear one home's own amount. Null clears it, so the home pays its
-- kind's or the association's amount from the next bill. Bills already
-- issued keep the amount they were issued at.
create or replace function set_home_dues(
  p_unit_id    uuid,
  p_dues_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to change dues' using errcode = '42501';
  end if;
  if p_dues_cents is not null and p_dues_cents < 0 then
    raise exception 'Dues cannot be negative' using errcode = '22000';
  end if;
  -- $100,000 a period, the ceiling the forms hold (duesProblem).
  if p_dues_cents is not null and p_dues_cents > 10000000 then
    raise exception 'That looks too high. Dues are per home, per period.' using errcode = '22000';
  end if;

  select association_id into v_association from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not (has_capability(v_association, 'finances')
          or has_capability(v_association, 'settings')) then
    raise exception 'You cannot change dues for that home' using errcode = '42501';
  end if;

  update units set dues_cents = p_dues_cents where id = p_unit_id;
end;
$$;

revoke all on function set_home_dues(uuid, integer) from public;
revoke execute on function set_home_dues(uuid, integer) from anon;
grant execute on function set_home_dues(uuid, integer) to authenticated;

alter table associations
  add constraint associations_dues_cents_cap
  check (dues_cents <= 10000000) not valid;

