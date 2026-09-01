-- Announcements: what the board tells the whole association.
--
-- Residents were being shown announcements that existed only as demo
-- fixtures; a real association's board had no way to post one, and nothing
-- persisted. What a resident sees must be something the board created and
-- can stand behind, so announcements become rows like everything else.
--
-- Every member reads them. Writing them rides the communications capability,
-- the same grant that covers messaging owners.

create table announcements (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  author_name    text not null,
  category       text not null default 'Notice'
                 check (category in ('Notice', 'Maintenance', 'Event', 'Governance')),
  title          text not null,
  body           text not null default '',
  pinned         boolean not null default false,
  posted_on      date not null default current_date,
  created_at     timestamptz not null default now()
);

create index on announcements (association_id, posted_on desc);

alter table announcements enable row level security;

create policy announcements_read on announcements
  for select using (is_member_of(association_id));
create policy announcements_write on announcements
  for all using (has_capability(association_id, 'communications'))
  with check (has_capability(association_id, 'communications'));
