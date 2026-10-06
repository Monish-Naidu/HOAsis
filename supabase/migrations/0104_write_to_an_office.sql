-- An owner can write to an office on the board, not only to the board.
--
-- Until now every message an owner started went to "the board". Owners know
-- who they want: the Treasurer for a dues question, the Secretary for the
-- minutes. A thread now carries the office it is addressed to, and the board
-- inbox can show each officer their own.
--
-- Three rules this follows:
--   * An office, not a person. The column holds 'treasurer', not a profile,
--     so a thread follows the office when officers change at an election.
--   * The board still sees everything. threads_read (0044, kept by 0089) is
--     not touched: anyone with the communications capability reads every
--     thread. The office only says who it is assigned to, and who is emailed.
--   * Nothing existing breaks. The column defaults to 'board', and
--     start_owner_thread gains one optional last parameter, so a caller that
--     does not know about offices still works and addresses the whole board.
--
-- reply_as_board is replaced (copied whole from 0103) to stamp the office the
-- replier holds on the message as 'fromOffice', next to the unchanged 'from',
-- so a reply can be signed "Dana Whitcomb, Treasurer, for the board" and the
-- signature does not change when the next election does.

alter table threads
  add column if not exists to_role text not null default 'board'
  check (to_role in ('board', 'president', 'vice-president', 'treasurer', 'secretary'));

-- The old four-argument function is dropped first: adding a parameter with
-- create or replace would leave it beside the new one, and a call with four
-- named arguments would then match both and fail as ambiguous.
drop function if exists start_owner_thread(uuid, text, text, text);

create or replace function start_owner_thread(
  p_unit_id uuid,
  p_subject text,
  p_body text,
  p_tag text default 'General',
  p_to_role text default 'board'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_message jsonb;
  v_id uuid;
begin
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'A message needs a subject and a few words' using errcode = '22000';
  end if;
  if p_tag not in ('Billing', 'Maintenance', 'Governance', 'Architectural', 'General') then
    raise exception 'Unknown topic' using errcode = '22000';
  end if;
  if p_to_role is null
     or p_to_role not in ('board', 'president', 'vice-president', 'treasurer', 'secretary') then
    raise exception 'Unknown office' using errcode = '22000';
  end if;
  v_message := owner_message(p_unit_id, trim(p_body));
  select association_id into v_association from units where id = p_unit_id;
  insert into threads (association_id, subject, unit_id, participants, tag, updated_on, unread, messages, to_role)
  values (
    v_association,
    trim(p_subject),
    p_unit_id,
    jsonb_build_array(v_message ->> 'from'),
    p_tag,
    current_date,
    true,
    jsonb_build_array(v_message),
    p_to_role
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function start_owner_thread(uuid, text, text, text, text) from public;
revoke all on function start_owner_thread(uuid, text, text, text, text) from anon;
grant execute on function start_owner_thread(uuid, text, text, text, text) to authenticated;
grant execute on function start_owner_thread(uuid, text, text, text, text) to service_role;

-- ------------------------------------------------------- reply_as_board
-- Copied whole from 0103, plus the office of the replier.

create or replace function reply_as_board(p_thread_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread   threads%rowtype;
  v_messages jsonb;
  v_name     text;
  v_role     text;
  v_message  jsonb;
  v_home     text;
begin
  if coalesce(trim(p_body), '') = '' then
    raise exception 'Write a few words first' using errcode = '22000';
  end if;

  -- Locked, so two replies sent in the same second take turns and each is
  -- appended to what the other left.
  select * into v_thread from threads where id = p_thread_id for update;

  -- The same rule as threads_write. A thread that does not exist gets the
  -- same answer as one the caller may not touch.
  if v_thread.id is null
     or not (
       has_capability(v_thread.association_id, 'communications')
       or (v_thread.tag = 'Billing' and has_capability(v_thread.association_id, 'finances'))
     ) then
    raise exception 'That conversation is not yours to answer' using errcode = '42501';
  end if;

  v_messages := case
    when jsonb_typeof(v_thread.messages) = 'array' then v_thread.messages
    else '[]'::jsonb
  end;

  -- The sender as their seat names them in this association, which is the
  -- name the browser put on a reply, and the office that seat holds.
  select m.full_name, m.role::text into v_name, v_role
    from memberships m
   where m.association_id = v_thread.association_id
     and m.profile_id = auth.uid()
     and m.ends_on is null
   order by m.created_at
   limit 1;

  v_message := jsonb_build_object(
    'id', 'm-' || p_thread_id::text || '-' || jsonb_array_length(v_messages)::text,
    'at', current_date::text,
    'from', coalesce(nullif(trim(v_name), ''), 'Board'),
    'fromRole', 'board',
    'direction', 'outbound',
    -- The client emails the owner once this returns, as it does today.
    'channel', 'email',
    'body', trim(p_body)
  );
  -- Only an office, never 'resident'. A seat with no office signs as the board.
  if v_role in ('president', 'vice-president', 'treasurer', 'secretary') then
    v_message := v_message || jsonb_build_object('fromOffice', v_role);
  end if;

  update threads
     set messages = v_messages || jsonb_build_array(v_message),
         unread = false,
         updated_on = current_date
   where id = p_thread_id;

  select label into v_home from units where id = v_thread.unit_id;
  perform record_activity(v_thread.association_id, 'thread', p_thread_id,
    case when v_home is null then 'Reply posted to an owner'
         else format('Reply posted to %s', v_home) end,
    jsonb_build_object('unit_id', v_thread.unit_id, 'home', v_home, 'subject', v_thread.subject));

  return v_message;
end;
$$;

revoke all on function reply_as_board(uuid, text) from public;
revoke execute on function reply_as_board(uuid, text) from anon;
grant execute on function reply_as_board(uuid, text) to authenticated;
grant execute on function reply_as_board(uuid, text) to service_role;
