-- Stripe's own facts about an association, cached, and refunds in the books.
--
-- "Charges enabled" is Stripe's answer, not ours. It was read live on the
-- board's Settings screen and nowhere else, so a resident of an association
-- whose onboarding stalled still saw a pay form that Stripe would refuse at
-- the last step. The connect route and the account.updated webhook now write
-- the answer here, and the pay screen reads it like any other column.
--
-- The payout bank is the account Stripe sends dues to. The board typed it
-- into the setup wizard once and Stripe asked for it again during onboarding;
-- from now on the connected account is the source and the operating row is
-- filled in from it.

alter table associations
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payout_bank text,
  add column if not exists stripe_payout_last4 text;

-- A refund issued from the Stripe dashboard. The payment row keeps its
-- history and flips to refunded; the owner's statement gets the money back
-- as a charge (their balance rises by what was returned), and the books
-- lose the deposit. Idempotent on the intent: a redelivered event finds the
-- row already refunded and stops.
create or replace function record_refund(
  p_stripe_payment_intent_id text,
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
begin
  if auth.uid() is not null then
    raise exception 'Refunds are recorded by the processor only' using errcode = '42501';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'A refund has to be for a positive amount' using errcode = '22000';
  end if;

  select * into v_payment
  from payments
  where stripe_payment_intent_id = p_stripe_payment_intent_id
  for update;

  if v_payment.id is null then
    return null;
  end if;
  if v_payment.state = 'refunded' then
    return v_payment.id;
  end if;

  update payments set state = 'refunded' where id = v_payment.id;

  select label into v_unit_label from units where id = v_payment.unit_id;

  insert into charges (association_id, unit_id, kind, label, amount_cents, due_on)
  values (
    v_payment.association_id,
    v_payment.unit_id,
    'charge',
    'Refund of ' || case v_payment.rail when 'ach' then 'bank payment' else 'card payment' end,
    p_amount_cents,
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
    'Refund, unit ' || coalesce(v_unit_label, '?'),
    'Owner',
    'Assessments',
    -p_amount_cents,
    now(),
    v_payment.id
  );

  return v_payment.id;
end;
$$;

revoke all on function record_refund from public;
