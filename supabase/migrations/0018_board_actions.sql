-- What the board does, kept.
--
-- Until now a real association wrote most board actions to the browser and
-- read only Postgres, so the action vanished. This migration gives every one
-- of those actions a place in the database. The shapes mirror the domain
-- types in src/lib/types.ts; where a value is a small structured thing the
-- screens never query by (a thread's messages, a form's fields, a violation's
-- photographs) it is kept as jsonb rather than as a table of its own.
--
-- Every table follows the same rule as the rest of the schema: members read
-- what concerns them, the capability holder writes, and nothing branches on
-- who is asking except through row level security.

-- ------------------------------------------------------------- associations

-- Display preferences with no column of their own: the banner, the home
-- layout, what residents may see. Read as a patch over the defaults.
alter table associations
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------- amenities

alter table amenities
  add column if not exists rules jsonb;

-- ------------------------------------------------------------------ requests

alter type request_kind add value if not exists 'violation-appeal';
alter type request_status add value if not exists 'info-needed';

alter table requests
  add column if not exists due_on         date,
  add column if not exists due_reason     text,
  add column if not exists decided_on     date,
  add column if not exists decided_by     text,
  add column if not exists attachments    jsonb not null default '[]'::jsonb,
  add column if not exists thread         jsonb not null default '[]'::jsonb,
  add column if not exists submission     jsonb,
  add column if not exists certificate_id text;

-- --------------------------------------------------------------------- posts

alter table posts
  add column if not exists unit_label       text not null default '',
  add column if not exists author_role      text,
  add column if not exists rejection_reason text;

-- One like per person, counted onto the post by the function below. The table
-- has row level security and no policies on purpose: only the function
-- touches it.
create table if not exists post_likes (
  post_id    uuid not null references posts (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  liked_at   timestamptz not null default now(),
  primary key (post_id, profile_id)
);
alter table post_likes enable row level security;

create or replace function like_post(p_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_likes       integer;
begin
  select association_id into v_association from posts where id = p_post_id;
  if v_association is null or not is_member_of(v_association) then
    raise exception 'That post is not in your association' using errcode = '42501';
  end if;
  insert into post_likes (post_id, profile_id) values (p_post_id, auth.uid())
  on conflict do nothing;
  update posts
     set likes = (select count(*) from post_likes where post_id = p_post_id)
   where id = p_post_id
  returning likes into v_likes;
  return v_likes;
end;
$$;
revoke all on function like_post(uuid) from public;
grant execute on function like_post(uuid) to authenticated;

-- --------------------------------------------------------- meetings, ballots

alter table meetings
  add column if not exists kind           text not null default 'board',
  add column if not exists agenda         jsonb not null default '[]'::jsonb,
  add column if not exists notice_sent_on date;

alter table ballots
  add column if not exists audience             text not null default 'owners',
  add column if not exists certified_by         text,
  add column if not exists certified_on         date,
  add column if not exists live_results_visible boolean not null default false;

-- ------------------------------------------------------- payment instruments

-- What a resident pays with. Never a card number: the mask, the label, and
-- when Stripe lands, the processor's token. Until then the token column holds
-- the stand-in the demo already uses.
create table if not exists payment_instruments (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  unit_id        uuid not null references units (id) on delete cascade,
  profile_id     uuid references profiles (id) on delete set null,
  kind           text not null,
  label          text not null,
  mask           text not null default '',
  is_default     boolean not null default false,
  added_on       date not null default current_date,
  detail         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists payment_instruments_unit_idx on payment_instruments (unit_id);
alter table payment_instruments enable row level security;
create policy payment_instruments_own on payment_instruments
  for all using (unit_id in (select my_unit_ids()))
  with check (unit_id in (select my_unit_ids()));

-- ------------------------------------------------------------------- payouts

create table if not exists payouts (
  id                 uuid primary key default gen_random_uuid(),
  association_id     uuid not null references associations (id) on delete cascade,
  vendor_id          uuid references vendors (id) on delete set null,
  vendor_name        text not null,
  invoice_number     text not null default '',
  amount_cents       integer not null check (amount_cents > 0),
  method             text not null default 'ach',
  status             text not null default 'needs-approval',
  issued_on          date not null default current_date,
  expected_on        date not null default current_date,
  approvals          jsonb not null default '[]'::jsonb,
  approvals_required smallint not null default 2,
  created_at         timestamptz not null default now()
);
alter table payouts enable row level security;
create policy payouts_read on payouts
  for select using (has_capability(association_id, 'finances'));
create policy payouts_write on payouts
  for all using (has_capability(association_id, 'finances'))
  with check (has_capability(association_id, 'finances'));

-- ------------------------------------------------------ reports, violations

-- A neighbour's report. The reporter reads their own; compliance holders read
-- all of them. The accused home never reaches this table, which is the point
-- of keeping it apart from violations.
create table if not exists violation_reports (
  id                  uuid primary key default gen_random_uuid(),
  association_id      uuid not null references associations (id) on delete cascade,
  reference           text not null,
  reporter_profile_id uuid references profiles (id) on delete set null,
  reporter_name       text not null default '',
  reporter_unit       text not null default '',
  subject_unit        text not null,
  subject_unit_id     uuid references units (id) on delete set null,
  what                text not null,
  observed_on         date not null,
  submitted_on        date not null default current_date,
  status              text not null default 'new',
  verified_by         text,
  verified_on         date,
  verification_note   text,
  dismissed_reason    text,
  violation_id        uuid,
  created_at          timestamptz not null default now()
);
alter table violation_reports enable row level security;
create policy violation_reports_read on violation_reports
  for select using (
    reporter_profile_id = auth.uid() or has_capability(association_id, 'compliance')
  );
create policy violation_reports_file on violation_reports
  for insert with check (is_member_of(association_id) and reporter_profile_id = auth.uid());
create policy violation_reports_decide on violation_reports
  for update using (has_capability(association_id, 'compliance'));

create table if not exists violations (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  reference      text not null,
  unit_id        uuid references units (id) on delete set null,
  unit_label     text not null default '',
  owner_name     text not null default '',
  rule           text not null,
  rule_citation  text not null default '',
  stage          text not null default 'courtesy',
  opened_on      date not null default current_date,
  next_action_on date,
  photos         jsonb not null default '[]'::jsonb,
  fine_cents     integer not null default 0,
  report_id      uuid references violation_reports (id) on delete set null,
  created_at     timestamptz not null default now()
);
alter table violations enable row level security;
create policy violations_read on violations
  for select using (
    unit_id in (select my_unit_ids()) or has_capability(association_id, 'compliance')
  );
create policy violations_write on violations
  for all using (has_capability(association_id, 'compliance'))
  with check (has_capability(association_id, 'compliance'));

-- ------------------------------------------------------------------- threads

create table if not exists threads (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  subject        text not null,
  unit_id        uuid references units (id) on delete set null,
  participants   jsonb not null default '[]'::jsonb,
  tag            text not null default 'General',
  updated_on     date not null default current_date,
  unread         boolean not null default false,
  messages       jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);
alter table threads enable row level security;
create policy threads_read on threads
  for select using (
    unit_id in (select my_unit_ids()) or has_capability(association_id, 'communications')
  );
create policy threads_write on threads
  for all using (has_capability(association_id, 'communications'))
  with check (has_capability(association_id, 'communications'));

-- -------------------------------------------------------- governing articles

-- The text of the declaration, bylaws and rules, one article per row, so an
-- owner can search it. Unique per document and number: two Article VIIs is
-- the ambiguity a board cites into.
create table if not exists governing_articles (
  id                  uuid primary key default gen_random_uuid(),
  association_id      uuid not null references associations (id) on delete cascade,
  document            text not null check (document in ('declaration', 'bylaws', 'rules')),
  number              text not null,
  title               text not null default '',
  topic               text not null default 'governance',
  text                jsonb not null default '[]'::jsonb,
  plain               text,
  affects             text not null default 'both',
  amended_on          date,
  amendment_ballot_id uuid,
  adopted_on          date,
  disclosure_topics   jsonb,
  extraction          jsonb,
  position            integer not null default 0,
  created_at          timestamptz not null default now(),
  unique (association_id, document, number)
);
alter table governing_articles enable row level security;
create policy governing_articles_read on governing_articles
  for select using (is_member_of(association_id));
create policy governing_articles_write on governing_articles
  for all using (has_capability(association_id, 'documents'))
  with check (has_capability(association_id, 'documents'));

-- -------------------------------------------------------------------- budget

create table if not exists budget_lines (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  category       text not null,
  annual_cents   bigint not null default 0,
  kind           text not null check (kind in ('income', 'expense')),
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);
alter table budget_lines enable row level security;
create policy budget_lines_read on budget_lines
  for select using (is_member_of(association_id));
create policy budget_lines_write on budget_lines
  for all using (has_capability(association_id, 'finances'))
  with check (has_capability(association_id, 'finances'));

-- ------------------------------------------------------------------ reserves

create table if not exists reserve_components (
  id                     uuid primary key default gen_random_uuid(),
  association_id         uuid not null references associations (id) on delete cascade,
  name                   text not null,
  useful_life_years      integer not null default 0,
  remaining_life_years   integer not null default 0,
  replacement_cost_cents bigint not null default 0,
  funded_cents           bigint not null default 0,
  last_inspection        date,
  note                   text,
  created_at             timestamptz not null default now()
);
alter table reserve_components enable row level security;
create policy reserve_components_read on reserve_components
  for select using (is_member_of(association_id));
create policy reserve_components_write on reserve_components
  for all using (has_capability(association_id, 'finances'))
  with check (has_capability(association_id, 'finances'));

-- ----------------------------------------------------------------- templates

-- A board's own wording for the letters it sends. A row with a baseline_id
-- replaces the stock template of that id; a row without one is an addition.
create table if not exists message_templates (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  baseline_id    text,
  name           text not null,
  description    text not null default '',
  subject        text not null default '',
  body           text not null default '',
  trigger        text not null default 'general',
  updated_on     date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (association_id, baseline_id)
);
alter table message_templates enable row level security;
create policy message_templates_read on message_templates
  for select using (has_capability(association_id, 'communications'));
create policy message_templates_write on message_templates
  for all using (has_capability(association_id, 'communications'))
  with check (has_capability(association_id, 'communications'));

-- --------------------------------------------------------------------- forms

-- Forms the board uploads. The baseline forms ship in code and are not rows.
create table if not exists forms (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  label          text not null,
  description    text not null default '',
  file_name      text not null default '',
  size_label     text not null default '',
  updated_on     date not null default current_date,
  fields         jsonb,
  governed_by    text,
  decision_days  integer,
  created_at     timestamptz not null default now()
);
alter table forms enable row level security;
create policy forms_read on forms
  for select using (is_member_of(association_id));
create policy forms_write on forms
  for all using (has_capability(association_id, 'settings'))
  with check (has_capability(association_id, 'settings'));

-- ---------------------------------------------------------------- households

-- Adding a home to the roster with the seat that lets its household sign in,
-- the same way create_association seats the first households. Runs as the
-- definer because it touches units and memberships together; authorisation
-- is the settings capability, checked explicitly.
create or replace function add_household(
  p_association_id uuid,
  p_unit_id        uuid,
  p_name           text,
  p_email          text,
  p_unit           text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := btrim(coalesce(p_unit, ''));
  v_unit  uuid;
begin
  if not has_capability(p_association_id, 'settings') then
    raise exception 'Only a settings holder can add a household' using errcode = '42501';
  end if;
  if v_label = '' then
    raise exception 'A home needs a unit or lot' using errcode = '22000';
  end if;
  if exists (select 1 from units where association_id = p_association_id and label = v_label) then
    raise exception 'Unit % is already on the roster', v_label using errcode = '23505';
  end if;

  insert into units (id, association_id, label)
  values (coalesce(p_unit_id, gen_random_uuid()), p_association_id, v_label)
  returning id into v_unit;

  insert into memberships (association_id, unit_id, invited_email, full_name, role, capabilities)
  values (
    p_association_id, v_unit,
    nullif(btrim(coalesce(p_email, '')), ''),
    btrim(coalesce(p_name, '')),
    'resident', '{}'::capability[]
  );

  -- Somebody who already has an account is seated now rather than waiting for
  -- a signup that will never come.
  update memberships m
     set profile_id = p.id
    from profiles p
   where m.unit_id = v_unit
     and m.profile_id is null
     and m.invited_email is not null
     and lower(p.email) = lower(m.invited_email);

  return v_unit;
end;
$$;
revoke all on function add_household(uuid, uuid, text, text, text) from public;
grant execute on function add_household(uuid, uuid, text, text, text) to authenticated;

-- Taking a home off the roster. Refused when the home has a statement, since
-- deleting a home with charges on it deletes the charges, and a sale is what
-- transfer_home is for. Refused for the President's own home, always.
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
revoke all on function remove_household(uuid) from public;
grant execute on function remove_household(uuid) to authenticated;
