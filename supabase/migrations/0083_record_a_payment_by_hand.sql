-- A board can put an owner's check or cash on the books.
--
-- Missing until now: record_payment (0062) lets a finance holder record a
-- payment, and its own comment says that is how a cheque in the post gets
-- onto the books, but no screen called it and it knows only the processor
-- rails. It also stamps the statement line "Card payment" for anything but
-- ach, takes today's date, and carries the processor fee arguments the
-- Stripe webhook depends on. Its signature must not change (a second
-- argument list makes an overload, and PostgREST answers PGRST203 for both),
-- so the hand-recorded path is its own function.
--
-- It writes the same four facts record_payment writes: the payments row, the
-- statement line, the allocations oldest charge first, and the ledger deposit
-- on the operating account, confirmed. There is no processor, so no fee.
--
-- method is check, cash or other. Check and cash use the rails 0082 added.
-- "Other" (a money order, a bank transfer the owner made outside the product)
-- is stored on the ach rail: money that arrived through a bank, no card, no
-- fee. Its statement line says "Payment" with the reference, so the board's
-- word for it is what the owner reads.
--
-- Only a finance holder may call it, signed in. There is no service-role
-- path: the webhook has record_payment.

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
