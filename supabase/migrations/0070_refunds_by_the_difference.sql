-- A refund is booked for what came back, once, and never as a bill for a fee.
--
-- record_refund (0049, closed to browsers in 0062) had four faults, all
-- from treating one webhook as the whole story:
--
-- 1. A partial refund marked the whole payment refunded. $50 back out of
--    $285 read as a payment that never happened.
-- 2. Every refund after the first was dropped. Stripe sends the running
--    total refunded on the charge, so a second $50 arrives as 10000; the
--    function saw 'refunded', returned, and the second $50 never reached
--    the statement or the books.
-- 3. The owner was billed for a fee. The amount Stripe reports is of the
--    whole charge, which for older payments included a fee the owner paid
--    on top. The statement had been credited the dues alone, so a full
--    refund of a $302 charge put $302 back on a home that had paid $300 of
--    dues: the owner now owed $2 they never owed.
-- 4. The statement line took the column default and was filed as dues. The
--    late fee run then treated a refund as an unpaid dues bill, and a refund
--    dated on a due date made the billing run skip that home for the period.
--
-- Now payments.refunded_cents holds the running total Stripe has reported,
-- and each call books the difference from the last:
--
--   the statement rises by the part of the difference that falls within
--     what the payment credited (amount_cents), so the owner is never asked
--     for more than they were credited;
--   the books fall by the whole difference, because that is what left the
--     association's Stripe balance. These are direct charges, and a refund
--     takes the full charge back from the connected account, fee included;
--   the payment reads 'refunded' only once the whole of it has come back;
--   the line is filed as 'other', not dues.
--
-- A redelivered event, or one that arrives out of order with a smaller
-- total, finds nothing new and books nothing. The signature and the grants
-- are unchanged, and the webhook's call is as it was.
--
-- Payments refunded before today are given the total their ledger line
-- recorded, so a later event books only what is new. Their old lines are
-- left exactly as they are: correcting history is a decision for a person.

alter table payments
  add column if not exists refunded_cents integer not null default 0;

comment on column payments.refunded_cents is
  'The running total Stripe has refunded on this payment''s charge, in cents. May exceed amount_cents by a fee the owner paid on top.';

-- What the old function already booked for a payment it marked refunded.
-- The ledger line it wrote carries the amount; a payment whose line was
-- since removed is taken as refunded in full.
update payments p
   set refunded_cents = coalesce(
         (
           select (-sum(e.amount_cents))::integer
             from ledger_entries e
            where e.payment_id = p.id
              and e.amount_cents < 0
              and e.description like 'Refund, unit %'
         ),
         p.amount_cents
       )
 where p.state = 'refunded'
   and p.refunded_cents = 0;

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
