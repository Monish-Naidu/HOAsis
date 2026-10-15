-- A closed year stays closed, a ballot with votes stays what it was voted
-- on, and the processing fee line stops naming the home.
--
-- Three things the 2026-10-15 walk found, each small:
--
-- 1. A hand payment or reversal dated into a closed fiscal year was accepted
--    without a word. The closed year's card keeps the figures copied at the
--    close (0109) while Transactions, Statements and the next year's brought
--    forward all moved, so two screens disagreed on a year the board had
--    put to bed. 0109 says a board that must post into a closed year reopens
--    it first; nothing enforced that. Now a money row dated inside a closed
--    year (closed_at set, not reopened) is refused by a trigger on charges
--    and ledger_entries, which every money function and the sale flow write
--    through. The daily jobs date their rows today, so they never hit it.
--
-- 2. ballots_write and ballot_options_write (0005) are "for all" for any seat
--    with the voting capability, so a ballot people had voted on could be
--    relabelled, its choices renamed or removed, or the whole thing deleted
--    (the votes go with it), through the REST API, with nothing logged.
--    Once a ballot has a vote, its question and choices are fixed: only the
--    columns the close, the certification, the results email and the seating
--    write (0118) may change, and nothing may be deleted.
--
-- 3. record_payment (0106) wrote "Processing fee, unit 7" on the ledger. The
--    funds list every owner reads shows the association's ledger, so every
--    owner could see which home paid, and "unit" is a word the product does
--    not use for a home. The line now says "Processing fee"; the payment_id
--    column still ties it to the payment for the board.

-- ------------------------------------------------------ 1. closed years

create or replace function money_year_is_open()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_on date := case tg_table_name when 'charges' then (to_jsonb(new) ->> 'due_on')::date
                                  else (to_jsonb(new) ->> 'occurred_on')::date end;
begin
  if exists (
    select 1 from fiscal_years fy
    where fy.association_id = new.association_id
      and fy.reopened_at is null
      and v_on between fy.starts_on and fy.ends_on
  ) then
    raise exception 'That year is closed. Reopen it on Finances before posting into it.'
      using errcode = '22000';
  end if;
  return new;
end;
$$;

revoke all on function money_year_is_open() from public;
revoke execute on function money_year_is_open() from anon, authenticated;

drop trigger if exists money_year_is_open on charges;
create trigger money_year_is_open
  before insert on charges
  for each row execute function money_year_is_open();

drop trigger if exists money_year_is_open on ledger_entries;
create trigger money_year_is_open
  before insert on ledger_entries
  for each row execute function money_year_is_open();

-- ------------------------------------------------- 2. ballots with votes

create or replace function ballot_with_votes_is_fixed()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ballot uuid := case tg_table_name when 'ballots' then coalesce(old.id, new.id)
                                      else coalesce(old.ballot_id, new.ballot_id) end;
begin
  if not exists (select 1 from votes v where v.ballot_id = v_ballot) then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'A ballot people have voted on is kept. Close it instead.'
      using errcode = '42501';
  end if;
  if tg_table_name = 'ballots'
     and (to_jsonb(new) - 'status' - 'closes_on' - 'live_results_visible'
            - 'certified_by' - 'certified_on' - 'results_emailed_at'
            - 'winners_seated' - 'winners_seated_on' - 'winners_seated_by')
       = (to_jsonb(old) - 'status' - 'closes_on' - 'live_results_visible'
            - 'certified_by' - 'certified_on' - 'results_emailed_at'
            - 'winners_seated' - 'winners_seated_on' - 'winners_seated_by') then
    return new;
  end if;
  raise exception 'A ballot people have voted on cannot be changed. Close it and open a new one.'
    using errcode = '42501';
end;
$$;

revoke all on function ballot_with_votes_is_fixed() from public;
revoke execute on function ballot_with_votes_is_fixed() from anon, authenticated;

drop trigger if exists ballot_with_votes_is_fixed on ballots;
create trigger ballot_with_votes_is_fixed
  before update or delete on ballots
  for each row execute function ballot_with_votes_is_fixed();

drop trigger if exists ballot_with_votes_is_fixed on ballot_options;
create trigger ballot_with_votes_is_fixed
  before update or delete on ballot_options
  for each row execute function ballot_with_votes_is_fixed();

-- ------------------------------------------- 3. the processing fee line

-- Copied whole from 0106: the signature, the security settings, the fee
-- arithmetic, the allocation and the grants are as they were. The one change
-- is the description of the fee line.
create or replace function record_payment(
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
  -- Append-only money (0106): this function may settle its own payment row.
  perform set_config('app.money_write', 'function', true);
  if p_amount_cents <= 0 then
    raise exception 'A payment has to be for a positive amount' using errcode = '22000';
  end if;

  select association_id, label into v_association, v_unit_label
  from units where id = p_unit_id;

  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  -- Two callers may write a payment. The server, when the processor says the
  -- money moved (the webhook and autopay, under the service role). And a
  -- finance holder, which is how a cheque that arrived in the post gets onto
  -- the books; the activity record names them.
  --
  -- An owner may not. Until 0062 an owner could call this for their own home
  -- from the browser and clear their balance with no money moving, and a
  -- caller with no session at all was taken for the server because both have
  -- a null auth.uid(). The role is what tells them apart.
  if coalesce(auth.role(), '') <> 'service_role'
     and not has_capability(v_association, 'finances') then
    raise exception 'You cannot record a payment for that home' using errcode = '42501';
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

  -- The whole payment comes in, and the fee goes out as its own line, so
  -- the board can see where the difference went. The net to the bank is
  -- the same as before; only the telling changed (0101).
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
    p_amount_cents,
    -- Money we moved ourselves needs no human to confirm it. A line that
    -- arrived from a bank feed is the one that does.
    now(),
    v_payment
  );
  if v_absorbed > 0 then
    insert into ledger_entries (
      association_id, bank_account_id, occurred_on, description,
      counterparty, category, amount_cents, confirmed_at, payment_id
    )
    values (
      v_association,
      v_operating,
      current_date,
      'Processing fee',
      'Stripe',
      'Processing fees',
      -v_absorbed,
      now(),
      v_payment
    );
  end if;

  return v_payment;
end;
$$;

revoke all on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) from public;
revoke execute on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) from anon;
grant execute on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) to authenticated;
grant execute on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) to service_role;
