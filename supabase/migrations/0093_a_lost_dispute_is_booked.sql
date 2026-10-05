-- A lost dispute is booked.
--
-- When a cardholder's bank decides a dispute against the association, the
-- money is gone from the association's Stripe balance for good. Until now the
-- webhook emailed the people who hold finances and wrote a line on /admin,
-- and that was all: the owner's statement still said paid, the ledger still
-- showed the deposit, and "collected" counted money the bank had taken back.
-- The email said as much: "your books are ahead of the bank by this amount".
--
-- record_dispute_loss books it the way a refund is booked, by handing the new
-- running total to record_refund (0078): the amount goes back on the owner's
-- statement, leaves the ledger, and the payment reads refunded once the whole
-- of it has gone. The dues it had paid read as unpaid, and late, again
-- (0091). Stripe's own dispute fee is not booked here; it never touched the
-- owner's statement and the board sees it on Stripe.
--
-- Stripe can deliver the closing event more than once. The dispute's id is
-- kept on the payment, so a second delivery finds it and books nothing.
-- record_refund works from a running total and could not tell a redelivered
-- dispute from a second one, which is why the id is needed.

alter table payments add column if not exists dispute_lost_id text;

create or replace function record_dispute_loss(
  p_stripe_payment_intent_id text,
  p_dispute_id               text,
  -- The amount the bank took back for this dispute, as Stripe reports it.
  p_amount_cents             integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments%rowtype;
  v_total   integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Disputes are recorded by the processor only' using errcode = '42501';
  end if;
  if p_amount_cents <= 0 then
    raise exception 'A dispute has to be for a positive amount' using errcode = '22000';
  end if;
  if coalesce(btrim(p_dispute_id), '') = '' then
    raise exception 'A dispute needs its id' using errcode = '22000';
  end if;

  select * into v_payment
  from payments
  where stripe_payment_intent_id = p_stripe_payment_intent_id
  for update;

  -- No such payment, or not recorded as arrived yet: nothing to take back.
  -- The caller is told so, as record_refund tells it.
  if v_payment.id is null or v_payment.state in ('pending', 'failed') then
    return null;
  end if;

  -- This dispute is already on the books.
  if v_payment.dispute_lost_id = p_dispute_id then
    return v_payment.id;
  end if;

  -- Whatever was refunded before the dispute stays refunded; the dispute
  -- takes back its own amount on top, and never more than was paid.
  v_total := least(v_payment.amount_cents, coalesce(v_payment.refunded_cents, 0) + p_amount_cents);

  update payments set dispute_lost_id = p_dispute_id where id = v_payment.id;

  if v_total > coalesce(v_payment.refunded_cents, 0) then
    perform record_refund(p_stripe_payment_intent_id, v_total);
  end if;

  return v_payment.id;
end;
$$;

revoke all on function record_dispute_loss(text, text, integer) from public;
revoke execute on function record_dispute_loss(text, text, integer) from anon, authenticated;
grant execute on function record_dispute_loss(text, text, integer) to service_role;
