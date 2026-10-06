-- Every board write that changes money or records something leaves an
-- activity row.
--
-- Left out until now: a credit (a direct insert into charges), a change to
-- one home's dues, an owner's email, a vendor added, a meeting scheduled or
-- its notice sent, a notice about a home, and a reply to an owner. Settings,
-- Activity showed a board that had done none of it.
--
--   add_credit(unit, amount, label)  new. A credit was a client insert into
--                                    charges; it goes through here so the
--                                    activity record names the person. Copied
--                                    from add_charge (0086), negative amount,
--                                    kind credit.
--   set_home_dues                    copied whole from 0102, plus the row.
--   reply_as_board                   copied whole from 0072, plus the row.
--   triggers                         vendors insert, meetings insert and
--                                    notice_sent_on, violations insert, and a
--                                    seat's invited_email, in the style of
--                                    0059.
--
-- The summaries carry the home's raw label ("1") after "for", and the home's
-- id or label in details. The screen puts the community's word in front
-- ("Lot 1"), as it does everywhere else; the database does not know the word.

-- ------------------------------------------------------------- add_credit

create or replace function add_credit(
  p_unit_id      uuid,
  p_amount_cents integer,
  p_label        text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller      uuid := auth.uid();
  v_association uuid;
  v_unit_label  text;
  v_closed      timestamptz;
  v_label       text := btrim(coalesce(p_label, ''));
  v_credit      uuid;
begin
  if v_caller is null then
    raise exception 'Sign in to add a credit' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 10000000 then
    raise exception 'A credit has to be between $0.01 and $100,000' using errcode = '22000';
  end if;
  if length(v_label) = 0 then
    raise exception 'Say what the credit is for' using errcode = '22000';
  end if;
  if length(v_label) > 80 then
    raise exception 'Keep what the credit is for to 80 characters' using errcode = '22000';
  end if;

  select u.association_id, u.label, a.deleted_at
    into v_association, v_unit_label, v_closed
  from units u
  join associations a on a.id = u.association_id
  where u.id = p_unit_id;
  if v_association is null or v_closed is not null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'finances') then
    raise exception 'You cannot add a credit for that home' using errcode = '42501';
  end if;

  insert into charges (association_id, unit_id, kind, label, amount_cents, due_on)
  values (v_association, p_unit_id, 'credit', v_label, -p_amount_cents, current_date)
  returning id into v_credit;

  perform record_activity(v_association, 'charge', v_credit,
    format('Credit of $%s added for %s: %s',
      to_char(p_amount_cents / 100.0, 'FM999,999,990.00'), coalesce(v_unit_label, 'a home'), v_label),
    jsonb_build_object('unit_id', p_unit_id, 'home', v_unit_label, 'amount_cents', -p_amount_cents));

  return v_credit;
end;
$$;

revoke all on function add_credit(uuid, integer, text) from public;
revoke execute on function add_credit(uuid, integer, text) from anon;
grant execute on function add_credit(uuid, integer, text) to authenticated;
grant execute on function add_credit(uuid, integer, text) to service_role;

-- --------------------------------------------------------- set_home_dues
-- Copied whole from 0102. The only addition is the activity row, written
-- when the amount actually changes.

create or replace function set_home_dues(
  p_unit_id    uuid,
  p_dues_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_label       text;
  v_was         integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to change dues' using errcode = '42501';
  end if;
  if p_dues_cents is not null and p_dues_cents < 0 then
    raise exception 'Dues cannot be negative' using errcode = '22000';
  end if;
  -- $100,000 a period, the ceiling the forms hold (duesProblem).
  if p_dues_cents is not null and p_dues_cents > 10000000 then
    raise exception 'That looks too high. Dues are per home, per period.' using errcode = '22000';
  end if;

  select association_id, label, dues_cents into v_association, v_label, v_was
    from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not (has_capability(v_association, 'finances')
          or has_capability(v_association, 'settings')) then
    raise exception 'You cannot change dues for that home' using errcode = '42501';
  end if;

  update units set dues_cents = p_dues_cents where id = p_unit_id;

  if p_dues_cents is distinct from v_was then
    perform record_activity(v_association, 'unit', p_unit_id,
      case when p_dues_cents is null
        then format('Dues for %s set back to the standard amount', v_label)
        else format('Dues for %s set to $%s', v_label, to_char(p_dues_cents / 100.0, 'FM999,999,990.00'))
      end,
      jsonb_build_object('unit_id', p_unit_id, 'home', v_label,
                         'from_cents', v_was, 'to_cents', p_dues_cents));
  end if;
end;
$$;

revoke all on function set_home_dues(uuid, integer) from public;
revoke execute on function set_home_dues(uuid, integer) from anon;
grant execute on function set_home_dues(uuid, integer) to authenticated;

-- ------------------------------------------------------- reply_as_board
-- Copied whole from 0072, plus the activity row. The words of the reply stay
-- in the thread; the record says only who answered which home.

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
  -- name the browser put on a reply.
  select m.full_name into v_name
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

-- -------------------------------------------------------------- triggers
-- Only a signed in person's writes. Seeding and imports run as the service
-- role and are not board decisions.

create or replace function activity_vendors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  perform record_activity(new.association_id, 'vendor', new.id,
    format('Vendor %s added', new.name),
    jsonb_build_object('service', new.service));
  return new;
end;
$$;

drop trigger if exists activity_vendors on vendors;
create trigger activity_vendors
  after insert on vendors
  for each row execute function activity_vendors();

-- A meeting scheduled, and its notice sent.
create or replace function activity_meetings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform record_activity(new.association_id, 'meeting', new.id,
      -- The date goes in as stored (2026-10-14); the screen writes it out.
      format('Meeting "%s" scheduled for %s', new.title, new.held_on),
      jsonb_build_object('held_on', new.held_on));
    return new;
  end if;
  if new.notice_sent_on is not null and old.notice_sent_on is null then
    perform record_activity(new.association_id, 'meeting', new.id,
      format('Notice of meeting "%s" sent to owners', new.title),
      jsonb_build_object('notice_sent_on', new.notice_sent_on));
  end if;
  return new;
end;
$$;

drop trigger if exists activity_meetings on meetings;
create trigger activity_meetings
  after insert or update of notice_sent_on on meetings
  for each row execute function activity_meetings();

-- A notice about a home, from the board or raised off a neighbour's report.
create or replace function activity_violations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform record_activity(new.association_id, 'violation', new.id,
    format('Notice sent for %s: %s', coalesce(nullif(new.unit_label, ''), 'a home'), new.rule),
    jsonb_build_object('unit_id', new.unit_id, 'home', new.unit_label, 'reference', new.reference));
  return new;
end;
$$;

drop trigger if exists activity_violations on violations;
create trigger activity_violations
  after insert on violations
  for each row execute function activity_violations();

-- An owner's email changed (change_owner_email, 0080, rewrites the seat's
-- invited_email). A first invitation is not a change.
create or replace function activity_seat_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home text;
begin
  if old.invited_email is null or lower(old.invited_email) = lower(coalesce(new.invited_email, '')) then
    return new;
  end if;
  select label into v_home from units where id = new.unit_id;
  perform record_activity(new.association_id, 'seat', new.id,
    format('Email for %s changed from %s to %s', coalesce(v_home, 'a home'), old.invited_email, new.invited_email),
    jsonb_build_object('unit_id', new.unit_id, 'home', v_home));
  return new;
end;
$$;

drop trigger if exists activity_seat_email on memberships;
create trigger activity_seat_email
  after update of invited_email on memberships
  for each row execute function activity_seat_email();
