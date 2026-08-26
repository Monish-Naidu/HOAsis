-- Email to owners.
--
-- The whole design turns on one distinction that most mailing tools do not
-- make, and that an HOA cannot afford to get wrong.
--
-- A board has a statutory duty to notify owners about money and about
-- governance. An owner cannot opt out of being told they owe an assessment,
-- any more than they can opt out of the assessment. Treat those as marketing
-- and you either break the board's duty by honoring an unsubscribe, or break
-- CAN-SPAM by ignoring one.
--
-- So the category carries the answer, the database refuses to record an opt out
-- against a statutory one, and every send is logged because the thing a board
-- eventually needs is not the email, it is the proof they sent it.

create type email_category as enum (
  -- Statutory. Always delivered.
  'assessment',    -- your dues are due
  'delinquency',   -- your account is past due
  'meeting',       -- notice of a meeting
  'ballot',        -- a vote is open
  -- Optional. Freely unsubscribable.
  'community',     -- forum digests, neighborhood notes
  'newsletter'     -- everything else the board wants to say
);

/**
 * Whether an owner may decline this category.
 *
 * Kept as a function rather than a column so it cannot be edited per row into
 * something unlawful, and so both the check constraint and the send path read
 * the same answer.
 */
create or replace function is_statutory(c email_category)
returns boolean
language sql
immutable
as $$
  select c in ('assessment', 'delinquency', 'meeting', 'ballot');
$$;

-- What somebody has turned off. Absence means subscribed, which is the right
-- default for a notice you are legally entitled to receive.
create table email_optouts (
  profile_id  uuid not null references profiles (id) on delete cascade,
  category    email_category not null,
  opted_out_at timestamptz not null default now(),
  primary key (profile_id, category),
  -- The rule, enforced where it cannot be bypassed by a bug in a form.
  constraint statutory_cannot_be_declined check (not is_statutory(category))
);

-- Every send, kept because a board's real need is evidence.
create table email_log (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  profile_id     uuid references profiles (id) on delete set null,
  unit_id        uuid references units (id) on delete set null,
  to_email       text not null,
  category       email_category not null,
  subject        text not null,
  -- Set once the provider accepts it. Null means we tried and it did not go.
  provider_id    text,
  error          text,
  sent_at        timestamptz not null default now()
);

create index on email_log (association_id, sent_at desc);
create index on email_log (unit_id, category);

alter table email_optouts enable row level security;
alter table email_log     enable row level security;

-- A person manages their own preferences and nobody else's.
create policy optouts_read_own on email_optouts
  for select using (profile_id = auth.uid());
create policy optouts_write_own on email_optouts
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- The board can see what was sent, which is the point of keeping it. Owners
-- can see what was sent to them.
create policy email_log_read on email_log
  for select using (
    profile_id = auth.uid() or has_capability(association_id, 'communications')
  );

/**
 * Who should receive a given category, for one association.
 *
 * Returns the address and the home, so a message can be filled in per
 * household without the caller assembling the roster itself and getting the
 * opt out rule subtly wrong.
 */
create or replace function email_recipients(
  p_association_id uuid,
  p_category       email_category,
  -- Limits to homes that currently owe money, for a past due run.
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
  left join unit_balances b on b.unit_id = m.unit_id
  where m.association_id = p_association_id
    and m.ends_on is null
    and has_capability(p_association_id, 'communications')
    and coalesce(p.email, m.invited_email) is not null
    -- An opt out only ever applies to a category somebody may decline.
    and not exists (
      select 1 from email_optouts o
      where o.profile_id = m.profile_id and o.category = p_category
    )
    and (not p_only_past_due or coalesce(b.balance_cents, 0) > 0);
$$;

revoke all on function email_recipients from public;
grant execute on function email_recipients to authenticated;
