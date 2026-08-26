-- Everything an association does that is not money.
--
-- Requests, documents, votes, meetings, the forum, vendors and amenities. All
-- of it follows the pattern the money tables established: scoped by
-- association, read by members, written by whoever holds the matching
-- capability, and enforced in the database rather than in a disabled button.
--
-- The one rule worth restating: a resident sees their own request and not a
-- neighbor's, the same way they see their own balance and not a neighbor's.
-- Anything filed against a home is private to that home and the board.

create type request_kind   as enum ('maintenance', 'architectural', 'records', 'amenity');
create type request_status as enum ('submitted', 'in-review', 'approved', 'denied', 'closed');
create type doc_visibility as enum ('public', 'owners', 'board');
create type ballot_status  as enum ('scheduled', 'open', 'closed', 'certified');
create type post_status    as enum ('pending', 'published', 'rejected');

-- --------------------------------------------------------------- requests

create table requests (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  unit_id        uuid not null references units (id) on delete cascade,
  filed_by       uuid references profiles (id) on delete set null,
  reference      text not null,
  kind           request_kind not null,
  title          text not null,
  body           text not null default '',
  status         request_status not null default 'submitted',
  decided_note   text,
  submitted_on   date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (association_id, reference)
);

create index on requests (association_id, status);

-- -------------------------------------------------------------- documents

create table documents (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  name           text not null,
  category       text not null default 'Notices',
  visibility     doc_visibility not null default 'board',
  -- Path in Supabase Storage. The bytes never live in a row.
  storage_path   text,
  size_label     text not null default '',
  updated_on     date not null default current_date,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------- voting

create table meetings (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  title          text not null,
  held_on        date not null,
  held_at        text not null default '',
  location       text not null default '',
  dial_in        text,
  passcode       text,
  status         text not null default 'scheduled',
  created_at     timestamptz not null default now()
);

create table ballots (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  meeting_id     uuid references meetings (id) on delete set null,
  title          text not null,
  body           text[] not null default '{}',
  kind           text not null default 'poll',
  status         ballot_status not null default 'scheduled',
  opens_on       date not null,
  closes_on      date not null,
  -- Homes eligible to vote, and seats being filled. A multi seat election
  -- collects one vote per seat per home, so turnout divides by this.
  seats          smallint not null default 1,
  quorum_required integer not null default 0,
  threshold_label text not null default 'Simple majority',
  created_at     timestamptz not null default now()
);

create table ballot_options (
  id         uuid primary key default gen_random_uuid(),
  ballot_id  uuid not null references ballots (id) on delete cascade,
  label      text not null,
  detail     text,
  position   smallint not null default 0
);

-- One vote per home per ballot. The primary key is the rule.
create table votes (
  ballot_id  uuid not null references ballots (id) on delete cascade,
  unit_id    uuid not null references units (id) on delete cascade,
  option_id  uuid not null references ballot_options (id) on delete cascade,
  -- Handed to the voter so they can confirm their vote counted without the
  -- secretary revealing how anybody voted.
  receipt    text not null,
  cast_at    timestamptz not null default now(),
  primary key (ballot_id, unit_id)
);

-- Tallies, counted by the database so no screen can disagree with another.
create view ballot_tallies with (security_invoker = true) as
  select
    o.ballot_id,
    o.id                          as option_id,
    o.label,
    count(v.unit_id)::integer     as votes
  from ballot_options o
  left join votes v on v.option_id = o.id
  group by o.ballot_id, o.id, o.label;

-- ------------------------------------------------------------------ forum

create table posts (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  author_id      uuid references profiles (id) on delete set null,
  author_name    text not null,
  category       text not null default 'General',
  title          text not null,
  body           text not null default '',
  -- Held for review before neighbors see it. The board approves or rejects.
  status         post_status not null default 'pending',
  moderated_by   text,
  moderated_at   timestamptz,
  pinned         boolean not null default false,
  likes          integer not null default 0,
  created_at     timestamptz not null default now()
);

create index on posts (association_id, status);

-- ---------------------------------------------------------------- vendors

create table vendors (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  name           text not null,
  service        text not null default '',
  ach_enabled    boolean not null default false,
  w9_on_file     boolean not null default false,
  coi_expires_on date,
  default_category text not null default 'Repairs & maintenance',
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------- amenities

create table amenities (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  name           text not null,
  detail         text not null default '',
  reservable     boolean not null default false,
  status         text not null default 'open',
  max_hours      smallint
);

-- ------------------------------------------------------------------ access

alter table requests       enable row level security;
alter table documents      enable row level security;
alter table meetings       enable row level security;
alter table ballots        enable row level security;
alter table ballot_options enable row level security;
alter table votes          enable row level security;
alter table posts          enable row level security;
alter table vendors        enable row level security;
alter table amenities      enable row level security;

-- A request is private to the home it was filed against and the board.
create policy requests_read on requests
  for select using (
    unit_id in (select my_unit_ids()) or has_capability(association_id, 'requests')
  );
create policy requests_file on requests
  for insert with check (unit_id in (select my_unit_ids()));
create policy requests_decide on requests
  for update using (has_capability(association_id, 'requests'));

-- Owners see what is published to owners. The board sees everything.
create policy documents_read on documents
  for select using (
    (visibility in ('public', 'owners') and is_member_of(association_id))
    or has_capability(association_id, 'documents')
  );
create policy documents_write on documents
  for all using (has_capability(association_id, 'documents'));

create policy meetings_read on meetings
  for select using (is_member_of(association_id));
create policy meetings_write on meetings
  for all using (has_capability(association_id, 'voting'));

create policy ballots_read on ballots
  for select using (is_member_of(association_id));
create policy ballots_write on ballots
  for all using (has_capability(association_id, 'voting'));

create policy ballot_options_read on ballot_options
  for select using (
    exists (select 1 from ballots b where b.id = ballot_id and is_member_of(b.association_id))
  );
create policy ballot_options_write on ballot_options
  for all using (
    exists (select 1 from ballots b where b.id = ballot_id and has_capability(b.association_id, 'voting'))
  );

-- A member may cast for a home they hold, and change it while the ballot is
-- open. Nobody reads anybody else's vote: the tally view is the public fact.
create policy votes_read_own on votes
  for select using (unit_id in (select my_unit_ids()));
create policy votes_cast on votes
  for insert with check (
    unit_id in (select my_unit_ids())
    and exists (select 1 from ballots b where b.id = ballot_id and b.status = 'open')
  );
create policy votes_change on votes
  for update using (
    unit_id in (select my_unit_ids())
    and exists (select 1 from ballots b where b.id = ballot_id and b.status = 'open')
  );

-- The forum shows what has been approved, plus your own post while it waits.
create policy posts_read on posts
  for select using (
    is_member_of(association_id)
    and (status = 'published' or author_id = auth.uid() or has_capability(association_id, 'forum'))
  );
create policy posts_write on posts
  for insert with check (is_member_of(association_id) and author_id = auth.uid());
create policy posts_moderate on posts
  for update using (has_capability(association_id, 'forum'));
create policy posts_remove on posts
  for delete using (has_capability(association_id, 'forum') or author_id = auth.uid());

create policy vendors_read on vendors
  for select using (has_capability(association_id, 'vendors'));
create policy vendors_write on vendors
  for all using (has_capability(association_id, 'vendors'));

create policy amenities_read on amenities
  for select using (is_member_of(association_id));
create policy amenities_write on amenities
  for all using (has_capability(association_id, 'settings'));

-- Casting a vote, with the receipt generated where it cannot be forged.
create or replace function cast_vote(p_ballot_id uuid, p_option_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit    uuid;
  v_receipt text;
begin
  select unit_id into v_unit
  from memberships
  where profile_id = auth.uid()
    and ends_on is null
    and association_id = (select association_id from ballots where id = p_ballot_id)
  limit 1;

  if v_unit is null then
    raise exception 'You are not eligible to vote on that ballot' using errcode = '42501';
  end if;

  if not exists (select 1 from ballots where id = p_ballot_id and status = 'open') then
    raise exception 'That ballot is not open' using errcode = '22000';
  end if;

  -- Keep the original receipt when somebody changes their mind, so the code
  -- they wrote down still resolves.
  select receipt into v_receipt from votes where ballot_id = p_ballot_id and unit_id = v_unit;
  if v_receipt is null then
    v_receipt := 'VR-' || to_char(current_date, 'YYYY-MM') || '-' ||
                 lpad((floor(random() * 10000))::text, 4, '0');
  end if;

  insert into votes (ballot_id, unit_id, option_id, receipt)
  values (p_ballot_id, v_unit, p_option_id, v_receipt)
  on conflict (ballot_id, unit_id)
  do update set option_id = excluded.option_id, cast_at = now();

  return v_receipt;
end;
$$;

revoke all on function cast_vote from public;
grant execute on function cast_vote to authenticated;
