-- A vote per seat.
--
-- An election for two seats let each home pick one candidate, because a vote
-- was keyed on (ballot, home). The tally then divided by the seats to count
-- homes, so 26 homes voting read as 13. A home now marks up to as many
-- candidates as there are seats, one row each, and turnout is counted from
-- ballot_turnout (distinct homes), never by dividing.

alter table votes drop constraint if exists votes_pkey;
alter table votes add primary key (ballot_id, unit_id, option_id);

-- Casting, for one seat or several. Replaces the home's marks on the ballot
-- with the ones given, keeping the receipt the voter already wrote down.
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

  select greatest(1, coalesce(seats, 1)) into v_seats
    from ballots where id = p_ballot_id and status = 'open';
  if v_seats is null then
    raise exception 'That ballot is not open' using errcode = '22000';
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

revoke all on function cast_vote from public;
grant execute on function cast_vote to authenticated;
