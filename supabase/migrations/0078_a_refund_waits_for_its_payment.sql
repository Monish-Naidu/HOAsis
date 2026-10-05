-- A refund waits for its payment.
--
-- Stripe delivers events out of order. record_refund (0070) booked against
-- any payments row that carried the intent, a pending one included: the
-- row the webhook writes when a bank payment starts processing, before the
-- money is recorded. So when charge.refunded arrived ahead of a delayed
-- payment_intent.succeeded:
--
--   the refund was booked, a charge on the owner's statement and a debit
--     in the books, against a credit that had never been written;
--   a full refund marked the row refunded;
--   record_payment (0062) does nothing on a refunded row, so when the
--     payment did arrive its credit was never booked.
--
-- The statement then carried a refund with no payment under it, so the
-- home owed the amount twice, and the books were short by a deposit they
-- never showed.
--
-- Now a refund against a payment that is still pending books nothing and
-- returns null, exactly as it does when no payment carries the intent. The
-- webhook already reads null for one of our intents as "not recorded yet"
-- and answers Stripe with a 500 (src/app/api/stripe/webhook/route.ts), so
-- the event is sent again. By then record_payment has settled the row, and
-- the refund is booked against a payment that exists.
--
-- record_refund is copied whole from 0070, the latest, with that one
-- condition added. The signature and the grants are unchanged.

create or replace function record_refund(
  p_stripe_payment_intent_id text,
  -- The total refunded on the charge so far, as Stripe reports it
  -- (charge.amount_refunded). Not the size of this one refund.
  p_amount_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment     payments%rowtype;
  v_unit_label  text;
  v_operating   uuid;
  v_before      integer;
  v_statement   integer;
  v_books       integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Refunds are recorded by the processor only' using errcode = '42501';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'A refund has to be for a positive amount' using errcode = '22000';
  end if;

  -- The row lock means two deliveries of the same event take turns here
  -- and the second finds the first one's total already stored.
  select * into v_payment
  from payments
  where stripe_payment_intent_id = p_stripe_payment_intent_id
  for update;

  if v_payment.id is null then
    return null;
  end if;

  -- Still pending, or failed once and being tried again: the money has not
  -- been recorded as arrived, so there is nothing here to take back yet. Nothing is booked and the caller is told
  -- so, the same as for no payment at all.
  if v_payment.state in ('pending', 'failed') then
    return null;
  end if;

  -- Nothing new: a redelivery, or an older event arriving late.
  v_before := v_payment.refunded_cents;
  if p_amount_cents <= v_before then
    return v_payment.id;
  end if;

  -- The owner's statement was credited amount_cents and no more, so that is
  -- the most a refund can put back on it. The books lose all of it.
  v_statement := least(p_amount_cents, v_payment.amount_cents)
               - least(v_before, v_payment.amount_cents);
  v_books := p_amount_cents - v_before;

  update payments
     set refunded_cents = p_amount_cents,
         state = case
                   when p_amount_cents >= amount_cents then 'refunded'::payment_state
                   else state
                 end
   where id = v_payment.id;

  select label into v_unit_label from units where id = v_payment.unit_id;

  if v_statement > 0 then
    insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
    values (
      v_payment.association_id,
      v_payment.unit_id,
      'charge',
      -- Not dues: nothing bills, skips or charges a late fee on account of
      -- this line.
      'other',
      'Refund of ' || case v_payment.rail when 'ach' then 'bank payment' else 'card payment' end,
      v_statement,
      current_date
    );
  end if;

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
    'Refund, unit ' || coalesce(v_unit_label, '?'),
    'Owner',
    'Assessments',
    -v_books,
    now(),
    v_payment.id
  );

  return v_payment.id;
end;
$$;

-- The processor's path only, as 0062 left it.
revoke all on function record_refund(text, integer) from public;
revoke execute on function record_refund(text, integer) from anon, authenticated;
