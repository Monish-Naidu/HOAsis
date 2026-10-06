-- A person who owns two homes in one association votes once for each.
--
-- cast_votes (0076) found the caller's home with "select unit_id ... limit 1",
-- so an owner holding homes 2 and 3 cast for whichever row the planner
-- returned first, and the other home never voted. One home, one vote is the
-- rule (0042), and a person who holds two homes holds two votes.
--
-- cast_votes is copied whole from 0076, the latest, with one change: the
-- caller's choice is cast for EVERY home they currently hold in the ballot's
-- association (a seat with no end date, as before). Each home keeps its own
-- rows, exactly as today: its own receipt, kept when the vote is changed, and
-- its own upsert and delete of the options no longer picked. The receipt and
-- closing-date rules are unchanged. It returns what it returned, the receipt,
-- and for a person with several homes that is the first home's, in the order
-- the seats began (then by unit id, so the answer is stable). The screens
-- read the receipt back from the ballot, not from this return value.
--
-- Same signature, so no second overload; same grants as 0076.
--
-- ballot_tallies and ballot_turnout (0006) count rows and distinct homes in
-- votes, so two homes voting is two in a tally and two homes voted, with no
-- change to either view.
--
-- Also here, because the same person is affected: set_my_autopay (0029)
-- updates every seat the caller holds, so turning autopay on for one home
-- turned it on for all of them. set_my_home_autopay names the home. The old
-- function stays for the callers that still use it.

create or replace function cast_votes(p_ballot_id uuid, p_option_ids uuid[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit    uuid;
  v_units   uuid[];
  v_receipt text;
  v_first   text;
  v_seats   integer;
  v_closes  date;
  v_picks   uuid[];
begin
  -- Every home the caller holds in the ballot's association, oldest seat
  -- first. A home held through two seats is still one home.
  select array_agg(unit_id order by first_start, unit_id) into v_units
  from (
    select unit_id, min(starts_on) as first_start
    from memberships
    where profile_id = auth.uid()
      and ends_on is null
      and association_id = (select association_id from ballots where id = p_ballot_id)
    group by unit_id
  ) held;

  if v_units is null then
    raise exception 'You are not eligible to vote on that ballot' using errcode = '42501';
  end if;

  select greatest(1, coalesce(seats, 1)), closes_on into v_seats, v_closes
    from ballots where id = p_ballot_id and status = 'open';
  if v_seats is null then
    raise exception 'That ballot is not open' using errcode = '22000';
  end if;

  -- Past its date, with a day's grace for the evening the UTC date has
  -- already left behind.
  if v_closes < current_date - 1 then
    raise exception 'Voting on that ballot has closed' using errcode = '22000';
  end if;

  select array_agg(distinct o) into v_picks from unnest(p_option_ids) o;
  if v_picks is null or array_length(v_picks, 1) = 0 then
    raise exception 'Pick at least one choice' using errcode = '22000';
  end if;
  if array_length(v_picks, 1) > v_seats then
    raise exception 'Pick at most % choices', v_seats using errcode = '22000';
  end if;
  if exists (
    select 1 from unnest(v_picks) o
    where not exists (select 1 from ballot_options bo where bo.id = o and bo.ballot_id = p_ballot_id)
  ) then
    raise exception 'That choice is not on this ballot' using errcode = '22000';
  end if;

  foreach v_unit in array v_units loop
    select receipt into v_receipt from votes
     where ballot_id = p_ballot_id and unit_id = v_unit
     limit 1;
    if v_receipt is null then
      v_receipt := 'VR-' || to_char(current_date, 'YYYY-MM') || '-' ||
                   lpad((floor(random() * 10000))::text, 4, '0');
    end if;

    delete from votes
     where ballot_id = p_ballot_id and unit_id = v_unit and not (option_id = any (v_picks));

    insert into votes (ballot_id, unit_id, option_id, receipt)
    select p_ballot_id, v_unit, o, v_receipt from unnest(v_picks) o
    on conflict (ballot_id, unit_id, option_id) do update set cast_at = now();

    if v_first is null then
      v_first := v_receipt;
    end if;
  end loop;

  return v_first;
end;
$$;

revoke all on function cast_votes(uuid, uuid[]) from public;
revoke execute on function cast_votes(uuid, uuid[]) from anon;
grant execute on function cast_votes(uuid, uuid[]) to authenticated;

-- Autopay for one home. The caller must hold a current seat on it.
create or replace function set_my_home_autopay(p_association_id uuid, p_unit_id uuid, p_autopay jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update memberships
     set autopay = p_autopay
   where association_id = p_association_id
     and unit_id = p_unit_id
     and profile_id = auth.uid()
     and ends_on is null;
  if not found then
    raise exception 'You do not hold that home' using errcode = '42501';
  end if;
end;
$$;

revoke all on function set_my_home_autopay(uuid, uuid, jsonb) from public;
revoke execute on function set_my_home_autopay(uuid, uuid, jsonb) from anon;
grant execute on function set_my_home_autopay(uuid, uuid, jsonb) to authenticated;
