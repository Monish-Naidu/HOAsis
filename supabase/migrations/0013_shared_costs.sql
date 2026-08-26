-- Layers on top of dues.
--
-- Most associations bill one thing: dues, the same amount every month. That
-- has to stay a single number on a single screen, so nothing here is required
-- and nothing here appears until a board switches it on.
--
-- Two layers exist because two things genuinely do not fit a flat monthly due:
--
--   A special assessment is one large cost, approved once, split across homes,
--   and paid off. It has a beginning and an end, and owners want to see how
--   much of it is left.
--
--   A shared cost is a bill the association receives and passes through. Water,
--   trash, gas, bulk internet. The amount changes every period, and the split
--   is rarely equal: a three bedroom pays more water than a studio. The utility
--   billing industry calls the equal-ish version RUBS, and it is normally sold
--   as a separate product bolted onto separate books, which is exactly the
--   split-brain this association is trying to avoid.
--
-- Both land as ordinary rows in `charges`, so a balance is still one number and
-- every existing report keeps working without knowing these tables exist.

/* -------------------------------------------------------- what a home is like */

-- Allocation needs something to allocate by. All optional; an association that
-- splits everything equally never fills these in.
alter table units
  add column if not exists square_feet integer check (square_feet is null or square_feet > 0),
  add column if not exists bedrooms    smallint check (bedrooms is null or bedrooms between 0 and 20),
  add column if not exists occupants   smallint check (occupants is null or occupants between 0 and 40);

/* ------------------------------------------------------------- what a charge is */

-- Existing rows are dues. Nothing else would be true of an association that
-- has been running without this column.
do $$ begin
  create type charge_category as enum
    ('dues', 'special_assessment', 'shared_cost', 'late_fee', 'fine', 'other');
exception when duplicate_object then null; end $$;

alter table charges
  add column if not exists category charge_category not null default 'dues';

create index if not exists charges_category_idx on charges (association_id, category, due_on);

/* --------------------------------------------------------- special assessments */

do $$ begin
  create type allocation_method as enum
    ('equal', 'square_feet', 'bedrooms', 'occupants', 'submeter');
exception when duplicate_object then null; end $$;

create table if not exists special_assessments (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  title          text not null check (length(btrim(title)) > 0),
  -- Why it is being levied, in the board's own words. Several states require
  -- this be stated to owners before the vote, and owners ask regardless.
  reason         text not null default '',
  total_cents    bigint not null check (total_cents > 0),
  allocation     allocation_method not null default 'equal',
  -- Split across this many monthly instalments. One means a single bill.
  installments   smallint not null default 1 check (installments between 1 and 120),
  first_due_on   date not null,
  -- The vote that authorised it, when the governing documents required one.
  ballot_id      uuid references ballots (id) on delete set null,
  levied_at      timestamptz,
  created_at     timestamptz not null default now()
);

/* -------------------------------------------------------------- shared costs */

create table if not exists shared_costs (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  -- What owners see on their statement: "Water", "Trash", "Bulk internet".
  name           text not null check (length(btrim(name)) > 0),
  -- Who the association actually pays. Owners ask this constantly, and no
  -- competitor puts it anywhere an owner can see.
  provider       text not null default '',
  account_ref    text not null default '',
  allocation     allocation_method not null default 'equal',
  -- Some associations add a small percentage for administration. Several
  -- states cap or forbid it, so it is recorded rather than hidden in the rate.
  markup_percent numeric(5,2) not null default 0 check (markup_percent between 0 and 100),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (association_id, name)
);

-- One bill from the provider, for one period.
create table if not exists shared_cost_bills (
  id             uuid primary key default gen_random_uuid(),
  shared_cost_id uuid not null references shared_costs (id) on delete cascade,
  association_id uuid not null references associations (id) on delete cascade,
  period_start   date not null,
  period_end     date not null,
  total_cents    bigint not null check (total_cents >= 0),
  -- What the association consumed, in the provider's own unit. Gallons, therms,
  -- kilowatt hours. Kept so a board can see usage rise before the cost does.
  usage_amount   numeric(14,3),
  usage_unit     text not null default '',
  due_on         date not null,
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  check (period_end >= period_start),
  unique (shared_cost_id, period_start)
);

-- What each home's share of that bill was, and why.
create table if not exists shared_cost_shares (
  id       uuid primary key default gen_random_uuid(),
  bill_id  uuid not null references shared_cost_bills (id) on delete cascade,
  unit_id  uuid not null references units (id) on delete cascade,
  -- The number the split was made on: square feet, occupants, metered units.
  basis         numeric(14,3) not null default 1,
  share_cents   integer not null,
  charge_id     uuid references charges (id) on delete set null,
  unique (bill_id, unit_id)
);

create index if not exists shared_cost_bills_period_idx
  on shared_cost_bills (association_id, period_start desc);

/* ------------------------------------------------------------- the arithmetic */

-- Splitting money is where this kind of feature usually goes wrong. Dividing a
-- bill by 37 homes leaves a remainder, and rounding each share independently
-- produces a total that is a few cents off the bill the association actually
-- has to pay. Over a year of monthly bills that drift becomes a reconciliation
-- question nobody can answer.
--
-- So: floor every share, then hand the leftover cents out one each to the homes
-- with the largest fractional part. The shares always sum to the bill exactly.
-- This is the largest remainder method, and it is what a court would expect.
create or replace function allocate_cents(
  p_total_cents bigint,
  p_basis       numeric[]
)
returns integer[]
language plpgsql
immutable
as $$
declare
  v_sum       numeric := 0;
  v_shares    integer[] := '{}';
  v_fractions numeric[] := '{}';
  v_exact     numeric;
  v_assigned  bigint := 0;
  v_left      bigint;
  i           integer;
  v_best      integer;
  v_best_frac numeric;
begin
  if array_length(p_basis, 1) is null then return '{}'; end if;

  for i in 1 .. array_length(p_basis, 1) loop
    v_sum := v_sum + greatest(p_basis[i], 0);
  end loop;

  -- Every basis is zero or missing, so the only defensible split is equal.
  if v_sum <= 0 then
    for i in 1 .. array_length(p_basis, 1) loop
      p_basis[i] := 1;
    end loop;
    v_sum := array_length(p_basis, 1);
  end if;

  for i in 1 .. array_length(p_basis, 1) loop
    v_exact := (p_total_cents * greatest(p_basis[i], 0)) / v_sum;
    v_shares := v_shares || floor(v_exact)::integer;
    v_fractions := v_fractions || (v_exact - floor(v_exact));
    v_assigned := v_assigned + floor(v_exact)::bigint;
  end loop;

  v_left := p_total_cents - v_assigned;
  while v_left > 0 loop
    v_best := null;
    v_best_frac := -1;
    for i in 1 .. array_length(v_fractions, 1) loop
      if v_fractions[i] > v_best_frac then
        v_best_frac := v_fractions[i];
        v_best := i;
      end if;
    end loop;
    exit when v_best is null;
    v_shares[v_best] := v_shares[v_best] + 1;
    v_fractions[v_best] := -1;
    v_left := v_left - 1;
  end loop;

  return v_shares;
end;
$$;

/* ------------------------------------------------- levying a special assessment */

create or replace function levy_special_assessment(
  p_association_id uuid,
  p_title          text,
  p_reason         text,
  p_total_cents    bigint,
  p_allocation     allocation_method default 'equal',
  p_installments   smallint default 1,
  p_first_due_on   date default current_date,
  p_ballot_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_units    uuid[];
  v_basis    numeric[];
  v_shares   integer[];
  v_per_inst integer[];
  v_running  integer;
  i          integer;
  n          integer;
begin
  if not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability';
  end if;
  if p_total_cents is null or p_total_cents <= 0 then
    raise exception 'A special assessment has to be for an amount';
  end if;

  insert into special_assessments
    (association_id, title, reason, total_cents, allocation, installments, first_due_on, ballot_id, levied_at)
  values
    (p_association_id, btrim(p_title), coalesce(p_reason, ''), p_total_cents,
     p_allocation, greatest(p_installments, 1), p_first_due_on, p_ballot_id, now())
  returning id into v_id;

  select array_agg(u.id order by u.label),
         array_agg(
           case p_allocation
             when 'square_feet' then coalesce(u.square_feet, 0)::numeric
             when 'bedrooms'    then coalesce(u.bedrooms, 0)::numeric
             when 'occupants'   then coalesce(u.occupants, 0)::numeric
             else 1::numeric
           end order by u.label)
    into v_units, v_basis
    from units u
   where u.association_id = p_association_id;

  if v_units is null then return v_id; end if;

  v_shares := allocate_cents(p_total_cents, v_basis);
  n := greatest(p_installments, 1);

  for i in 1 .. array_length(v_units, 1) loop
    -- Each home's own share is split across the instalments by the same rule,
    -- so twelve payments add up to the share and not a cent more.
    v_per_inst := allocate_cents(v_shares[i]::bigint, array_fill(1::numeric, array[n]));
    for v_running in 1 .. n loop
      if v_per_inst[v_running] > 0 then
        insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
        values (
          p_association_id, v_units[i], 'charge', 'special_assessment',
          case when n = 1 then btrim(p_title)
               else btrim(p_title) || ' (' || v_running || ' of ' || n || ')' end,
          v_per_inst[v_running],
          (p_first_due_on + ((v_running - 1) || ' months')::interval)::date
        );
      end if;
    end loop;
  end loop;

  return v_id;
end;
$$;

revoke all on function levy_special_assessment from public;
grant execute on function levy_special_assessment to authenticated;

/* --------------------------------------------------- posting a shared cost bill */

-- `p_readings` maps unit id to a metered reading, and is only consulted when
-- the allocation is 'submeter'. Everything else reads the home's own figures.
create or replace function post_shared_cost_bill(
  p_shared_cost_id uuid,
  p_period_start   date,
  p_period_end     date,
  p_total_cents    bigint,
  p_due_on         date default null,
  p_usage_amount   numeric default null,
  p_usage_unit     text default '',
  p_readings       jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost    shared_costs%rowtype;
  v_bill    uuid;
  v_units   uuid[];
  v_basis   numeric[];
  v_shares  integer[];
  v_billed  bigint;
  v_charge  uuid;
  i         integer;
begin
  select * into v_cost from shared_costs where id = p_shared_cost_id;
  if not found then raise exception 'No such shared cost'; end if;
  if not has_capability(v_cost.association_id, 'finances') then
    raise exception 'You do not have the finances capability';
  end if;

  -- The markup is applied here, once, and stored on the bill, so what owners
  -- are charged is always reproducible from what the provider charged.
  v_billed := round(p_total_cents * (1 + v_cost.markup_percent / 100.0));

  insert into shared_cost_bills
    (shared_cost_id, association_id, period_start, period_end, total_cents,
     usage_amount, usage_unit, due_on, posted_at)
  values
    (p_shared_cost_id, v_cost.association_id, p_period_start, p_period_end, p_total_cents,
     p_usage_amount, coalesce(p_usage_unit, ''), coalesce(p_due_on, p_period_end + 20), now())
  returning id into v_bill;

  select array_agg(u.id order by u.label),
         array_agg(
           case v_cost.allocation
             when 'square_feet' then coalesce(u.square_feet, 0)::numeric
             when 'bedrooms'    then coalesce(u.bedrooms, 0)::numeric
             when 'occupants'   then coalesce(u.occupants, 0)::numeric
             when 'submeter'    then coalesce((p_readings ->> u.id::text)::numeric, 0)
             else 1::numeric
           end order by u.label)
    into v_units, v_basis
    from units u
   where u.association_id = v_cost.association_id;

  if v_units is null then return v_bill; end if;

  v_shares := allocate_cents(v_billed, v_basis);

  for i in 1 .. array_length(v_units, 1) loop
    if v_shares[i] <> 0 then
      insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
      values (
        v_cost.association_id, v_units[i], 'charge', 'shared_cost',
        v_cost.name || ' ' || to_char(p_period_start, 'Mon YYYY'),
        v_shares[i],
        coalesce(p_due_on, p_period_end + 20)
      )
      returning id into v_charge;
    else
      v_charge := null;
    end if;

    insert into shared_cost_shares (bill_id, unit_id, basis, share_cents, charge_id)
    values (v_bill, v_units[i], v_basis[i], v_shares[i], v_charge);
  end loop;

  return v_bill;
end;
$$;

revoke all on function post_shared_cost_bill from public;
grant execute on function post_shared_cost_bill to authenticated;

/* -------------------------------------------------------------------- reading */

-- What a shared cost has actually cost, per period and per home. This is the
-- number an owner asks for at a meeting and nobody can produce.
create or replace view shared_cost_history as
  select b.association_id,
         b.shared_cost_id,
         c.name,
         c.provider,
         c.allocation,
         b.id as bill_id,
         b.period_start,
         b.period_end,
         b.total_cents,
         b.usage_amount,
         b.usage_unit,
         (select count(*) from shared_cost_shares s where s.bill_id = b.id) as homes,
         (select coalesce(avg(s.share_cents), 0)::integer
            from shared_cost_shares s where s.bill_id = b.id) as average_share_cents
    from shared_cost_bills b
    join shared_costs c on c.id = b.shared_cost_id
   where is_member_of(b.association_id);

-- Twelve months at a glance: what was billed, what came in, what it was for.
-- Every trend screen in the product reads this rather than counting rows in the
-- browser, so two screens cannot disagree about a month.
create or replace view monthly_activity as
  select ch.association_id,
         date_trunc('month', ch.due_on)::date as month,
         ch.category,
         sum(case when ch.kind = 'charge' then ch.amount_cents else 0 end)::bigint as billed_cents,
         sum(case when ch.kind <> 'charge' then -ch.amount_cents else 0 end)::bigint as credited_cents,
         count(*) filter (where ch.kind = 'charge') as charge_count
    from charges ch
   where is_member_of(ch.association_id)
   group by 1, 2, 3;

/* ----------------------------------------------------------------------- rls */

alter table special_assessments  enable row level security;
alter table shared_costs         enable row level security;
alter table shared_cost_bills    enable row level security;
alter table shared_cost_shares   enable row level security;

-- Owners can see what they are being billed for and who the association pays.
-- Withholding that is how boards lose votes.
drop policy if exists special_assessments_read on special_assessments;
create policy special_assessments_read on special_assessments
  for select using (is_member_of(association_id));

drop policy if exists shared_costs_read on shared_costs;
create policy shared_costs_read on shared_costs
  for select using (is_member_of(association_id));

drop policy if exists shared_cost_bills_read on shared_cost_bills;
create policy shared_cost_bills_read on shared_cost_bills
  for select using (is_member_of(association_id));

-- A home's own share, or every share if you run the money.
drop policy if exists shared_cost_shares_read on shared_cost_shares;
create policy shared_cost_shares_read on shared_cost_shares
  for select using (
    unit_id in (select my_unit_ids())
    or exists (
      select 1 from shared_cost_bills b
       where b.id = bill_id and has_capability(b.association_id, 'finances')
    )
  );

-- Writing goes through the functions above, which check the capability and get
-- the arithmetic right. Except the definitions themselves, which are ordinary
-- board configuration.
drop policy if exists shared_costs_write on shared_costs;
create policy shared_costs_write on shared_costs
  for all using (has_capability(association_id, 'finances'))
  with check (has_capability(association_id, 'finances'));

grant select on shared_cost_history, monthly_activity to authenticated;
