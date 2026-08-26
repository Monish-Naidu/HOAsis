-- HOAsis core schema.
--
-- The shape here follows one modelling decision that most membership systems
-- get wrong: money belongs to the home, people belong to the home for a period
-- of time. When a house sells, the balance stays with the unit, the seller
-- loses access on the closing date, and the buyer gains it. Attaching charges
-- to a person makes that transfer a data migration instead of a row.
--
-- Everything is scoped by association and enforced in row level security
-- rather than in the client, because the client is where the current prototype
-- enforces it and that is exactly what a server is for.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- vocabulary

create type capability as enum (
  'finances', 'requests', 'documents', 'communications', 'voting',
  'vendors', 'compliance', 'forum', 'settings', 'permissions'
);

create type board_role as enum (
  'resident', 'president', 'vice-president', 'treasurer', 'secretary'
);

create type dues_cadence as enum ('monthly', 'quarterly', 'annually');
create type account_kind as enum ('operating', 'reserve', 'cd');
create type charge_kind as enum ('charge', 'payment', 'credit');
create type payment_rail as enum ('ach', 'card', 'apple-pay', 'google-pay');
create type payment_state as enum ('pending', 'settled', 'failed', 'refunded');

-- --------------------------------------------------------------- associations

create table associations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text not null,
  state         char(2) not null,
  -- Employer Identification Number. An association's bank account is opened
  -- against this, so a payout destination cannot be verified without it.
  ein           text,
  dues_cents    integer not null check (dues_cents >= 0),
  dues_cadence  dues_cadence not null default 'monthly',
  due_day       smallint not null default 1 check (due_day between 1 and 28),
  late_after_day smallint not null default 10 check (late_after_day between 1 and 28),
  fiscal_year_start text not null default '01-01',
  -- Stripe Connect account that receives this association's dues. Null until
  -- they finish identity verification.
  stripe_account_id text unique,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- people

-- One row per authenticated person, mirroring auth.users so the rest of the
-- schema can carry foreign keys into it.
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  email      text not null,
  phone      text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- homes

create table units (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  label          text not null,
  address        text not null default '',
  -- Balance is derived from charges rather than stored, so there is no second
  -- number that can disagree with the ledger. See the view below.
  created_at     timestamptz not null default now(),
  unique (association_id, label)
);

-- A person's tenure at a home. Open ended until the day they sell.
--
-- Access is granted through this table and nowhere else, so revoking it is a
-- date rather than a cascade of deletions, and the history of who owned what
-- when survives the sale.
create table memberships (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  unit_id        uuid not null references units (id) on delete cascade,
  profile_id     uuid references profiles (id) on delete set null,
  -- Held before the person has claimed their invitation, which is why this is
  -- separate from the profile.
  invited_email  text,
  full_name      text not null,
  role           board_role not null default 'resident',
  capabilities   capability[] not null default '{}',
  starts_on      date not null default current_date,
  -- Null means current. A sale sets this to the closing date.
  ends_on        date,
  created_at     timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index on memberships (association_id, profile_id) where ends_on is null;
create index on memberships (unit_id) where ends_on is null;

-- Exactly one sitting President per association. An association that can end
-- up with none has nobody who can grant capabilities back.
create unique index one_president_per_association
  on memberships (association_id)
  where role = 'president' and ends_on is null;

-- ---------------------------------------------------------------- money

create table bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  kind           account_kind not null,
  institution    text not null,
  -- The last four digits, and never more. The full number is validated at the
  -- edge and discarded; what can move money lives at Stripe, not here.
  mask           char(4) not null,
  stripe_payment_method_id text,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- Only one operating account can be the live payout destination.
create unique index one_operating_account_per_association
  on bank_accounts (association_id)
  where kind = 'operating';

-- What a unit owes, and what has been paid against it.
create table charges (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  unit_id        uuid not null references units (id) on delete cascade,
  kind           charge_kind not null,
  label          text not null,
  -- Positive for a charge, negative for a payment or credit. Integer cents,
  -- never floating point.
  amount_cents   integer not null,
  due_on         date not null,
  created_at     timestamptz not null default now()
);

create index on charges (association_id, unit_id, due_on);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  unit_id        uuid not null references units (id) on delete cascade,
  paid_by        uuid references profiles (id) on delete set null,
  amount_cents   integer not null check (amount_cents > 0),
  -- Split out so a receipt can show who carried what, rather than one blended
  -- rate that hides our fee inside the processor's.
  processor_fee_cents integer not null default 0,
  platform_fee_cents  integer not null default 0,
  rail           payment_rail not null,
  state          payment_state not null default 'pending',
  -- The idempotency anchor. Stripe can deliver the same webhook more than
  -- once, and a payment recorded twice is a refund conversation.
  stripe_payment_intent_id text unique,
  created_at     timestamptz not null default now(),
  settled_at     timestamptz
);

-- Which charges a payment cleared, oldest first. Kept explicitly rather than
-- recomputed, because how money was applied is a fact about the past.
create table payment_allocations (
  payment_id   uuid not null references payments (id) on delete cascade,
  charge_id    uuid not null references charges (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  primary key (payment_id, charge_id)
);

-- The association's books. Distinct from charges, which are what owners owe.
create table ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  bank_account_id uuid references bank_accounts (id) on delete set null,
  occurred_on    date not null,
  description    text not null,
  counterparty   text not null default '',
  category       text not null,
  amount_cents   integer not null,
  -- Held out of every report until a human confirms it, which is the whole
  -- reconciliation argument.
  confirmed_at   timestamptz,
  payment_id     uuid references payments (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index on ledger_entries (association_id, occurred_on);

-- A unit's balance, derived. There is no stored balance to drift from this.
create view unit_balances with (security_invoker = true) as
  select
    u.id                                    as unit_id,
    u.association_id,
    coalesce(sum(c.amount_cents), 0)::integer as balance_cents
  from units u
  left join charges c on c.unit_id = u.id and c.due_on <= current_date
  group by u.id, u.association_id;

-- ---------------------------------------------------------------- access

-- Membership and capability checks used by every policy below.
--
-- SECURITY DEFINER so a policy can consult memberships without the caller
-- needing to be able to read that table directly, which would otherwise be
-- circular.

create or replace function is_member_of(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.association_id = target
      and m.profile_id = auth.uid()
      and m.ends_on is null
  );
$$;

create or replace function has_capability(target uuid, needed capability)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.association_id = target
      and m.profile_id = auth.uid()
      and m.ends_on is null
      and needed = any (m.capabilities)
  );
$$;

-- The units a person currently holds, which is what scopes a resident's own
-- statement to their own home.
create or replace function my_unit_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.unit_id from memberships m
  where m.profile_id = auth.uid() and m.ends_on is null;
$$;

alter table associations   enable row level security;
alter table profiles       enable row level security;
alter table units          enable row level security;
alter table memberships    enable row level security;
alter table bank_accounts  enable row level security;
alter table charges        enable row level security;
alter table payments       enable row level security;
alter table payment_allocations enable row level security;
alter table ledger_entries enable row level security;

-- A person reads their own profile and nobody else's.
create policy profiles_self on profiles
  for select using (id = auth.uid());
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- Members see their association. Only settings holders change it.
create policy associations_read on associations
  for select using (is_member_of(id));
create policy associations_write on associations
  for update using (has_capability(id, 'settings'));

create policy units_read on units
  for select using (is_member_of(association_id));
create policy units_write on units
  for all using (has_capability(association_id, 'settings'));

-- Every member can see who their neighbors are. Only a permissions holder
-- changes who holds what.
create policy memberships_read on memberships
  for select using (is_member_of(association_id));
create policy memberships_write on memberships
  for all using (has_capability(association_id, 'permissions'));

-- Bank details are finance only, not general membership.
create policy bank_accounts_read on bank_accounts
  for select using (has_capability(association_id, 'finances'));
create policy bank_accounts_write on bank_accounts
  for all using (has_capability(association_id, 'finances'));

-- An owner sees their own home's charges. The board's finance holders see all
-- of them. Nobody sees a neighbour's balance.
create policy charges_read on charges
  for select using (
    unit_id in (select my_unit_ids()) or has_capability(association_id, 'finances')
  );
create policy charges_write on charges
  for all using (has_capability(association_id, 'finances'));

create policy payments_read on payments
  for select using (
    unit_id in (select my_unit_ids()) or has_capability(association_id, 'finances')
  );
-- Payments are written by the webhook under the service role, never by a
-- browser, so there is deliberately no insert policy for end users.

create policy allocations_read on payment_allocations
  for select using (
    exists (
      select 1 from payments p
      where p.id = payment_id
        and (p.unit_id in (select my_unit_ids()) or has_capability(p.association_id, 'finances'))
    )
  );

create policy ledger_read on ledger_entries
  for select using (has_capability(association_id, 'finances'));
create policy ledger_write on ledger_entries
  for all using (has_capability(association_id, 'finances'));
