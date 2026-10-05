-- A ballot went on taking votes after its closing date.
--
-- Nothing closes a ballot on its date. The row stays 'open' until an
-- officer closes it, and cast_votes (0042) asked only for 'open'. The
-- screens show a ballot past its date as closed, with its result, so a
-- vote sent by hand a week later was counted into a result people had
-- already read.
--
-- cast_votes now also refuses once the closing date is more than one day
-- behind. The one day is not generosity: current_date is UTC and an
-- association has no time zone of its own, so on the evening of the
-- closing date in Seattle the database already says tomorrow. Without the
-- day, the last evening of every vote would be refused.
--
-- No job closes the row. It stays 'open' until an officer closes or
-- certifies it, exactly as before; it simply stops taking votes.
--
-- cast_votes and cast_vote are copied whole from 0042, the latest of each,
-- with this one check added. Same signatures, so there is no second
-- overload; same grants, with the visitor's own grant taken away as 0062
-- did for the money functions.

create or replace function cast_votes(p_ballot_id uuid, p_option_ids uuid[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit    uuid;
  v_receipt text;
  v_seats   integer;
  v_closes  date;
  v_picks   uuid[];
begin
  select unit_id into v_unit
  from memberships
  where profile_id = auth.uid()
    and ends_on is null
    and association_id = (select association_id from ballots where id = p_ballot_id)
  limit 1;

  if v_unit is null then
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

  return v_receipt;
end;
$$;

revoke all on function cast_votes(uuid, uuid[]) from public;
revoke execute on function cast_votes(uuid, uuid[]) from anon;
grant execute on function cast_votes(uuid, uuid[]) to authenticated;

-- The single-choice call, kept for anything that still makes it.
create or replace function cast_vote(p_ballot_id uuid, p_option_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select cast_votes(p_ballot_id, array[p_option_id]);
$$;

revoke all on function cast_vote(uuid, uuid) from public;
revoke execute on function cast_vote(uuid, uuid) from anon;
grant execute on function cast_vote(uuid, uuid) to authenticated;
