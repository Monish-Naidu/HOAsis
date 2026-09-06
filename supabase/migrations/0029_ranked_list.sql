-- The ranked list from the competitor comparison, in one pass.
--
-- Nine things the research said every serious HOA product has and this one
-- did not. Each is a small column or a small table, because the shape of
-- each was already decided by the screens that were waiting for it.
--
--   1. Autopay with a cap and a skipped month, kept by the owner on their
--      own membership. A preference until Stripe runs it, but a preference
--      the board can already see on the roster.
--   2. The owner says a notice is fixed. Two columns on the violation and
--      one function that lets the home write only those two.
--   3. A work order hung off a maintenance request. The board already holds
--      update on requests, so this is a jsonb column and nothing else.
--   4. RSVPs on a meeting. Residents cannot write meetings, so one function
--      replaces their own entry in a jsonb list and touches nothing else.
--   5. Delivery status on the email log, written by the provider's webhook.
--   6. Board action items: who agreed to do what, by when, from which
--      meeting. Board members read them, the voting capability writes them.
--   7. Request to join: a code on every association, a table of people who
--      typed it in, and a function anyone may call to add themselves to it.
--      Approving one is the existing add_household, so nothing new can put
--      a person on the roster.

-- ------------------------------------------------------------------ autopay

alter table memberships
  add column if not exists autopay jsonb;

create or replace function set_my_autopay(p_association_id uuid, p_autopay jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update memberships
     set autopay = p_autopay
   where association_id = p_association_id
     and profile_id = auth.uid()
     and ends_on is null;
  if not found then
    raise exception 'You are not a member of that association' using errcode = '42501';
  end if;
end;
$$;

revoke all on function set_my_autopay(uuid, jsonb) from public;
grant execute on function set_my_autopay(uuid, jsonb) to authenticated;

-- ------------------------------------------------------- owner says fixed

alter table violations
  add column if not exists owner_fixed_on   date,
  add column if not exists owner_fixed_note text;

create or replace function mark_violation_fixed(p_violation_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update violations
     set owner_fixed_on = current_date,
         owner_fixed_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_violation_id
     and unit_id in (select my_unit_ids())
     and stage <> 'cured';
  if not found then
    raise exception 'That notice is not about your home, or it is already closed'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function mark_violation_fixed(uuid, text) from public;
grant execute on function mark_violation_fixed(uuid, text) to authenticated;

-- -------------------------------------------------------------- work orders

alter table requests
  add column if not exists work_order jsonb;

-- -------------------------------------------------------------------- rsvps

alter table meetings
  add column if not exists rsvps jsonb not null default '[]'::jsonb;

create or replace function rsvp_meeting(p_meeting_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting meetings%rowtype;
  v_member  memberships%rowtype;
  v_unit    text;
  v_entry   jsonb;
begin
  if p_response not in ('yes', 'no') then
    raise exception 'An answer is yes or no' using errcode = '22000';
  end if;
  select * into v_meeting from meetings where id = p_meeting_id;
  if not found or not is_member_of(v_meeting.association_id) then
    raise exception 'That meeting is not yours to answer' using errcode = '42501';
  end if;
  select * into v_member
    from memberships
   where association_id = v_meeting.association_id
     and profile_id = auth.uid()
     and ends_on is null
   limit 1;
  select label into v_unit from units where id = v_member.unit_id;

  v_entry := jsonb_build_object(
    'profileId', auth.uid()::text,
    'name', v_member.full_name,
    'unit', coalesce(v_unit, ''),
    'response', p_response,
    'at', current_date::text
  );

  update meetings
     set rsvps = coalesce((
           select jsonb_agg(e)
             from jsonb_array_elements(rsvps) e
            where e->>'profileId' is distinct from auth.uid()::text
         ), '[]'::jsonb) || jsonb_build_array(v_entry)
   where id = p_meeting_id;
end;
$$;

revoke all on function rsvp_meeting(uuid, text) from public;
grant execute on function rsvp_meeting(uuid, text) to authenticated;

-- ---------------------------------------------------------- email delivery

alter table email_log
  add column if not exists status    text,
  add column if not exists status_at timestamptz;

create index if not exists email_log_provider_id on email_log (provider_id);

-- ------------------------------------------------------------ action items

create or replace function is_board_of(target uuid)
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
      and m.role <> 'resident'
  );
$$;

create table if not exists action_items (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  meeting_id     uuid references meetings (id) on delete set null,
  title          text not null,
  owner_name     text not null default '',
  due_on         date,
  done_on        date,
  created_by     uuid references profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists action_items_association on action_items (association_id, done_on);

alter table action_items enable row level security;

create policy action_items_read on action_items
  for select using (is_board_of(association_id));
create policy action_items_write on action_items
  for all using (has_capability(association_id, 'voting'))
  with check (has_capability(association_id, 'voting'));

-- --------------------------------------------------------- request to join

alter table associations
  add column if not exists join_code text;

update associations
   set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
 where join_code is null;

alter table associations
  alter column join_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  alter column join_code set not null;

create unique index if not exists associations_join_code on associations (join_code);

create table if not exists join_requests (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  full_name      text not null,
  email          text not null,
  unit_label     text not null default '',
  note           text not null default '',
  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'declined')),
  created_at     timestamptz not null default now(),
  decided_on     date,
  decided_by     text
);

create index if not exists join_requests_association on join_requests (association_id, status);

alter table join_requests enable row level security;

create policy join_requests_read on join_requests
  for select using (has_capability(association_id, 'settings'));
create policy join_requests_decide on join_requests
  for update using (has_capability(association_id, 'settings'))
  with check (has_capability(association_id, 'settings'));

-- What a person sees before they ask: the name and the town, nothing else.
create or replace function association_by_join_code(p_code text)
returns table (name text, city text, state text)
language sql
stable
security definer
set search_path = public
as $$
  select a.name, a.city, a.state
    from associations a
   where a.join_code = upper(btrim(coalesce(p_code, '')))
     and a.deleted_at is null;
$$;

revoke all on function association_by_join_code(text) from public;
grant execute on function association_by_join_code(text) to anon, authenticated;

create or replace function request_to_join(
  p_code  text,
  p_name  text,
  p_email text,
  p_unit  text,
  p_note  text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc associations%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := btrim(coalesce(p_name, ''));
begin
  select * into v_assoc
    from associations
   where join_code = upper(btrim(coalesce(p_code, '')))
     and deleted_at is null;
  if not found then
    raise exception 'No association has that code' using errcode = '22000';
  end if;
  if v_name = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A name and a working email address are needed' using errcode = '22000';
  end if;
  -- One open request per person per association. Asking twice is not an error,
  -- it is the same request, so the second ask is simply absorbed.
  if exists (
    select 1 from join_requests
     where association_id = v_assoc.id
       and lower(email) = v_email
       and status = 'pending'
  ) then
    return v_assoc.name;
  end if;
  -- Guard against a flood from one address across every association.
  if (select count(*) from join_requests
       where lower(email) = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Too many requests from that address today' using errcode = '22000';
  end if;

  insert into join_requests (association_id, full_name, email, unit_label, note)
  values (
    v_assoc.id, v_name, v_email,
    left(btrim(coalesce(p_unit, '')), 80),
    left(btrim(coalesce(p_note, '')), 1000)
  );
  return v_assoc.name;
end;
$$;

revoke all on function request_to_join(text, text, text, text, text) from public;
grant execute on function request_to_join(text, text, text, text, text) to anon, authenticated;
