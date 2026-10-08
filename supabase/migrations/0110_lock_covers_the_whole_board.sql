-- 0110: a locked board cannot change its settings, its requests or its
-- conversations either.
--
-- 0105 locked the money, the register, meetings, votes, documents and
-- notices; 0107 the functions. The third walk (2026-10-07) found the
-- treasurer on a cancelled subscription still saving a Settings switch,
-- scheduling a request and marking one fixed, under a banner that said the
-- board side was read-only. Three tables were missing from the trigger's
-- list: associations (every setting), requests (the board's status
-- changes) and threads (the board's direct edits; its replies already go
-- through reply_as_board, which 0107 covers).
--
-- An owner is never locked out: a resident submitting or editing a request
-- on their own home passes, the way their payments and their own
-- conversations (start_owner_thread, a function) already do. The trigger
-- is security invoker, so a function run by an owner is the owner's call
-- and a function's own writes run as the owner of the function; that is
-- what lets the two paths differ.

create or replace function refuse_when_locked()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if current_user not in ('authenticated', 'anon')
     or coalesce(auth.role(), '') = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- A request on one of the caller's own homes is the owner's, locked or
  -- not. The board changes other homes' requests, and that is what waits.
  if tg_table_name = 'requests' then
    if (tg_op <> 'DELETE' and (to_jsonb(new) ->> 'unit_id')::uuid in (select my_unit_ids()))
       or (tg_op = 'DELETE' and (to_jsonb(old) ->> 'unit_id')::uuid in (select my_unit_ids())) then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old := case when tg_table_name = 'ballot_options'
                  then association_of_ballot((to_jsonb(old) ->> 'ballot_id')::uuid)
                  when tg_table_name = 'associations'
                  then (to_jsonb(old) ->> 'id')::uuid
                  else (to_jsonb(old) ->> 'association_id')::uuid end;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := case when tg_table_name = 'ballot_options'
                  then association_of_ballot((to_jsonb(new) ->> 'ballot_id')::uuid)
                  when tg_table_name = 'associations'
                  then (to_jsonb(new) ->> 'id')::uuid
                  else (to_jsonb(new) ->> 'association_id')::uuid end;
  end if;

  if (v_old is not null and not association_writable(v_old))
     or (v_new is not null and not association_writable(v_new)) then
    raise exception 'The board side is read-only until the subscription is paid'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['associations', 'requests', 'threads'] loop
    execute format('drop trigger if exists billing_lock on %I', t);
    execute format(
      'create trigger billing_lock before insert or update or delete on %I '
      'for each row execute function refuse_when_locked()', t);
  end loop;
end;
$$;
