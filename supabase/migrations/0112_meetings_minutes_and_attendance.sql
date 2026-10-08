-- 0112: a meeting can be moved, cancelled, minuted, and say who came.
--
-- A board holds one a month. Until now a meeting could be scheduled and
-- noticed and nothing after: a change of date meant a new meeting, there
-- was no cancelled state, the minutes were a file somebody uploaded to
-- Documents, and attendance was not recorded anywhere. Section 15 of the
-- tracker, "Meetings: change the date, cancel, minutes, who attended".
--
-- Columns, all on meetings:
--   cancelled_on, cancel_reason   a cancelled meeting stays on the record
--                                 with why; status becomes 'cancelled'
--   rescheduled_from              the date it was first noticed for, so the
--                                 notice of the change can say "was Oct 3"
--   minutes                       plain text, written by the board after;
--                                 minutes_on is when they were recorded
--   attended                      [{name, unit, role}] as marked by the
--                                 board; the rsvps column stays what the
--                                 owners said beforehand
--
-- A function per act, each asking the meetings capability and the billing
-- lock, each writing an activity row, so the record of the meeting is
-- complete without a screen reading five columns to work out what
-- happened. Direct updates by the board stay allowed (meetings_write), as
-- they are today, for the fields a form edits.

alter table meetings
  add column if not exists cancelled_on     date,
  add column if not exists cancel_reason    text,
  add column if not exists rescheduled_from date,
  add column if not exists minutes          text,
  add column if not exists minutes_on       date,
  add column if not exists attended         jsonb not null default '[]'::jsonb;

create or replace function meeting_capability(p_association_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Meetings and votes are one capability (meetings_write, 0005).
  if not has_capability(p_association_id, 'voting') then
    raise exception 'You cannot change meetings for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(p_association_id);
end;
$$;

revoke all on function meeting_capability(uuid) from public;

create or replace function reschedule_meeting(p_meeting_id uuid, p_held_on date, p_held_at text, p_location text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting meetings%rowtype;
begin
  select * into v_meeting from meetings where id = p_meeting_id;
  if not found then
    raise exception 'No such meeting' using errcode = 'P0002';
  end if;
  perform meeting_capability(v_meeting.association_id);
  if v_meeting.status in ('ended', 'cancelled') then
    raise exception 'That meeting is over' using errcode = '22023';
  end if;
  if p_held_on < current_date then
    raise exception 'A meeting cannot be moved into the past' using errcode = '22023';
  end if;

  update meetings
     set held_on = p_held_on,
         held_at = coalesce(p_held_at, held_at),
         location = coalesce(nullif(trim(p_location), ''), location),
         -- The first noticed date is what the notice of the change names.
         rescheduled_from = coalesce(rescheduled_from, case when held_on <> p_held_on then held_on end),
         status = 'scheduled'
   where id = p_meeting_id;

  perform record_activity(v_meeting.association_id, 'meeting', p_meeting_id,
    'Moved ' || v_meeting.title || ' to ' || to_char(p_held_on, 'FMMonth FMDD, YYYY'),
    jsonb_build_object('was', v_meeting.held_on, 'now', p_held_on));
end;
$$;

create or replace function cancel_meeting(p_meeting_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting meetings%rowtype;
begin
  select * into v_meeting from meetings where id = p_meeting_id;
  if not found then
    raise exception 'No such meeting' using errcode = 'P0002';
  end if;
  perform meeting_capability(v_meeting.association_id);
  if v_meeting.status in ('ended', 'cancelled') then
    raise exception 'That meeting is over' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why the meeting is cancelled' using errcode = '22023';
  end if;

  update meetings
     set status = 'cancelled', cancelled_on = current_date, cancel_reason = trim(p_reason)
   where id = p_meeting_id;

  perform record_activity(v_meeting.association_id, 'meeting', p_meeting_id,
    'Cancelled ' || v_meeting.title || ' (' || to_char(v_meeting.held_on, 'FMMonth FMDD') || ')',
    jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create or replace function record_minutes(p_meeting_id uuid, p_minutes text, p_attended jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting meetings%rowtype;
  v_count   integer;
begin
  select * into v_meeting from meetings where id = p_meeting_id;
  if not found then
    raise exception 'No such meeting' using errcode = 'P0002';
  end if;
  perform meeting_capability(v_meeting.association_id);
  if v_meeting.status = 'cancelled' then
    raise exception 'A cancelled meeting has no minutes' using errcode = '22023';
  end if;
  if v_meeting.held_on > current_date then
    raise exception 'The meeting has not happened yet' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_minutes, ''))) < 10 then
    raise exception 'Write the minutes first' using errcode = '22023';
  end if;
  if length(p_minutes) > 20000 then
    raise exception 'Keep the minutes under 20,000 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_attended, '[]'::jsonb)) <> 'array' then
    raise exception 'Attendance is a list' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(coalesce(p_attended, '[]'::jsonb));

  update meetings
     set minutes = trim(p_minutes),
         minutes_on = current_date,
         attended = coalesce(p_attended, '[]'::jsonb),
         status = 'ended'
   where id = p_meeting_id;

  perform record_activity(v_meeting.association_id, 'meeting', p_meeting_id,
    'Recorded minutes for ' || v_meeting.title || ', ' || v_count || ' attended',
    jsonb_build_object('attended', v_count, 'first_time', v_meeting.minutes is null));
end;
$$;

revoke all on function reschedule_meeting(uuid, date, text, text) from public;
revoke all on function cancel_meeting(uuid, text) from public;
revoke all on function record_minutes(uuid, text, jsonb) from public;
grant execute on function reschedule_meeting(uuid, date, text, text) to authenticated;
grant execute on function cancel_meeting(uuid, text) to authenticated;
grant execute on function record_minutes(uuid, text, jsonb) to authenticated;
