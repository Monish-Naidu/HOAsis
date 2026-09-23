-- Autopay, run.
--
-- 0029 stored the owner's standing instruction on the membership and called it
-- "a preference until Stripe runs it". This is the ledger of Stripe running it:
-- one row per home per month that autopay acted on, written by the daily cron
-- under the service role and nothing else.
--
-- The unique key is the whole design. A month is either charged, skipped, or
-- failed exactly once; a retry of the cron finds the row and moves on, so a
-- declined card is one failed row and one email, never a daily drain on
-- somebody's patience. A day with nothing due writes no row at all, so dues
-- posted after the chosen day are still collected later that month.
--
-- Settlement is not tracked here. The intent id points at the payments row
-- the webhook writes, which is the only place money is ever recorded.

create table if not exists autopay_runs (
  id                         uuid primary key default gen_random_uuid(),
  association_id             uuid not null references associations(id) on delete cascade,
  unit_id                    uuid not null references units(id) on delete cascade,
  month                      text not null check (month ~ '^\d{4}-\d{2}$'),
  state                      text not null check (state in ('charged', 'skipped', 'failed')),
  amount_cents               integer not null default 0,
  rail                       text,
  stripe_payment_intent_id   text,
  reason                     text,
  created_at                 timestamptz not null default now(),
  unique (unit_id, month)
);

alter table autopay_runs enable row level security;

-- Readable by the home it concerns and by whoever holds the association's
-- money. Never writable from a browser: the cron is the only author.
create policy "autopay runs: own home or finances"
  on autopay_runs for select
  using (
    unit_id in (select my_unit_ids())
    or has_capability(association_id, 'finances')
  );
