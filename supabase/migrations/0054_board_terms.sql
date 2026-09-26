-- Who held which office, and when.
--
-- A role change is an update in place on the membership, so ten years of
-- officers left no trace: Settings named the sitting board and nobody could
-- say who was treasurer in 2019. Minutes name them, but minutes are files.
-- This table keeps one row per term, written by a trigger on memberships
-- so every path that changes a role (Settings, transfer_presidency, a sale
-- closing a seat) records it without knowing the table exists.
--
-- Readable by every member: the board's history is the association's own,
-- and the annual meeting reads it out loud. Written only by the trigger.

create table if not exists board_terms (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  -- Null once the seat itself is gone; the term stays.
  membership_id  uuid references memberships (id) on delete set null,
  unit_id        uuid references units (id) on delete set null,
  full_name      text not null,
  role           board_role not null,
  starts_on      date not null,
  -- Null means still in office.
  ends_on        date,
  created_at     timestamptz not null default now()
);

create index if not exists board_terms_association_idx on board_terms (association_id, starts_on);
create index if not exists board_terms_membership_open_idx on board_terms (membership_id) where ends_on is null;

alter table board_terms enable row level security;

drop policy if exists board_terms_read on board_terms;
create policy board_terms_read on board_terms
  for select using (is_member_of(association_id));

create or replace function board_terms_track()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role <> 'resident' and new.ends_on is null then
      insert into board_terms (association_id, membership_id, unit_id, full_name, role, starts_on)
      values (new.association_id, new.id, new.unit_id, new.full_name, new.role, new.starts_on);
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    -- The old office ends today and the new one starts today. A seat handed
    -- over on a closing date still reads as today's change of officer.
    update board_terms
       set ends_on = greatest(current_date, starts_on)
     where membership_id = old.id and ends_on is null;
    if new.role <> 'resident' and new.ends_on is null then
      insert into board_terms (association_id, membership_id, unit_id, full_name, role, starts_on)
      values (new.association_id, new.id, new.unit_id, new.full_name, new.role, current_date);
    end if;
  elsif new.ends_on is not null and old.ends_on is null then
    -- The seat closed (a sale, a removal): the office ends with it.
    update board_terms
       set ends_on = greatest(new.ends_on, starts_on)
     where membership_id = old.id and ends_on is null;
  end if;

  if new.full_name is distinct from old.full_name then
    update board_terms set full_name = new.full_name where membership_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists board_terms_track on memberships;
create trigger board_terms_track
  after insert or update of role, ends_on, full_name on memberships
  for each row execute function board_terms_track();

-- What is already known: every seat that holds or held an office. A seat
-- whose role changed before today carries its membership's start, which is
-- the earliest the office can have begun; nothing older is on record.
insert into board_terms (association_id, membership_id, unit_id, full_name, role, starts_on, ends_on)
select m.association_id, m.id, m.unit_id, m.full_name, m.role, m.starts_on, m.ends_on
from memberships m
where m.role <> 'resident'
  and not exists (select 1 from board_terms t where t.membership_id = m.id);
