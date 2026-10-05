-- A board can take back a check or cash payment it recorded by mistake.
--
-- Missing until now: record_manual_payment (0083) puts an owner's check or
-- cash on the books and nothing takes it off. Entered twice, or against the
-- wrong home, the only tool was "Add a credit", which goes the wrong way and
-- leaves the payment standing, so collected and the bank balance stayed
-- overstated.
--
-- A reversal is stored exactly as record_refund (0070, 0078) stores a full
-- refund, so every screen and total that already understands a refunded
-- payment understands this one:
--
--   payments.refunded_cents = amount_cents and state = 'refunded';
--   a statement line of kind 'charge', category 'other', for the whole
--     amount, dated today, so the home owes it again (unit_balances rises by
--     exactly the payment) and no dues, skip or late-fee logic treats the
--     line as dues;
--   a negative ledger entry on the operating account for the same amount,
--     dated today, linked to the payment, so the deposit nets to zero.
--
-- The payment's own statement line and its allocation rows are left as they
-- are, as a refund leaves them: how the money was applied is a fact about
-- the past, and the new line is what undoes it. Dues the payment had covered
-- read as unpaid again because assess_late_fees (0079) works off the
-- statement, not the allocations.
--
-- Only a check or cash payment can be reversed. A payment that came through
-- Stripe is taken back in Stripe, and record_refund books it from there. A
-- payment recorded as "other" (stored on the ach rail with no Stripe intent)
-- is not reversible here either; it is refused with its own message.
--
-- Who may call it: a finance holder, signed in, as record_manual_payment
-- does. There is no service-role path, because the activity record has to
-- name the person who took the payment back.

create or replace function reverse_manual_payment(
  p_payment_id uuid,
  p_reason     text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller      uuid := auth.uid();
  v_reason      text := btrim(coalesce(p_reason, ''));
  v_payment     payments%rowtype;
  v_closed      timestamptz;
  v_unit_label  text;
  v_operating   uuid;
begin
  if v_caller is null then
    raise exception 'Sign in to reverse a payment' using errcode = '42501';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 120 then
    raise exception 'Say why, in 3 to 120 characters' using errcode = '22000';
  end if;

  select * into v_payment from payments where id = p_payment_id;
  if v_payment.id is null then
    raise exception 'No such payment' using errcode = '23503';
  end if;

  select deleted_at into v_closed from associations where id = v_payment.association_id;
  if not found or v_closed is not null then
    raise exception 'No such payment' using errcode = '23503';
  end if;

  if not has_capability(v_payment.association_id, 'finances') then
    raise exception 'You cannot reverse a payment for that home' using errcode = '42501';
  end if;

  -- The same lock the other money functions take, so a reversal and a dues
  -- run for one association take turns.
  perform pg_advisory_xact_lock(hashtext('dues:' || v_payment.association_id::text));

  -- Read again under the row lock: two reversals of one payment take turns
  -- and the second finds the first one's state.
  select * into v_payment from payments where id = p_payment_id for update;

  if v_payment.stripe_payment_intent_id is not null then
    raise exception 'This payment came through Stripe. Refund it in Stripe and it is booked here.'
      using errcode = '22000';
  end if;
  if v_payment.rail not in ('check', 'cash') then
    raise exception 'Only a check or cash payment can be reversed here' using errcode = '22000';
  end if;
  if v_payment.state = 'refunded' or v_payment.refunded_cents > 0 then
    raise exception 'That payment was already reversed.' using errcode = '22000';
  end if;
  if v_payment.state <> 'settled' then
    raise exception 'Only a settled payment can be reversed' using errcode = '22000';
  end if;

  update payments
     set refunded_cents = amount_cents,
         state = 'refunded'
   where id = v_payment.id;

  select label into v_unit_label from units where id = v_payment.unit_id;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  values (
    v_payment.association_id,
    v_payment.unit_id,
    'charge',
    -- Not dues, as the refund line is not.
    'other',
    'Payment reversed: ' || v_reason,
    v_payment.amount_cents,
    current_date
  );

  select id into v_operating
  from bank_accounts
  where association_id = v_payment.association_id and kind = 'operating'
  limit 1;

  insert into ledger_entries (
    association_id, bank_account_id, occurred_on, description,
    counterparty, category, amount_cents, confirmed_at, payment_id
  )
  values (
    v_payment.association_id,
    v_operating,
    current_date,
    'Payment reversed, unit ' || coalesce(v_unit_label, '?'),
    'Owner',
    'Assessments',
    -v_payment.amount_cents,
    now(),
    v_payment.id
  );

  -- The payments trigger (0059) logs an insert only, so the reversal is
  -- written here.
  perform record_activity(v_payment.association_id, 'payment', v_payment.id,
    format('Payment of $%s reversed for %s: %s',
      to_char(v_payment.amount_cents / 100.0, 'FM999,999,990.00'),
      coalesce(v_unit_label, 'a home'), v_reason),
    jsonb_build_object('unit_id', v_payment.unit_id, 'amount_cents', v_payment.amount_cents,
                       'rail', v_payment.rail, 'reason', v_reason));

  return v_payment.id;
end;
$$;

-- By name: Supabase's default grants give anon EXECUTE, and revoking from
-- public does not touch them (see 0062). Signed in only, so anon stays out.
revoke all on function reverse_manual_payment(uuid, text) from public;
revoke execute on function reverse_manual_payment(uuid, text) from anon;
grant execute on function reverse_manual_payment(uuid, text) to authenticated;
grant execute on function reverse_manual_payment(uuid, text) to service_role;
