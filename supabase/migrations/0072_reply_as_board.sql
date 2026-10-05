-- A board reply is appended in the database, not written from a browser's
-- copy of the thread.
--
-- An owner's reply has always been appended in SQL (reply_as_owner, 0044).
-- The board's was not: the browser sent the whole messages array, built
-- from the thread as that tab last loaded it, with the new message on the
-- end. A secretary who opened Messages at 9:00 and answered at 9:10 wrote
-- her 9:00 copy back over whatever had arrived since, so an owner's 9:05
-- reply was erased from the row and the thread was marked read. Nobody
-- ever saw it.
--
-- reply_as_board appends one message to the row as it is now, under a row
-- lock, and returns the message it wrote. Who may call it is threads_write
-- (0044) word for word: the communications capability, or finances on a
-- thread tagged Billing, so the Treasurer keeps the billing mail. The
-- message id is made here from the thread and its position, the same shape
-- the browser used (m-<thread>-<n>), so two officers answering at once get
-- two ids and the list keys stay unique.
--
-- This adds a function and changes nothing else. The deployed client still
-- updates the row directly, and threads_write still lets it; the two live
-- side by side until the client is switched over.

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

  return v_message;
end;
$$;

revoke all on function reply_as_board(uuid, text) from public;
revoke execute on function reply_as_board(uuid, text) from anon;
grant execute on function reply_as_board(uuid, text) to authenticated;
