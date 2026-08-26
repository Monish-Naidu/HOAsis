-- Setting up, and the cover photograph.
--
-- Two things a board needs that the schema had no room for.
--
-- Not every association has amenities, a reserve study, or a single vendor. A
-- checklist that keeps asking for things you do not have trains people to
-- ignore checklists, so a board can mark an optional item as not applicable
-- and it stops asking. That is recorded rather than assumed, because the
-- decision belongs to them and they are entitled to change it later.
--
-- Nothing required can be dismissed. An association still needs somewhere for
-- dues to land whether or not it finds the question annoying.

create table setup_dismissals (
  association_id uuid not null references associations (id) on delete cascade,
  -- Matches a key in the task registry. Text rather than an enum so adding a
  -- task is a code change and not a migration.
  task_key       text not null,
  -- Their own words about why, shown when they come back to it.
  note           text,
  dismissed_by   uuid references profiles (id) on delete set null,
  dismissed_at   timestamptz not null default now(),
  primary key (association_id, task_key)
);

alter table setup_dismissals enable row level security;

create policy setup_dismissals_read on setup_dismissals
  for select using (is_member_of(association_id));
create policy setup_dismissals_write on setup_dismissals
  for all using (has_capability(association_id, 'settings'));

-- ------------------------------------------------------------------ photos

-- The cover photograph, and anything else an association uploads about itself.
-- Public to read: it sits behind the association's name on a page a resident
-- opens before they are signed in.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community',
  'community',
  true,
  8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files are stored under the association's id, which is what makes the policy
-- below expressible: the first path segment is the tenant.
create policy "community photos are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'community');

create policy "settings holders upload their own association's photos"
  on storage.objects for insert
  with check (
    bucket_id = 'community'
    and has_capability((storage.foldername(name))[1]::uuid, 'settings')
  );

create policy "settings holders replace their own association's photos"
  on storage.objects for update
  using (
    bucket_id = 'community'
    and has_capability((storage.foldername(name))[1]::uuid, 'settings')
  );

create policy "settings holders remove their own association's photos"
  on storage.objects for delete
  using (
    bucket_id = 'community'
    and has_capability((storage.foldername(name))[1]::uuid, 'settings')
  );

-- Where the cover photograph lives, and the rest of what a board can say about
-- itself without needing a new table each time.
alter table associations
  add column if not exists photo_url text,
  add column if not exists photo_credit text,
  -- Recorded during setup, and shown on the annual budget report.
  add column if not exists insurance_carrier text,
  add column if not exists insurance_policy_no text,
  add column if not exists insurance_expires_on date,
  -- Set once a board has been through setup, so the hub stops taking over the
  -- dashboard even while optional items remain open.
  add column if not exists setup_completed_at timestamptz;
