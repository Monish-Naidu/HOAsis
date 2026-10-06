-- A locked board cannot act through the functions either.
--
-- 0105 made the board side read-only once the subscription is 14 days past
-- due or cancelled, with a trigger that refuses direct writes from a signed
-- in person. The functions a board acts through run as their owner, so the
-- trigger let them pass (that is also what keeps an owner's own payment
-- working). Each board-side function now asks assert_association_writable
-- right after its capability check, so "read-only" means read-only.
--
-- Every function below is copied whole from its latest definition with that
-- one line added. Grants are restated by name.

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
  perform assert_association_writable(v_association);

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
  -- Append-only money (0106): this function marks the payment refunded.
  perform set_config('app.money_write', 'function', true);
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
  perform assert_association_writable(v_payment.association_id);

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

create or replace function add_charge(
  p_unit_id      uuid,
  p_amount_cents integer,
  p_label        text,
  p_due_on       date
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
  v_closed      timestamptz;
  v_label       text := btrim(coalesce(p_label, ''));
  v_charge      uuid;
begin
  if v_caller is null then
    raise exception 'Sign in to add a charge' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 10000000 then
    raise exception 'A charge has to be between $0.01 and $100,000' using errcode = '22000';
  end if;
  if length(v_label) = 0 then
    raise exception 'Say what the charge is for' using errcode = '22000';
  end if;
  if length(v_label) > 80 then
    raise exception 'Keep what the charge is for to 80 characters' using errcode = '22000';
  end if;
  if p_due_on is null
     or p_due_on > current_date + 366
     or p_due_on < current_date - 366 then
    raise exception 'The due date has to be within a year of today' using errcode = '22000';
  end if;

  select u.association_id, u.label, a.deleted_at
    into v_association, v_unit_label, v_closed
  from units u
  join associations a on a.id = u.association_id
  where u.id = p_unit_id;
  if v_association is null or v_closed is not null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'finances') then
    raise exception 'You cannot add a charge for that home' using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  values (v_association, p_unit_id, 'charge', 'other', v_label, p_amount_cents, p_due_on)
  returning id into v_charge;

  perform record_activity(v_association, 'charge', v_charge,
    format('Charge of $%s added for %s: %s',
      to_char(p_amount_cents / 100.0, 'FM999,999,990.00'), coalesce(v_unit_label, 'a home'), v_label),
    jsonb_build_object('unit_id', p_unit_id, 'amount_cents', p_amount_cents, 'due_on', p_due_on));

  return v_charge;
end;
$$;

create or replace function add_charge_to_all(
  p_association_id uuid,
  p_amount_cents   integer,
  p_label          text,
  p_due_on         date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_label  text := btrim(coalesce(p_label, ''));
  v_count  integer := 0;
begin
  if v_caller is null then
    raise exception 'Sign in to add a charge' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 10000000 then
    raise exception 'A charge has to be between $0.01 and $100,000' using errcode = '22000';
  end if;
  if length(v_label) = 0 then
    raise exception 'Say what the charge is for' using errcode = '22000';
  end if;
  if length(v_label) > 80 then
    raise exception 'Keep what the charge is for to 80 characters' using errcode = '22000';
  end if;
  if p_due_on is null
     or p_due_on > current_date + 366
     or p_due_on < current_date - 366 then
    raise exception 'The due date has to be within a year of today' using errcode = '22000';
  end if;

  if not exists (
    select 1 from associations where id = p_association_id and deleted_at is null
  ) then
    raise exception 'No such association' using errcode = '23503';
  end if;

  if not has_capability(p_association_id, 'finances') then
    raise exception 'You cannot add a charge for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(p_association_id);

  -- The same lock the dues run and the late-fee run take, so a charge cannot
  -- land halfway through either.
  perform pg_advisory_xact_lock(hashtext('dues:' || p_association_id::text));

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select p_association_id, u.id, 'charge', 'other', v_label, p_amount_cents, p_due_on
  from units u
  where u.association_id = p_association_id
    and u.retired_on is null;

  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform record_activity(p_association_id, 'charge', null,
      format('Charge of $%s added to %s homes: %s',
        to_char(p_amount_cents / 100.0, 'FM999,999,990.00'), v_count, v_label),
      jsonb_build_object('homes', v_count, 'amount_cents', p_amount_cents, 'due_on', p_due_on));
  end if;

  return v_count;
end;
$$;

create or replace function add_credit(
  p_unit_id      uuid,
  p_amount_cents integer,
  p_label        text
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
  v_closed      timestamptz;
  v_label       text := btrim(coalesce(p_label, ''));
  v_credit      uuid;
begin
  if v_caller is null then
    raise exception 'Sign in to add a credit' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 10000000 then
    raise exception 'A credit has to be between $0.01 and $100,000' using errcode = '22000';
  end if;
  if length(v_label) = 0 then
    raise exception 'Say what the credit is for' using errcode = '22000';
  end if;
  if length(v_label) > 80 then
    raise exception 'Keep what the credit is for to 80 characters' using errcode = '22000';
  end if;

  select u.association_id, u.label, a.deleted_at
    into v_association, v_unit_label, v_closed
  from units u
  join associations a on a.id = u.association_id
  where u.id = p_unit_id;
  if v_association is null or v_closed is not null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'finances') then
    raise exception 'You cannot add a credit for that home' using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);

  insert into charges (association_id, unit_id, kind, label, amount_cents, due_on)
  values (v_association, p_unit_id, 'credit', v_label, -p_amount_cents, current_date)
  returning id into v_credit;

  perform record_activity(v_association, 'charge', v_credit,
    format('Credit of $%s added for %s: %s',
      to_char(p_amount_cents / 100.0, 'FM999,999,990.00'), coalesce(v_unit_label, 'a home'), v_label),
    jsonb_build_object('unit_id', p_unit_id, 'home', v_unit_label, 'amount_cents', -p_amount_cents));

  return v_credit;
end;
$$;

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
  v_label       text;
  v_was         integer;
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

  select association_id, label, dues_cents into v_association, v_label, v_was
    from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not (has_capability(v_association, 'finances')
          or has_capability(v_association, 'settings')) then
    raise exception 'You cannot change dues for that home' using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);

  update units set dues_cents = p_dues_cents where id = p_unit_id;

  if p_dues_cents is distinct from v_was then
    perform record_activity(v_association, 'unit', p_unit_id,
      case when p_dues_cents is null
        then format('Dues for %s set back to the standard amount', v_label)
        else format('Dues for %s set to $%s', v_label, to_char(p_dues_cents / 100.0, 'FM999,999,990.00'))
      end,
      jsonb_build_object('unit_id', p_unit_id, 'home', v_label,
                         'from_cents', v_was, 'to_cents', p_dues_cents));
  end if;
end;
$$;

create or replace function approve_payout(p_payout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_payout    payouts%rowtype;
  v_name      text;
  v_approvals jsonb;
begin
  if v_caller is null then
    raise exception 'Sign in to approve a payment' using errcode = '42501';
  end if;

  select * into v_payout from payouts where id = p_payout_id for update;
  if not found then
    raise exception 'No such payment' using errcode = '23503';
  end if;
  if not has_capability(v_payout.association_id, 'finances') then
    raise exception 'You cannot approve payments for this association' using errcode = '42501';
  end if;
  perform assert_association_writable(v_payout.association_id);

  select m.full_name into v_name
    from memberships m
   where m.association_id = v_payout.association_id
     and m.profile_id = v_caller
     and m.ends_on is null
   order by m.starts_on
   limit 1;
  if v_name is null then
    raise exception 'You do not hold a seat in this association' using errcode = '42501';
  end if;

  -- Already signed: nothing changes and the list is handed back, so a
  -- second press is quiet rather than an error.
  if exists (
    select 1 from jsonb_array_elements(v_payout.approvals) a
     where a ->> 'profileId' = v_caller::text
        or (a ->> 'profileId' is null and a ->> 'name' = v_name)
  ) then
    return v_payout.approvals;
  end if;

  v_approvals := v_payout.approvals || jsonb_build_array(jsonb_build_object(
    'name', v_name,
    'at', to_char(current_date, 'YYYY-MM-DD'),
    'profileId', v_caller
  ));

  update payouts
     set approvals = v_approvals,
         status = case
           when status = 'needs-approval' and jsonb_array_length(v_approvals) >= approvals_required
             then 'scheduled'
           else status
         end
   where id = v_payout.id;

  return v_approvals;
end;
$$;

create or replace function reverse_ledger_entry(
  p_entry_id uuid,
  p_reason   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_entry    ledger_entries%rowtype;
  v_closed   timestamptz;
  v_new      uuid;
begin
  if v_caller is null then
    raise exception 'Sign in to reverse a transaction' using errcode = '42501';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 120 then
    raise exception 'Say why, in 3 to 120 characters' using errcode = '22000';
  end if;

  select * into v_entry from ledger_entries where id = p_entry_id;
  if v_entry.id is null then
    raise exception 'No such transaction' using errcode = '23503';
  end if;

  select deleted_at into v_closed from associations where id = v_entry.association_id;
  if not found or v_closed is not null then
    raise exception 'No such transaction' using errcode = '23503';
  end if;

  if not has_capability(v_entry.association_id, 'finances') then
    raise exception 'You cannot reverse a transaction for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(v_entry.association_id);

  -- Read again under the row lock: two reversals of one line take turns and
  -- the second finds the first.
  select * into v_entry from ledger_entries where id = p_entry_id for update;

  if v_entry.reversed_entry_id is not null then
    raise exception 'That line is already a reversal.' using errcode = '22000';
  end if;
  if exists (select 1 from ledger_entries where reversed_entry_id = v_entry.id) then
    raise exception 'That line was already reversed.' using errcode = '22000';
  end if;
  -- A payment's lines are taken back with the payment, so the statement, the
  -- payment and the books stay in step.
  if v_entry.payment_id is not null then
    raise exception 'That line belongs to a payment. Reverse or refund the payment instead.'
      using errcode = '22000';
  end if;

  insert into ledger_entries (
    association_id, bank_account_id, occurred_on, description,
    counterparty, category, amount_cents, confirmed_at, reversed_entry_id
  )
  values (
    v_entry.association_id,
    v_entry.bank_account_id,
    current_date,
    'Reversal: ' || v_entry.description,
    v_entry.counterparty,
    v_entry.category,
    -v_entry.amount_cents,
    -- A person did this on purpose, so it needs no one to confirm it.
    now(),
    v_entry.id
  )
  returning id into v_new;

  perform record_activity(v_entry.association_id, 'ledger', v_new,
    format('Transaction reversed: %s ($%s): %s',
      v_entry.description,
      to_char(abs(v_entry.amount_cents) / 100.0, 'FM999,999,990.00'),
      v_reason),
    jsonb_build_object('reversed_entry_id', v_entry.id, 'amount_cents', -v_entry.amount_cents,
                       'reason', v_reason));

  return v_new;
end;
$$;

create or replace function confirm_ledger_entry(
  p_entry_id uuid,
  p_category text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_entry    ledger_entries%rowtype;
  v_closed   timestamptz;
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
begin
  if v_caller is null then
    raise exception 'Sign in to confirm a transaction' using errcode = '42501';
  end if;
  if v_category is not null and length(v_category) > 60 then
    raise exception 'Keep the category to 60 characters' using errcode = '22000';
  end if;

  select * into v_entry from ledger_entries where id = p_entry_id for update;
  if v_entry.id is null then
    raise exception 'No such transaction' using errcode = '23503';
  end if;

  select deleted_at into v_closed from associations where id = v_entry.association_id;
  if not found or v_closed is not null then
    raise exception 'No such transaction' using errcode = '23503';
  end if;

  if not has_capability(v_entry.association_id, 'finances') then
    raise exception 'You cannot confirm a transaction for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(v_entry.association_id);

  if v_entry.confirmed_at is not null then
    raise exception 'That transaction is already confirmed.' using errcode = '22000';
  end if;

  perform set_config('app.money_write', 'function', true);

  update ledger_entries
     set confirmed_at = now(),
         category = coalesce(v_category, category)
   where id = v_entry.id;

  perform record_activity(v_entry.association_id, 'ledger', v_entry.id,
    format('Transaction confirmed: %s ($%s)',
      v_entry.description,
      to_char(abs(v_entry.amount_cents) / 100.0, 'FM999,999,990.00')),
    jsonb_build_object('amount_cents', v_entry.amount_cents,
                       'category', coalesce(v_category, v_entry.category)));
end;
$$;

create or replace function transfer_home(
  p_unit_id      uuid,
  p_new_name     text,
  p_new_email    text,
  p_closing_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_latest_start date;
  v_new         uuid;
begin
  select association_id into v_association from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'settings')
     and not has_capability(v_association, 'finances') then
    raise exception 'Recording a sale needs the settings or money capability'
      using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);

  if coalesce(trim(p_new_name), '') = '' then
    raise exception 'The new owner needs a name' using errcode = '22000';
  end if;

  -- A sale takes effect when it is recorded, whatever its date. One day of
  -- grace, because the database keeps UTC and an evening closing in the
  -- United States is already tomorrow there.
  if p_closing_date > current_date + 1 then
    raise exception 'Closing has not happened yet. Record the sale on or after %.', p_closing_date
      using errcode = '22000';
  end if;

  select max(starts_on) into v_latest_start
  from memberships
  where unit_id = p_unit_id and ends_on is null;

  if v_latest_start is not null then
    if p_closing_date < v_latest_start then
      raise exception
        'The closing date is before the current owner''s tenure began on %. Check the date.',
        v_latest_start
        using errcode = '22000';
    end if;

    -- A President cannot be sold out of the association without handing over
    -- the office first, or nobody can grant access back.
    if exists (
      select 1 from memberships
      where unit_id = p_unit_id and ends_on is null and role = 'president'
    ) then
      raise exception
        'This home is held by the President. Hand over the office before recording the sale.'
        using errcode = '23514';
    end if;

    update memberships set ends_on = p_closing_date
    where unit_id = p_unit_id and ends_on is null;
  end if;

  insert into memberships (
    association_id, unit_id, profile_id, invited_email, full_name,
    role, capabilities, starts_on
  )
  values (
    v_association, p_unit_id, null,
    nullif(trim(coalesce(p_new_email, '')), ''),
    trim(p_new_name), 'resident', '{}'::capability[], p_closing_date
  )
  returning id into v_new;

  return v_new;
end;
$$;

create or replace function retire_home(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_balance     integer;
begin
  select association_id into v_association from units where id = p_unit_id and retired_on is null;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if not has_capability(v_association, 'settings') then
    raise exception 'Only a settings holder can retire a home' using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);
  if exists (
    select 1 from memberships
     where unit_id = p_unit_id and role = 'president' and ends_on is null
  ) then
    raise exception 'Transfer the presidency before retiring this home' using errcode = '42501';
  end if;
  select coalesce(sum(amount_cents), 0) into v_balance from charges where unit_id = p_unit_id;
  if v_balance <> 0 then
    raise exception 'This home''s balance is not zero. Settle it first, then retire the home.'
      using errcode = '22000';
  end if;
  if exists (
    select 1 from payments where unit_id = p_unit_id and state = 'pending'
  ) then
    raise exception 'A payment is still clearing on this home. Wait for it, then retire the home.'
      using errcode = '22000';
  end if;

  update memberships
     set ends_on = greatest(current_date, starts_on), autopay = null
   where unit_id = p_unit_id and ends_on is null;
  update units set retired_on = current_date where id = p_unit_id;
end;
$$;

create or replace function remove_owner(p_membership_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat memberships%rowtype;
  v_open integer;
begin
  select * into v_seat from memberships where id = p_membership_id for update;
  if not found or v_seat.unit_id is null then
    raise exception 'No such owner' using errcode = '22000';
  end if;

  -- The service role has no auth.uid(); the signed in rule is the one
  -- add_second_owner asks, and the service role is let through as elsewhere.
  -- coalesce, because auth.role() is null with no claims and a null here
  -- would let the check pass.
  if not (coalesce(auth.role(), '') = 'service_role'
          or has_capability(v_seat.association_id, 'settings')) then
    raise exception 'Only a settings holder can remove an owner' using errcode = '42501';
  end if;
  perform assert_association_writable(v_seat.association_id);

  if v_seat.ends_on is not null then
    raise exception 'That owner has already been removed' using errcode = '22000';
  end if;

  if v_seat.profile_id is not null and v_seat.profile_id = auth.uid() then
    raise exception 'To leave this association yourself, use Leave this association in your own settings'
      using errcode = '22000';
  end if;

  if v_seat.role = 'president' then
    raise exception 'Hand over the presidency first.' using errcode = '23514';
  end if;

  if v_seat.role <> 'resident'
     or coalesce(cardinality(v_seat.capabilities), 0) > 0
     or coalesce(cardinality(v_seat.views), 0) > 0 then
    raise exception 'Take this person off the board first.' using errcode = '23514';
  end if;

  select count(*) into v_open
    from memberships
   where unit_id = v_seat.unit_id and ends_on is null;
  if v_open < 2 then
    raise exception 'This is the home''s only owner. Record a sale instead.' using errcode = '22000';
  end if;

  -- No seat may end before it began, as transfer_home checks. starts_on
  -- defaults to the day the row was made, so this is a seat made today.
  update memberships
     set ends_on  = greatest(current_date, v_seat.starts_on),
         autopay  = null
   where id = v_seat.id;

  return v_seat.unit_id;
end;
$$;

create or replace function reply_as_board(p_thread_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread   threads%rowtype;
  v_messages jsonb;
  v_name     text;
  v_role     text;
  v_message  jsonb;
  v_home     text;
begin
  if coalesce(trim(p_body), '') = '' then
    raise exception 'Write a few words first' using errcode = '22000';
  end if;

  -- Locked, so two replies sent in the same second take turns and each is
  -- appended to what the other left.
  select * into v_thread from threads where id = p_thread_id for update;

  -- The same rule as threads_write. A thread that does not exist gets the
  -- same answer as one the caller may not touch.
  if v_thread.id is null
     or not (
       has_capability(v_thread.association_id, 'communications')
       or (v_thread.tag = 'Billing' and has_capability(v_thread.association_id, 'finances'))
     ) then
    raise exception 'That conversation is not yours to answer' using errcode = '42501';
  end if;
  perform assert_association_writable(v_thread.association_id);

  v_messages := case
    when jsonb_typeof(v_thread.messages) = 'array' then v_thread.messages
    else '[]'::jsonb
  end;

  -- The sender as their seat names them in this association, which is the
  -- name the browser put on a reply, and the office that seat holds.
  select m.full_name, m.role::text into v_name, v_role
    from memberships m
   where m.association_id = v_thread.association_id
     and m.profile_id = auth.uid()
     and m.ends_on is null
   order by m.created_at
   limit 1;

  v_message := jsonb_build_object(
    'id', 'm-' || p_thread_id::text || '-' || jsonb_array_length(v_messages)::text,
    'at', current_date::text,
    'from', coalesce(nullif(trim(v_name), ''), 'Board'),
    'fromRole', 'board',
    'direction', 'outbound',
    -- The client emails the owner once this returns, as it does today.
    'channel', 'email',
    'body', trim(p_body)
  );
  -- Only an office, never 'resident'. A seat with no office signs as the board.
  if v_role in ('president', 'vice-president', 'treasurer', 'secretary') then
    v_message := v_message || jsonb_build_object('fromOffice', v_role);
  end if;

  update threads
     set messages = v_messages || jsonb_build_array(v_message),
         unread = false,
         updated_on = current_date
   where id = p_thread_id;

  select label into v_home from units where id = v_thread.unit_id;
  perform record_activity(v_thread.association_id, 'thread', p_thread_id,
    case when v_home is null then 'Reply posted to an owner'
         else format('Reply posted to %s', v_home) end,
    jsonb_build_object('unit_id', v_thread.unit_id, 'home', v_home, 'subject', v_thread.subject));

  return v_message;
end;
$$;

create or replace function add_second_owner(
  p_unit_id uuid,
  p_name    text,
  p_email   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc uuid;
begin
  select association_id into v_assoc from units where id = p_unit_id;
  if v_assoc is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if not has_capability(v_assoc, 'settings') then
    raise exception 'Only a settings holder can add an owner' using errcode = '42501';
  end if;
  perform assert_association_writable(v_assoc);
  if btrim(coalesce(p_email, '')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A second owner needs a working email address to sign in with' using errcode = '22000';
  end if;
  if not exists (
    select 1 from memberships
     where unit_id = p_unit_id and ends_on is null and btrim(full_name) <> ''
  ) then
    raise exception 'Name the first owner before adding a second' using errcode = '22000';
  end if;
  return add_unit_owner_seat(p_unit_id, p_name, p_email);
end;
$$;

create or replace function change_owner_email(
  p_unit_id   uuid,
  p_old_email text,
  p_new_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc   uuid;
  v_old     text := lower(btrim(coalesce(p_old_email, '')));
  v_new     text := btrim(coalesce(p_new_email, ''));
  v_seat    memberships%rowtype;
  v_profile uuid;
begin
  select association_id into v_assoc from units where id = p_unit_id;
  if v_assoc is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if not has_capability(v_assoc, 'settings') then
    raise exception 'Only a settings holder can change an owner''s email' using errcode = '42501';
  end if;
  perform assert_association_writable(v_assoc);
  if v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address does not look right' using errcode = '22000';
  end if;

  select * into v_seat from memberships
   where unit_id = p_unit_id
     and ends_on is null
     and btrim(full_name) <> ''
     and lower(coalesce(invited_email, '')) = v_old
   order by starts_on, created_at, id
   limit 1;
  if not found then
    raise exception 'No owner of this home has that email' using errcode = '22000';
  end if;
  if v_seat.profile_id is not null then
    raise exception 'They have already signed in. Their email is theirs to change' using errcode = '22000';
  end if;
  if exists (
    select 1 from memberships m
     where m.unit_id = p_unit_id and m.ends_on is null and m.id <> v_seat.id
       and lower(m.invited_email) = lower(v_new)
  ) then
    raise exception 'Another owner of this home already has that email' using errcode = '23505';
  end if;

  select id into v_profile from profiles where lower(email) = lower(v_new) limit 1;
  if v_profile is not null and exists (
    select 1 from memberships m
     where m.unit_id = p_unit_id and m.ends_on is null and m.profile_id = v_profile
  ) then
    v_profile := null;
  end if;

  update memberships
     set invited_email = v_new,
         profile_id    = v_profile
   where id = v_seat.id;
  return v_seat.id;
end;
$$;

create or replace function seat_join_request(
  p_request_id uuid,
  p_unit_id    uuid,
  p_as_second  boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req     join_requests%rowtype;
  v_email   text;
  v_profile uuid;
  v_first   memberships%rowtype;
  v_any       boolean;
  v_has_owner boolean;
begin
  select * into v_req from join_requests where id = p_request_id;
  if not found then
    raise exception 'No such request' using errcode = '22000';
  end if;
  if not has_capability(v_req.association_id, 'settings') then
    raise exception 'Only a settings holder can let somebody in' using errcode = '42501';
  end if;
  perform assert_association_writable(v_req.association_id);
  if not exists (select 1 from units where id = p_unit_id and association_id = v_req.association_id) then
    raise exception 'That home is not on this association''s register' using errcode = '22000';
  end if;

  v_email := lower(btrim(v_req.email));
  select id into v_profile from profiles where lower(email) = v_email limit 1;

  -- Already on the home: nothing to do, and a second press is not an error.
  if exists (
    select 1 from memberships m
     where m.unit_id = p_unit_id
       and m.ends_on is null
       and ((v_profile is not null and m.profile_id = v_profile)
         or lower(m.invited_email) = v_email)
  ) then
    return p_unit_id;
  end if;

  if v_req.status = 'approved' then
    raise exception 'That request was already let in' using errcode = '22000';
  end if;

  -- The listed owner is the first open seat, the one the roster shows.
  select * into v_first from memberships
   where unit_id = p_unit_id and ends_on is null
   order by starts_on, created_at, id
   limit 1;
  v_any := found;
  v_has_owner := v_any and btrim(v_first.full_name) <> '';

  if p_as_second and v_has_owner then
    perform add_unit_owner_seat(p_unit_id, v_req.full_name, v_req.email);
    return p_unit_id;
  end if;

  if not v_any then
    perform add_unit_owner_seat(p_unit_id, v_req.full_name, v_req.email);
    return p_unit_id;
  end if;

  -- One seat to hand over, and only when it is nobody else's.
  if v_first.profile_id is not null
     or (v_has_owner and v_first.invited_email is not null and lower(v_first.invited_email) <> v_email) then
    raise exception 'That home already has an owner. Add them as a second owner, or record a sale'
      using errcode = '22000';
  end if;

  update memberships
     set full_name     = btrim(v_req.full_name),
         invited_email = v_email,
         profile_id    = v_profile
   where id = v_first.id;
  return p_unit_id;
end;
$$;

create or replace function remove_household(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
begin
  select association_id into v_association from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if not has_capability(v_association, 'settings') then
    raise exception 'Only a settings holder can remove a household' using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);
  if exists (
    select 1 from memberships
    where unit_id = p_unit_id and role = 'president' and ends_on is null
  ) then
    raise exception 'Transfer the presidency before removing this home' using errcode = '42501';
  end if;
  if exists (select 1 from charges where unit_id = p_unit_id)
     or exists (select 1 from payments where unit_id = p_unit_id) then
    raise exception 'This home has a statement. Record a sale instead of removing it'
      using errcode = '23503';
  end if;

  delete from memberships where unit_id = p_unit_id;
  delete from units where id = p_unit_id;
end;
$$;
