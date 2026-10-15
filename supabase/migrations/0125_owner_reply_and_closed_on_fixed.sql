-- Two faults in 0124, found by its suites the same hour.
--
-- reply_on_request compared the home against my_unit_ids() with "<> all",
-- but my_unit_ids returns a set, not an array, so every reply failed with
-- "op ANY/ALL (array) requires array on right side". The test is "not in
-- (select ...)" now.
--
-- ballot_closed_on fired on an update of status only, so a ballot inserted
-- already closed (a paper tally entered after the meeting) never got its
-- day. It fires on insert too. Both copied whole from 0124 with those
-- changes.

create or replace function reply_on_request(p_request_id uuid, p_body text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request requests%rowtype;
  v_body    text := btrim(coalesce(p_body, ''));
  v_name    text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to reply' using errcode = '42501';
  end if;
  if length(v_body) < 1 or length(v_body) > 4000 then
    raise exception 'Write a reply of up to 4,000 characters' using errcode = '22000';
  end if;

  select * into v_request from requests where id = p_request_id for update;
  if not found or v_request.unit_id is null
     or v_request.unit_id not in (select my_unit_ids()) then
    raise exception 'That request is not yours' using errcode = '42501';
  end if;
  if v_request.status in ('closed', 'denied') then
    raise exception 'That request is closed. Start a new one.' using errcode = '22000';
  end if;
  perform assert_association_writable(v_request.association_id);

  select m.full_name into v_name
    from memberships m
   where m.profile_id = auth.uid() and m.unit_id = v_request.unit_id and m.ends_on is null
   order by m.starts_on
   limit 1;

  update requests
     set thread = coalesce(thread, '[]'::jsonb) || jsonb_build_object(
           'id', 'rt-' || p_request_id::text || '-' || coalesce(jsonb_array_length(thread), 0)::text,
           'at', current_date::text,
           'actor', coalesce(v_name, 'Owner'),
           'actorRole', 'resident',
           'body', v_body,
           'kind', 'note'
         ),
         status = case when status = 'info-needed' then 'in-review'::request_status else status end
   where id = p_request_id;
  return true;
end;
$$;

revoke all on function reply_on_request(uuid, text) from public;
revoke execute on function reply_on_request(uuid, text) from anon;
grant execute on function reply_on_request(uuid, text) to authenticated;
grant execute on function reply_on_request(uuid, text) to service_role;

create or replace function ballot_closed_on()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'closed' and new.closed_on is null
     and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    new.closed_on := current_date;
  end if;
  return new;
end;
$$;

revoke all on function ballot_closed_on() from public;
revoke execute on function ballot_closed_on() from anon, authenticated;

drop trigger if exists ballot_closed_on on ballots;
create trigger ballot_closed_on
  before insert or update on ballots
  for each row execute function ballot_closed_on();
