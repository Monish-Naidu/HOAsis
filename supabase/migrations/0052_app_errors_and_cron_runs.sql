-- What went wrong, and when the crons last ran. The owner's ops page
-- (/admin) reads both; nothing else does.
--
-- app_errors: one row per error the app caught, on the server (instrumentation
-- onRequestError, route handlers) or in a browser (the error pages and the
-- unhandled-rejection listener post to /api/log). `reference` is the request
-- id a person reads off the screen, so a report of "Reference K7QM2X4P" is
-- one lookup.
--
-- cron_runs: one row per call of a daily cron (assessments, billing sweep,
-- autopay), including continuation calls. "Has the cron run today" is a
-- question the ops page can then answer from the table instead of from the
-- Vercel dashboard.
--
-- Both are service-role only. RLS is on with no policies, so anon and
-- authenticated see nothing; the admin client bypasses RLS as it does for
-- every other server-only write.

create table if not exists app_errors (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  reference      text not null,
  level          text not null default 'error' check (level in ('info', 'warn', 'error')),
  source         text not null check (source in ('server', 'client')),
  route          text,
  message        text not null,
  stack          text,
  association_id uuid,
  profile_id     uuid,
  user_agent     text,
  extra          jsonb not null default '{}'::jsonb
);

create index if not exists app_errors_created_at_idx on app_errors (created_at desc);
create index if not exists app_errors_reference_idx on app_errors (reference);

alter table app_errors enable row level security;
revoke all on app_errors from anon, authenticated;

create table if not exists cron_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  ok          boolean not null default true,
  summary     jsonb not null default '{}'::jsonb,
  error       text,
  request_id  text
);

create index if not exists cron_runs_job_started_at_idx on cron_runs (job, started_at desc);

alter table cron_runs enable row level security;
revoke all on cron_runs from anon, authenticated;
