-- Recording a payment, now webhook-grade.
--
-- 0004 promised that when Stripe landed, the webhook would call record_payment
-- under the service role and nothing else would change. This makes that true:
--
--  * Stripe delivers webhooks at least once and out of order, so the intent id
--    becomes a real idempotency anchor: a retry of a settled payment is a
--    no-op, and a `processing` row inserted earlier settles in place instead
--    of becoming a second payment. Settled is terminal, never downgraded.
--  * The webhook has no auth.uid(), so p_paid_by carries the payer (from the
--    intent's metadata) and is trusted only on that path: a signed-in caller's
--    own id always wins.
--
-- The old signature is dropped explicitly rather than replaced. `create or
-- replace` with a different argument list would create an overload, and two
-- record_payment functions makes PostgREST's RPC dispatch ambiguous.

drop function if exists record_payment(
  uuid, integer, payment_rail, integer, integer, text, text
);

create function record_payment(
  p_unit_id         uuid,
  p_amount_cents    integer,
  p_rail            payment_rail,
  p_processor_fee_cents integer default 0,
  p_platform_fee_cents  integer default 0,
  -- Who ends up carrying our fee. Affects the deposit, not what the owner paid.
  p_platform_fee_paid_by text default 'association',
  p_stripe_payment_intent_id text default null,
  -- The payer, for the webhook path only; a signed-in caller is themselves.
  p_paid_by         uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller        uuid := auth.uid();
  v_payer         uuid;
  v_association   uuid;
  v_payment       uuid;
  v_existing_state payment_state;
  v_remaining     integer := p_amount_cents;
  v_take          integer;
  v_charge        record;
  v_operating     uuid;
  v_absorbed      integer;
  v_unit_label    text;
  v_payer_name    text;
begin
  if p_amount_cents <= 0 then
    raise exception 'A payment has to be for a positive amount' using errcode = '22000';
  end if;

  select association_id, label into v_association, v_unit_label
  from units where id = p_unit_id;

  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  -- A person may pay for their own home. A finance holder may record a payment
  -- for any home in their association, which is how a cheque that arrived in
  -- the post gets onto the books. Everyone else is refused.
  --
  -- v_caller is null when this runs under the service role, which is the
  -- webhook, and that path is trusted by definition because no browser reaches
  -- it.
  if v_caller is not null then
    if not exists (
      select 1 from memberships m
      where m.profile_id = v_caller and m.unit_id = p_unit_id and m.ends_on is null
    ) and not has_capability(v_association, 'finances') then
      raise exception 'You cannot record a payment for that home' using errcode = '42501';
    end if;
  end if;

  v_payer := coalesce(v_caller, p_paid_by);

  -- Webhook retries and out-of-order delivery. The row lock means two
  -- concurrent deliveries of the same event serialize here rather than both
  -- reading "no payment yet" and inserting twice.
  if p_stripe_payment_intent_id is not null then
    select id, state into v_payment, v_existing_state
    from payments
    where stripe_payment_intent_id = p_stripe_payment_intent_id
    for update;

    if v_payment is not null then
      if v_existing_state in ('settled', 'refunded') then
        return v_payment;
      end if;
      -- A pending row from the `processing` event, or a failed attempt that
      -- Stripe retried to success on the same intent: settle it in place.
      update payments
      set state = 'settled',
          amount_cents = p_amount_cents,
          processor_fee_cents = p_processor_fee_cents,
          platform_fee_cents = p_platform_fee_cents,
          paid_by = coalesce(paid_by, v_payer),
          settled_at = now()
      where id = v_payment;
    end if;
  end if;

  select full_name into v_payer_name
  from memberships
  where unit_id = p_unit_id and ends_on is null
  order by created_at
  limit 1;

  if v_payment is null then
    insert into payments (
      association_id, unit_id, paid_by, amount_cents,
      processor_fee_cents, platform_fee_cents, rail, state,
      stripe_payment_intent_id, settled_at
    )
    values (
      v_association, p_unit_id, v_payer, p_amount_cents,
      p_processor_fee_cents, p_platform_fee_cents, p_rail, 'settled',
      p_stripe_payment_intent_id, now()
    )
    returning id into v_payment;
  end if;

  -- The statement line. Negative, so the balance view falls by itself rather
  -- than by us storing a second number that could disagree with it.
  insert into charges (association_id, unit_id, kind, label, amount_cents, due_on)
  values (
    v_association,
    p_unit_id,
    'payment',
    case p_rail when 'ach' then 'Bank payment' else 'Card payment' end,
    -p_amount_cents,
    current_date
  );

  -- Applied to the oldest open charge first, which is what every collection
  -- policy assumes and what owners are told on the receipt.
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

  -- The association keeps the assessment; the processor takes its cut out of
  -- the deposit, and our fee only when the association agreed to carry it.
  v_absorbed := p_processor_fee_cents
    + case when p_platform_fee_paid_by = 'association' then p_platform_fee_cents else 0 end;

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
    current_date,
    'Assessment payment, unit ' || v_unit_label,
    coalesce(v_payer_name, 'Owner'),
    'Assessments',
    p_amount_cents - v_absorbed,
    -- Money we moved ourselves needs no human to confirm it. A line that
    -- arrived from a bank feed is the one that does.
    now(),
    v_payment
  );

  return v_payment;
end;
$$;

revoke all on function record_payment from public;
grant execute on function record_payment to authenticated;
