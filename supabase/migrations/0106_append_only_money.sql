-- Money records are append-only for people.
--
-- A finance holder could UPDATE or DELETE any row of charges and
-- ledger_entries (charges_write and ledger_write, 0001, were "for all"), and
-- the Transactions screen's Remove really deleted the line. The activity
-- trigger covers inserts through functions, not updates or deletes, so for a
-- lien or a lawsuit a balance could change with no record of who changed it.
--
-- The rule now:
--   1. No signed-in person can UPDATE or DELETE a row of charges,
--      ledger_entries, payments or payment_allocations. A mistake is
--      corrected by a new line that points at the old one.
--   2. Inserts stay as they were: a finance holder may still insert a charge
--      or a ledger line. payments and payment_allocations never had an
--      insert policy for people and still have none.
--   3. The service role (jobs, webhooks) is unaffected, and so is a
--      SECURITY DEFINER function that says it is writing (see below).
--
-- What is in this file
--   - money_is_append_only() and a trigger on each of the four tables.
--   - ledger_entries.reversed_entry_id, and reverse_ledger_entry(): a
--     correction is an opposite line, never an edit or a delete.
--   - confirm_ledger_entry(): confirming a bank line (confirmed_at) is an
--     update, so it gets its own function rather than a policy.
--   - Three functions copied whole with one added line, so they can still
--     change a row on purpose (list below).
--
-- Why a session flag and not an exemption for the whole table: a SECURITY
-- DEFINER function runs as its owner, but auth.role() is still the caller's,
-- so a board member calling reverse_manual_payment looks like a person
-- editing payments. The function says so with
--   perform set_config('app.money_write', 'function', true);
-- (transaction-local) and the trigger lets that transaction through. A
-- person cannot set it: PostgREST exposes no way to run set_config.
--
-- Copied whole, plus the flag line:
--   record_payment          0101  settles a pending payment in place on a retry.
--   reverse_manual_payment  0088  marks the payment refunded.
--   import_households       0057  replaces "Balance brought forward".
-- Not copied, and why: record_refund (0078) and record_dispute_loss (0093)
-- are granted to the service role only, and the service role passes the
-- trigger by itself. record_manual_payment (0102), add_charge, add_credit,
-- issue_assessment, assess_late_fees, transfer_home and retire_home (0099)
-- only insert. remove_household (0018) refuses a home that has a charge or a
-- payment, and then deletes only memberships and the unit, so no money row is
-- deleted by it, not even by cascade.
--
-- Two paths the trigger lets through on purpose:
--   - Foreign key actions. Deleting a bank account sets ledger_entries.
--     bank_account_id to null, and deleting a profile sets payments.paid_by
--     to null. That runs as an UPDATE inside the referential trigger
--     (pg_trigger_depth() > 1), and is allowed only when nothing but those
--     link columns changed. A cascading DELETE is not allowed: deleting a
--     home or an association that has money on it is refused.
--   - A database owner at a SQL prompt (session_user postgres or
--     supabase_admin), so a migration or a repair does not need the trigger
--     dropped. PostgREST sessions are the authenticator role, never these.

-- --------------------------------------------------------------- policies

-- Insert only, with the same condition the "for all" policy applied.
drop policy if exists charges_write on charges;
drop policy if exists charges_insert on charges;
create policy charges_insert on charges
  for insert to authenticated
  with check (has_capability(association_id, 'finances'));

drop policy if exists ledger_write on ledger_entries;
drop policy if exists ledger_insert on ledger_entries;
create policy ledger_insert on ledger_entries
  for insert to authenticated
  with check (has_capability(association_id, 'finances'));

-- ---------------------------------------------------------------- trigger

create or replace function money_is_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin')
     or coalesce(current_setting('app.money_write', true), '') = 'function' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- "On delete set null" foreign keys. Only the link columns may differ.
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and (to_jsonb(new) - 'bank_account_id' - 'payment_id' - 'paid_by')
       = (to_jsonb(old) - 'bank_account_id' - 'payment_id' - 'paid_by') then
    return new;
  end if;

  raise exception 'Money records are not edited or deleted here. Reverse or correct them instead.'
    using errcode = '42501';
end;
$$;

drop trigger if exists money_append_only on charges;
create trigger money_append_only
  before update or delete on charges
  for each row execute function money_is_append_only();

drop trigger if exists money_append_only on ledger_entries;
create trigger money_append_only
  before update or delete on ledger_entries
  for each row execute function money_is_append_only();

drop trigger if exists money_append_only on payments;
create trigger money_append_only
  before update or delete on payments
  for each row execute function money_is_append_only();

drop trigger if exists money_append_only on payment_allocations;
create trigger money_append_only
  before update or delete on payment_allocations
  for each row execute function money_is_append_only();

-- Only the trigger calls it. By name, as the other closed functions are.
revoke all on function money_is_append_only() from public;
revoke execute on function money_is_append_only() from anon, authenticated;

-- -------------------------------------------------------- the three copies

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
      'Processing fee, unit ' || v_unit_label,
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

-- By name: create or replace keeps the grants, and these restate them so the
-- file stands on its own. anon holds its own default grant (see 0062).
revoke all on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) from public;
revoke execute on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) from anon;
grant execute on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) to authenticated;
grant execute on function record_payment(uuid, integer, payment_rail, integer, integer, text, text, uuid) to service_role;

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

revoke all on function reverse_manual_payment(uuid, text) from public;
revoke execute on function reverse_manual_payment(uuid, text) from anon;
grant execute on function reverse_manual_payment(uuid, text) to authenticated;
grant execute on function reverse_manual_payment(uuid, text) to service_role;

create or replace function import_households(
  p_association_id uuid,
  p_rows           jsonb,
  p_as_of          date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       jsonb;
  v_label     text;
  v_address   text;
  v_name      text;
  v_email     text;
  v_phone     text;
  v_balance   integer;
  v_has_bal   boolean;
  v_unit      uuid;
  v_created   integer := 0;
  v_updated   integer := 0;
  v_balances  integer := 0;
  v_skipped   integer := 0;
  v_any_bal   boolean := false;
begin
  -- Append-only money (0106): replacing an opening balance deletes its line.
  perform set_config('app.money_write', 'function', true);
  if not has_capability(p_association_id, 'settings') then
    raise exception 'Only a settings holder can import the roster' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of homes' using errcode = '22000';
  end if;

  select exists (
    select 1 from jsonb_array_elements(p_rows) r
    where r ? 'opening_balance_cents'
      and coalesce((r ->> 'opening_balance_cents')::integer, 0) <> 0
  ) into v_any_bal;
  if v_any_bal and not has_capability(p_association_id, 'finances') then
    raise exception 'Opening balances need the finances capability' using errcode = '42501';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_address := btrim(coalesce(v_row ->> 'address', ''));
    v_label   := btrim(coalesce(v_row ->> 'unit', ''));
    if v_label = '' then
      v_label := v_address;
    end if;
    if v_label = '' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_name    := btrim(coalesce(v_row ->> 'name', ''));
    v_email   := nullif(lower(btrim(coalesce(v_row ->> 'email', ''))), '');
    v_phone   := btrim(coalesce(v_row ->> 'phone', ''));
    v_has_bal := (v_row ? 'opening_balance_cents') and ((v_row ->> 'opening_balance_cents') is not null);
    v_balance := case when v_has_bal then coalesce((v_row ->> 'opening_balance_cents')::integer, 0) else 0 end;

    select id into v_unit from units
     where association_id = p_association_id and label = v_label;

    if v_unit is null then
      insert into units (association_id, label, address)
      values (p_association_id, v_label, v_address)
      returning id into v_unit;

      insert into memberships
        (association_id, unit_id, invited_email, full_name, role, capabilities, phone)
      values
        (p_association_id, v_unit, v_email, v_name, 'resident', '{}'::capability[], v_phone);
      v_created := v_created + 1;
    else
      -- Fill what is blank on the home and on its open seat. A claimed seat
      -- keeps its email; everything else takes the file's word where the
      -- register had nothing.
      update units
         set address = case when address = '' then v_address else address end
       where id = v_unit;

      update memberships m
         set full_name     = case when m.full_name = '' then v_name else m.full_name end,
             invited_email = case when m.profile_id is null and v_email is not null then v_email
                                  else m.invited_email end,
             phone         = case when m.phone = '' then v_phone else m.phone end
       where m.unit_id = v_unit
         and m.ends_on is null
         and m.role = 'resident'
         and m.id = (
           select id from memberships
            where unit_id = v_unit and ends_on is null and role = 'resident'
            order by created_at limit 1
         );

      -- A home with no seat at all (every seat closed by a sale) gets one.
      if not exists (select 1 from memberships where unit_id = v_unit and ends_on is null) then
        insert into memberships
          (association_id, unit_id, invited_email, full_name, role, capabilities, phone)
        values
          (p_association_id, v_unit, v_email, v_name, 'resident', '{}'::capability[], v_phone);
      end if;
      v_updated := v_updated + 1;
    end if;

    -- Somebody who already has an account is seated now rather than waiting
    -- for a signup that will never come.
    update memberships m
       set profile_id = p.id
      from profiles p
     where m.unit_id = v_unit
       and m.ends_on is null
       and m.profile_id is null
       and m.invited_email is not null
       and lower(p.email) = lower(m.invited_email);

    if v_has_bal then
      if v_balance <> 0 and exists (
        select 1 from charges c
         where c.unit_id = v_unit
           and c.kind = 'charge'
           and c.category = 'dues'
           and c.label <> 'Balance brought forward'
           and c.due_on <= p_as_of
      ) then
        raise exception
          'Home % was already billed here for a period on or before %. Pick an earlier as-of date or leave its opening balance blank.',
          v_label, p_as_of
          using errcode = '22000';
      end if;

      delete from charges
       where unit_id = v_unit and label = 'Balance brought forward';
      if v_balance <> 0 then
        insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
        values (
          p_association_id, v_unit,
          (case when v_balance > 0 then 'charge' else 'credit' end)::charge_kind,
          'dues', 'Balance brought forward', v_balance, p_as_of
        );
        v_balances := v_balances + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'balances', v_balances,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function import_households(uuid, jsonb, date) from public;
revoke execute on function import_households(uuid, jsonb, date) from anon;
grant execute on function import_households(uuid, jsonb, date) to authenticated;
grant execute on function import_households(uuid, jsonb, date) to service_role;

-- ------------------------------------------------------- a correction line

-- A reversal points at the line it reverses. At most one reversal per line,
-- held by the database so two quick presses cannot both land.
alter table ledger_entries
  add column if not exists reversed_entry_id uuid references ledger_entries (id);

create unique index if not exists ledger_entries_one_reversal
  on ledger_entries (reversed_entry_id)
  where reversed_entry_id is not null;

-- Writes the opposite of a line, dated today and confirmed, and leaves the
-- original exactly as it was. Returns the new line's id.
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

revoke all on function reverse_ledger_entry(uuid, text) from public;
revoke execute on function reverse_ledger_entry(uuid, text) from anon;
grant execute on function reverse_ledger_entry(uuid, text) to authenticated;
grant execute on function reverse_ledger_entry(uuid, text) to service_role;

-- ---------------------------------------------------- confirm a bank line

-- Reconciling: a line that came from a bank feed waits for a person, who
-- confirms it and may settle its category. This is the one edit a ledger
-- line still gets, and it goes through here so the activity record names who
-- did it. Not undoable: to take a line back, reverse it.
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

revoke all on function confirm_ledger_entry(uuid, text) from public;
revoke execute on function confirm_ledger_entry(uuid, text) from anon;
grant execute on function confirm_ledger_entry(uuid, text) to authenticated;
grant execute on function confirm_ledger_entry(uuid, text) to service_role;
