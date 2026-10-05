-- The money functions answer to the right callers, and late fees read the
-- statement.
--
-- Found by the 2026-10-04 audit, each traced and then probed against this
-- project (with an id that matches nothing, so no row was written).
--
-- 1. A caller with no session was taken for the server. record_payment,
--    issue_assessment, assess_late_fees and record_refund all trusted a null
--    auth.uid(), on the reasoning that only the service role has one. So
--    does a visitor holding nothing but the public key, and Supabase's
--    default grants give that visitor EXECUTE; `revoke ... from public` never
--    touched it. Anyone could mark any home paid, bill any association, or
--    post a late fee on every open line. Now the role is checked, and anon
--    cannot call them at all.
--
-- 2. An owner could clear their own balance. record_payment let a member
--    record a payment for their own home, a leftover from before Stripe.
--    Real payments arrive by webhook; a cheque is recorded by a finance
--    holder. Nothing else.
--
-- 3. Late fees landed on homes that owed nothing. See the comment in
--    assess_late_fees.
--
-- 4. Dues emails read every balance as zero. See email_recipients.
--
-- Everything else in each function is as it was: record_payment from 0022,
-- issue_assessment from 0056, record_refund from 0049, assess_late_fees from
-- 0058, email_recipients from 0027. All five are replaced here in one file
-- on purpose, so two migrations cannot undo each other.

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

create or replace function issue_assessment(
  p_association_id uuid,
  p_label          text,
  p_due_on         date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer := 0;
  v_dues   integer;
  v_bytype jsonb;
  v_starts date;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  select dues_cents, dues_by_type, coalesce(billing_starts_on, created_at::date)
    into v_dues, v_bytype, v_starts
    from associations where id = p_association_id;
  if v_dues is null or v_dues <= 0 then
    return 0;
  end if;
  if p_due_on < v_starts then
    return 0;
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select p_association_id, u.id, 'charge', 'dues', p_label,
         coalesce(nullif((v_bytype ->> u.home_type::text)::integer, 0), v_dues),
         p_due_on
  from units u
  where u.association_id = p_association_id
    and not exists (
      select 1 from charges c
      where c.unit_id = u.id
        and c.kind = 'charge'
        and c.category = 'dues'
        and c.due_on = p_due_on
    )
    and not exists (
      select 1 from charges c
      where c.unit_id = u.id
        and c.label = 'Balance brought forward'
        and c.due_on >= p_due_on
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

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
  if coalesce(auth.role(), '') <> 'service_role' then
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

create or replace function assess_late_fees(
  p_association_id uuid,
  p_today          date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy     jsonb;
  v_notice_day integer;
  v_fee_cents  integer;
  v_count      integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  select coalesce(settings -> 'collectionPolicy', '{}'::jsonb)
    into v_policy
    from associations
   where id = p_association_id and deleted_at is null;
  if v_policy is null then
    return 0;
  end if;

  v_notice_day := coalesce((v_policy ->> 'lateNoticeDay')::integer, 30);
  v_fee_cents  := coalesce((v_policy ->> 'lateFeeCents')::integer, 2500);
  if v_fee_cents <= 0 or v_notice_day < 1 then
    return 0;
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select c.association_id, c.unit_id, 'charge', 'late_fee',
         'Late fee, ' || c.label, v_fee_cents, p_today
    from charges c
   where c.association_id = p_association_id
     and c.kind = 'charge'
     and c.category = 'dues'
     and c.due_on + v_notice_day <= p_today
     -- Still owed, read off the statement oldest first: this line is open
     -- only while the home owes more than everything billed after it. The
     -- allocation rows cannot answer this, because they are written at
     -- payment time against lines that already exist; money paid ahead, an
     -- opening credit, or a payment at closing never attaches to a later
     -- bill, and every such home read as unpaid.
     and (
           select coalesce(sum(x.amount_cents), 0) from charges x
            where x.unit_id = c.unit_id and x.due_on <= p_today
         ) > (
           select coalesce(sum(n.amount_cents), 0) from charges n
            where n.unit_id = c.unit_id and n.kind = 'charge' and n.due_on <= p_today
              and (n.due_on, n.created_at, n.id) > (c.due_on, c.created_at, c.id)
         )
     -- A bank payment takes days to clear and is on the statement only once
     -- it does. While one is in flight the home is left alone; the run is
     -- daily, so a payment that fails is picked up the next morning. Two
     -- weeks bounds it, so a row nobody ever settled cannot shield a home
     -- for good.
     and not exists (
           select 1 from payments p
            where p.unit_id = c.unit_id and p.state = 'pending'
              and p.created_at > now() - interval '14 days'
         )
     -- Once per dues line, ever.
     and not exists (
           select 1 from charges f
            where f.unit_id = c.unit_id
              and f.category = 'late_fee'
              and f.label = 'Late fee, ' || c.label
         );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function email_recipients(
  p_association_id uuid,
  p_category       email_category,
  p_only_past_due  boolean default false
)
returns table (
  profile_id uuid,
  unit_id    uuid,
  unit_label text,
  full_name  text,
  email      text,
  balance_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.profile_id,
    m.unit_id,
    u.label,
    m.full_name,
    coalesce(p.email, m.invited_email) as email,
    coalesce(b.balance_cents, 0)
  from memberships m
  join units u on u.id = m.unit_id
  left join profiles p on p.id = m.profile_id
  -- Summed here rather than read from unit_balances. That view answers by
  -- auth.uid(), and the mailer runs under the service role, which is nobody:
  -- every balance came back empty, so a past due run reached no one and an
  -- assessment email said $0.00. The figure is still only given to the
  -- server or a finance holder; anyone else gets zero, as before.
  left join lateral (
    select case
             when coalesce(auth.role(), '') = 'service_role'
               or has_capability(p_association_id, 'finances')
             then coalesce(sum(c.amount_cents), 0)::integer
             else 0
           end as balance_cents
      from charges c
     where c.unit_id = m.unit_id and c.due_on <= current_date
  ) b on true
  where m.association_id = p_association_id
    and m.ends_on is null
    and (auth.role() = 'service_role' or has_capability(p_association_id, 'communications'))
    and coalesce(p.email, m.invited_email) is not null
    and not exists (
      select 1 from email_optouts o
      where o.profile_id = m.profile_id and o.category = p_category
    )
    and (not p_only_past_due or coalesce(b.balance_cents, 0) > 0);
$$;

-- Closed to a visitor with no session. `revoke ... from public` is not
-- enough on Supabase: anon, authenticated and service_role each hold their
-- own grant.
revoke execute on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) from anon;
revoke execute on function issue_assessment(uuid, text, date) from anon;
revoke execute on function assess_late_fees(uuid, date) from anon;
revoke execute on function email_recipients(uuid, email_category, boolean) from anon;
-- The processor's path only.
revoke execute on function record_refund(text, integer) from anon, authenticated;
-- Called only from inside the activity triggers, which run as their owner.
-- Left open, anyone could write a row into any association's record under
-- the platform's name.
revoke execute on function record_activity(uuid, text, uuid, text, jsonb) from anon, authenticated;
revoke execute on function activity_actor(uuid) from anon, authenticated;
