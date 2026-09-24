-- An owner can write to the board, and a treasurer can read the billing mail.
--
-- The board had an inbox of conversations with owners, and owners had no way
-- to start or answer one inside the product: threads were writable only with
-- the communications capability. Two functions let a member of a home post to
-- that home's threads without opening the table to them.
--
-- A past due conversation was readable by the secretary, who holds
-- communications, and not by the treasurer, who holds the balance it is about.
-- Billing threads are now readable with finances too.

drop policy if exists threads_read on threads;
create policy threads_read on threads
  for select using (
    unit_id in (select my_unit_ids())
    or has_capability(association_id, 'communications')
    or (tag = 'Billing' and has_capability(association_id, 'finances'))
  );

-- Replies to a billing thread come from whoever answers the money.
drop policy if exists threads_write on threads;
create policy threads_write on threads
  for all using (
    has_capability(association_id, 'communications')
    or (tag = 'Billing' and has_capability(association_id, 'finances'))
  )
  with check (
    has_capability(association_id, 'communications')
    or (tag = 'Billing' and has_capability(association_id, 'finances'))
  );

create or replace function owner_message(p_unit_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select m.full_name into v_name
    from memberships m
   where m.unit_id = p_unit_id and m.profile_id = auth.uid() and m.ends_on is null
   limit 1;
  if v_name is null then
    raise exception 'That home is not yours to write for' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', gen_random_uuid()::text,
    'at', current_date::text,
    'from', v_name,
    'fromRole', 'resident',
    'direction', 'inbound',
    'channel', 'portal',
    'body', p_body
  );
end;
$$;

create or replace function start_owner_thread(
  p_unit_id uuid,
  p_subject text,
  p_body text,
  p_tag text default 'General'
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
  v_message := owner_message(p_unit_id, trim(p_body));
  select association_id into v_association from units where id = p_unit_id;
  insert into threads (association_id, subject, unit_id, participants, tag, updated_on, unread, messages)
  values (
    v_association,
    trim(p_subject),
    p_unit_id,
    jsonb_build_array(v_message ->> 'from'),
    p_tag,
    current_date,
    true,
    jsonb_build_array(v_message)
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function reply_as_owner(p_thread_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit uuid;
  v_message jsonb;
begin
  if coalesce(trim(p_body), '') = '' then
    raise exception 'Write a few words first' using errcode = '22000';
  end if;
  select unit_id into v_unit from threads where id = p_thread_id;
  if v_unit is null then
    raise exception 'That conversation is not yours to answer' using errcode = '42501';
  end if;
  v_message := owner_message(v_unit, trim(p_body));
  update threads
     set messages = messages || jsonb_build_array(v_message),
         unread = true,
         updated_on = current_date
   where id = p_thread_id;
end;
$$;

revoke all on function owner_message(uuid, text) from public;
revoke all on function start_owner_thread(uuid, text, text, text) from public;
revoke all on function reply_as_owner(uuid, text) from public;
grant execute on function start_owner_thread(uuid, text, text, text) to authenticated;
grant execute on function reply_as_owner(uuid, text) to authenticated;
