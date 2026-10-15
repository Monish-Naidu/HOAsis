-- The annual meeting, after the notices went out: quorum the board sets and
-- the homes can see, paper ballots and proxies the board types in, a rule
-- that dues must be current to vote, and seating the winners of an election.
--
-- QUORUM. ballots.quorum_required has been the number of homes since 0005,
-- but nothing read it. ballot_turnout (0006) already counts homes, so it
-- now also says how many of them came in on paper and by proxy, and the
-- screens say the same: "Quorum missed by 1. 26 homes voted, 27 were
-- needed." The board's form takes a percent too, and the browser rounds it
-- up to homes before it is stored, because 17.6 homes is not a quorum until
-- the eighteenth votes.
--
-- ONE VOTE PER HOME, EITHER WAY. A paper ballot or a proxy is typed in by
-- the board as what it is: a votes row for that home, marked paper or
-- proxy, with who entered it. It counts in the same tallies and the same
-- turnout as an online vote, and the two cannot both exist: enter_paper_vote
-- refuses a home that already voted online, and cast_votes now refuses one
-- the board already entered. The board sees that a home voted and how it
-- reached them (ballot_entered_votes); which choice it was stays where it
-- has always been, in a tally nobody can trace back to a home.
--
-- DUES CURRENT. A ballot can require it. The rule is the same one the
-- association's overview keeps (0108): a balance, and an open charge past
-- its due date. Online, a home behind is left out of the person's vote (a
-- person with two homes still votes for the current one); on paper, the
-- entry is refused.
--
-- SEATING. Only an election seats anybody, and only a permissions holder
-- (the President) may seat them, because that is what writing to
-- memberships takes (0001). The presidency is a handover in Settings, not
-- something an election awards, so a winner who holds it is passed over
-- with the reason. A winner whose home is retired, or who cannot be told
-- apart from a co-owner, is passed over too. Whoever held the office steps
-- back to resident, with the default capabilities the office started with.
-- Once per ballot: pressed again, the record comes back unchanged.
--
-- THE RESULTS EMAIL. Stamped by begin_results_email once, so a second
-- press sends nothing even mid-roster: the sender (notify.ts) reads the
-- stamp and refuses outside the hour after it.

-- What a ballot asks of the homes, and what seating its winners did.
alter table ballots
  add column if not exists dues_current_required boolean not null default false,
  add column if not exists results_emailed_at timestamptz,
  add column if not exists winners_seated jsonb,
  add column if not exists winners_seated_by text,
  add column if not exists winners_seated_on date;

-- A candidate is a person on the register, so a winner can be seated from
-- the result. Left unset for every other kind of choice.
alter table ballot_options
  add column if not exists unit_id uuid references units (id) on delete set null;

-- How a home's vote reached the ballot, and who carried it there. Online
-- rows carry only the method: the board entered the rest.
alter table votes
  add column if not exists method text not null default 'online',
  add column if not exists entered_by uuid references profiles (id) on delete set null,
  add column if not exists entered_by_name text,
  add column if not exists proxy_holder text;

alter table votes
  add constraint votes_method_is_a_way_to_vote check (method in ('online', 'paper', 'proxy'));

-- The dues rule, as the home's statement tells it: a balance, and a charge
-- past its due date that the balance never came back to cover. The oldest
-- such charge is the one the letters name, so it is the one asked for here.
-- Security definer because charges are nobody's to read through RLS from a
-- voting function; the answer is one boolean about one home the caller
-- already has business with.
create or replace function unit_is_past_due(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.balance_cents > 0 and o.due_on < current_date
    from (
      select coalesce(sum(c.amount_cents) filter (where c.due_on <= current_date), 0)::bigint
        as balance_cents
      from charges c
      where c.unit_id = p_unit_id
    ) s
    left join lateral (
      select r.due_on
      from (
        select c.due_on,
               coalesce(sum(c.amount_cents) over (
                 order by c.due_on desc, c.id
                 rows between unbounded preceding and 1 preceding
               ), 0) as newer_cents
        from charges c
        where c.unit_id = p_unit_id and c.kind = 'charge' and c.due_on <= current_date
      ) r
      where s.balance_cents - r.newer_cents > 0
      order by r.due_on asc
      limit 1
    ) o on true
  ), false);
$$;

revoke all on function unit_is_past_due(uuid) from public;
revoke execute on function unit_is_past_due(uuid) from anon;
grant execute on function unit_is_past_due(uuid) to authenticated;
grant execute on function unit_is_past_due(uuid) to service_role;

-- cast_votes, copied whole from 0096, the latest, with one change: the two
-- rules above. A home behind on its dues, and a home whose vote the board
-- already entered, are left out of the person's vote rather than refused
-- outright, because a person with two homes still has the other one's vote.
-- Same signature, so no second overload; same grants as 0096.
create or replace function cast_votes(p_ballot_id uuid, p_option_ids uuid[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit    uuid;
  v_held    uuid[];
  v_units   uuid[];
  v_receipt text;
  v_first   text;
  v_seats   integer;
  v_closes  date;
  v_dues    boolean;
  v_picks   uuid[];
begin
  -- Every home the caller holds in the ballot's association, oldest seat
  -- first. A home held through two seats is still one home.
  select array_agg(unit_id order by first_start, unit_id) into v_held
  from (
    select unit_id, min(starts_on) as first_start
    from memberships
    where profile_id = auth.uid()
      and ends_on is null
      and association_id = (select association_id from ballots where id = p_ballot_id)
    group by unit_id
  ) held;

  if v_held is null then
    raise exception 'You are not eligible to vote on that ballot' using errcode = '42501';
  end if;

  select greatest(1, coalesce(seats, 1)), closes_on, coalesce(dues_current_required, false)
    into v_seats, v_closes, v_dues
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

  -- One writer per home on this ballot at a time, the same lock
  -- enter_paper_vote takes, so an owner voting while a clerk types in the
  -- home's paper ballot cannot both pass the check below. Taken in unit id
  -- order so two co-owners of the same two homes cannot deadlock.
  perform pg_advisory_xact_lock(hashtextextended(p_ballot_id::text || ':' || h.u::text, 0))
  from (select u from unnest(v_held) u order by u) h;

  -- The homes this vote is for. The dues rule and a vote the board entered
  -- leave a home out; the order the homes were held in is kept, so the
  -- receipt a two-home owner wrote down is the same either day.
  select coalesce(array_agg(u order by o), '{}'::uuid[]) into v_units
  from unnest(v_held) with ordinality as held(u, o)
  where (not v_dues or not unit_is_past_due(u))
    and not exists (
      select 1 from votes v
      where v.ballot_id = p_ballot_id and v.unit_id = u and v.method in ('paper', 'proxy')
    );

  if coalesce(array_length(v_units, 1), 0) = 0 then
    if v_dues and exists (select 1 from unnest(v_held) h(unit_id) where unit_is_past_due(h.unit_id)) then
      raise exception 'Dues must be current to vote on this ballot' using errcode = '22000';
    end if;
    raise exception 'The board already entered the vote for that home'
      using errcode = '22000';
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

-- The board's entry of a paper ballot or a proxy, for one home. The rules
-- are the refusals the screen already says (paperVoteProblem), in the same
-- order, so what was promised on screen is what the database does.
create or replace function enter_paper_vote(
  p_ballot_id    uuid,
  p_unit_id      uuid,
  p_option_ids   uuid[],
  p_method       text,
  p_proxy_holder text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_association uuid;
  v_title       text;
  v_audience    text;
  v_status      text;
  v_closes      date;
  v_seats       integer;
  v_dues        boolean;
  v_unit_label  text;
  v_where       text;
  v_holder      text := nullif(btrim(coalesce(p_proxy_holder, '')), '');
  v_officer     text;
  v_picks       uuid[];
  v_receipt     text;
begin
  if v_caller is null then
    raise exception 'Sign in to enter a vote' using errcode = '42501';
  end if;

  select b.association_id, b.title, b.audience, b.status, b.closes_on,
         greatest(1, coalesce(b.seats, 1)), coalesce(b.dues_current_required, false)
    into v_association, v_title, v_audience, v_status, v_closes, v_seats, v_dues
  from ballots b
  join associations a on a.id = b.association_id
  where b.id = p_ballot_id and a.deleted_at is null;
  if v_association is null then
    raise exception 'No such ballot' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'voting') then
    raise exception 'You cannot enter a vote for this association' using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);

  if v_audience <> 'owners' then
    raise exception 'Paper votes are for ballots the owners vote on' using errcode = '22000';
  end if;
  if v_status <> 'open' then
    raise exception 'Voting on that ballot has ended' using errcode = '22000';
  end if;
  -- The closing date is the deadline the paper was held to, so the same
  -- day's grace an online vote gets.
  if v_closes < current_date - 1 then
    raise exception 'Voting on that ballot has ended' using errcode = '22000';
  end if;

  select label into v_unit_label
  from units
  where id = p_unit_id and association_id = v_association and retired_on is null;
  if v_unit_label is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  -- "Unit 12" for a number, the words as given for anything else, the same
  -- placeLabel the screens use, so the refusal reads like the screen's.
  v_where := case when v_unit_label ~* '^[a-z]?-?[0-9]+[a-z]?$'
                  then 'Unit ' || v_unit_label else v_unit_label end;

  -- Two clerks typing in the same home's paper at once, or a clerk and the
  -- owner online: the second waits here, then finds the first one's vote.
  perform pg_advisory_xact_lock(hashtextextended(p_ballot_id::text || ':' || p_unit_id::text, 0));

  if exists (select 1 from votes where ballot_id = p_ballot_id and unit_id = p_unit_id) then
    raise exception '% has already voted on this ballot', v_where using errcode = '22000';
  end if;

  if v_dues and unit_is_past_due(p_unit_id) then
    raise exception '% is past due, and this ballot needs dues to be current', v_where
      using errcode = '22000';
  end if;

  if p_method not in ('paper', 'proxy') then
    raise exception 'A vote the board enters is a paper ballot or a proxy'
      using errcode = '22000';
  end if;
  if p_method = 'proxy' and coalesce(length(v_holder), 0) < 2 then
    raise exception 'Name who held the proxy' using errcode = '22000';
  end if;
  if p_method = 'proxy' and length(v_holder) > 120 then
    raise exception 'Keep the name under 120 characters' using errcode = '22000';
  end if;

  select array_agg(distinct o) into v_picks from unnest(p_option_ids) o;
  if v_picks is null or array_length(v_picks, 1) = 0 then
    raise exception 'Pick the choice on the ballot' using errcode = '22000';
  end if;
  if array_length(v_picks, 1) > v_seats then
    raise exception 'Pick at most %', v_seats using errcode = '22000';
  end if;
  if exists (
    select 1 from unnest(v_picks) o
    where not exists (select 1 from ballot_options bo where bo.id = o and bo.ballot_id = p_ballot_id)
  ) then
    raise exception 'That choice is not on this ballot' using errcode = '22000';
  end if;

  select m.full_name into v_officer
  from memberships m
  where m.association_id = v_association and m.profile_id = v_caller and m.ends_on is null
  order by m.created_at
  limit 1;

  v_receipt := 'VR-' || to_char(current_date, 'YYYY-MM') || '-' ||
               lpad((floor(random() * 10000))::text, 4, '0');

  insert into votes (ballot_id, unit_id, option_id, receipt,
                     method, entered_by, entered_by_name, proxy_holder)
  select p_ballot_id, p_unit_id, o, v_receipt,
         p_method, v_caller, coalesce(v_officer, 'The board'),
         case when p_method = 'proxy' then v_holder end
  from unnest(v_picks) o;

  perform record_activity(v_association, 'ballot', p_ballot_id,
    format('Entered %s vote for %s on "%s"',
      case p_method when 'proxy' then 'a proxy' else 'a paper' end, v_where, v_title),
    jsonb_build_object('unit_id', p_unit_id, 'method', p_method));

  return v_receipt;
end;
$$;

revoke all on function enter_paper_vote(uuid, uuid, uuid[], text, text) from public;
revoke execute on function enter_paper_vote(uuid, uuid, uuid[], text, text) from anon;
grant execute on function enter_paper_vote(uuid, uuid, uuid[], text, text) to authenticated;

-- Seat the winners of a closed election. The plan is built before anything
-- is written, because the offices have to be picked and told apart first,
-- and then each winner takes their office and the office's sitting holder
-- steps back to being a resident. Once per ballot.
create or replace function seat_election_winners(p_ballot_id uuid, p_offices jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_association uuid;
  v_title       text;
  v_kind        text;
  v_status      text;
  v_seats       integer;
  v_quorum      integer;
  v_done        jsonb;
  v_done_on     date;
  v_unit_label  text;
  v_problem     text;
  v_office      text;
  v_seat_id     uuid;
  v_members     integer;
  v_named       integer;
  v_voted       integer;
  v_tied        boolean;
  v_caps        capability[];
  v_all_views   capability[] := array[
    'finances', 'requests', 'documents', 'communications', 'voting',
    'vendors', 'compliance', 'forum', 'settings'
  ]::capability[];
  v_rows        jsonb := '[]'::jsonb;
  v_sealed      jsonb;
  v_seated      integer := 0;
  v_words       text := '';
  r             record;
begin
  if v_caller is null then
    raise exception 'Sign in to seat the winners' using errcode = '42501';
  end if;

  select b.association_id, b.title, b.kind, b.status,
         greatest(1, coalesce(b.seats, 1)), b.quorum_required,
         b.winners_seated, b.winners_seated_on
    into v_association, v_title, v_kind, v_status, v_seats, v_quorum, v_done, v_done_on
  from ballots b
  join associations a on a.id = b.association_id
  where b.id = p_ballot_id and a.deleted_at is null
  -- Two presses at once: the second waits for the first, then reads its
  -- stamp and returns the same record.
  for update of b;
  if v_association is null then
    raise exception 'No such ballot' using errcode = '23503';
  end if;

  -- Seating writes to memberships, so it takes what memberships takes: the
  -- permissions capability, which only the President holds.
  if not has_capability(v_association, 'permissions') then
    raise exception 'Only the President may seat the winners of an election'
      using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);

  -- Pressed again, the record comes back as it went in. Nothing changes,
  -- and the toast can say the same thing twice.
  if v_done_on is not null then
    return v_done;
  end if;

  if v_kind <> 'election' then
    raise exception 'Only an election seats anybody' using errcode = '22000';
  end if;
  if v_status not in ('closed', 'certified') then
    raise exception 'Record the result first' using errcode = '22000';
  end if;

  if not exists (
    select 1 from votes v join ballot_options o on o.id = v.option_id
    where o.ballot_id = p_ballot_id
  ) then
    raise exception 'Nobody was elected from this vote' using errcode = '22000';
  end if;

  -- A tie for the last seat is settled first, because it is the tie that
  -- decides who sits. As many winners as seats, ranked by votes; the
  -- position breaks a dead heat in the count so the check is stable.
  with counted as (
    select o.position,
           (select count(*)::integer from votes v where v.option_id = o.id) as votes
    from ballot_options o
    where o.ballot_id = p_ballot_id
  ), ranked as (
    select votes, row_number() over (order by votes desc, position) as rank
    from counted
  )
  select coalesce(
    (select votes from ranked where rank = v_seats) =
      (select votes from ranked where rank = v_seats + 1)
      and (select votes from ranked where rank = v_seats) > 0
  , false) into v_tied;
  if v_tied then
    raise exception 'The last seat is tied. Settle the tie before seating anybody'
      using errcode = '22000';
  end if;

  if v_quorum > 0 then
    select count(distinct unit_id)::integer into v_voted
    from votes where ballot_id = p_ballot_id;
    if v_voted < v_quorum then
      raise exception 'The election missed quorum, so nobody is seated from it'
        using errcode = '22000';
    end if;
  end if;

  -- The plan: each winner, the office picked for them, and why they cannot
  -- be seated from here when they cannot.
  for r in
    with counted as (
      select o.id as option_id, o.label, o.unit_id, o.position,
             (select count(*)::integer from votes v where v.option_id = o.id) as votes
      from ballot_options o
      where o.ballot_id = p_ballot_id
    )
    select c.*, row_number() over (order by c.votes desc, c.position) as rank
    from counted c
  loop
    exit when r.rank > v_seats;
    continue when r.votes = 0;

    v_problem := null;
    v_seat_id := null;
    v_unit_label := null;
    v_office := coalesce(nullif(btrim(p_offices ->> r.option_id::text), ''), '');

    if r.unit_id is null then
      v_problem := 'Not linked to a home on the register. Seat them in Settings.';
    else
      select u.label into v_unit_label
      from units u
      where u.id = r.unit_id and u.association_id = v_association and u.retired_on is null;
      if v_unit_label is null then
        v_problem := 'No longer on the register.';
      else
        select count(*),
               coalesce(sum(case when lower(btrim(m.full_name)) = lower(btrim(r.label))
                                 then 1 else 0 end), 0)
          into v_members, v_named
        from memberships m
        where m.unit_id = r.unit_id and m.ends_on is null;

        if v_named = 0 and v_members <> 1 then
          if v_members = 0 then
            v_problem := 'Nobody holds that home. Seat them in Settings.';
          else
            v_problem := 'Two owners on that home. Seat the right one in Settings.';
          end if;
        else
          select m.id into v_seat_id
          from memberships m
          where m.unit_id = r.unit_id and m.ends_on is null
          order by (case when lower(btrim(m.full_name)) = lower(btrim(r.label)) then 0 else 1 end),
                   m.created_at
          limit 1;
          if v_seat_id is not null and exists (
            select 1 from memberships p
            where p.id = v_seat_id and p.role = 'president'
          ) then
            v_problem := 'Holds the presidency. Hand it over in Settings first.';
          end if;
        end if;
      end if;
    end if;

    v_rows := v_rows || jsonb_build_object(
      'option_id', r.option_id,
      'name', r.label,
      'unit', v_unit_label,
      'office', case when v_problem is null then v_office end,
      'seated', v_problem is null,
      'reason', v_problem,
      'seat_id', v_seat_id
    );
  end loop;

  if not exists (select 1 from jsonb_array_elements(v_rows) x where x ->> 'seated' = 'true') then
    raise exception 'Nobody here can be seated from the result' using errcode = '22000';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_rows) x
    where x ->> 'seated' = 'true'
      and x ->> 'office' not in ('vice-president', 'treasurer', 'secretary')
  ) then
    raise exception 'Pick an office for each winner' using errcode = '22000';
  end if;
  if (select count(*) from jsonb_array_elements(v_rows) x where x ->> 'seated' = 'true')
     <> (select count(distinct x ->> 'office')
         from jsonb_array_elements(v_rows) x where x ->> 'seated' = 'true') then
    raise exception 'Two winners cannot hold one office' using errcode = '22000';
  end if;

  -- Seated, in the words the toast and the activity log say.
  v_sealed := '[]'::jsonb;
  for r in
    select x as plan_row
    from jsonb_array_elements(v_rows) x
  loop
    if r.plan_row ->> 'seated' <> 'true' then
      v_sealed := v_sealed || (r.plan_row - 'seat_id');
      continue;
    end if;

    v_office := r.plan_row ->> 'office';
    v_seat_id := (r.plan_row ->> 'seat_id')::uuid;

    -- The defaults each office starts with, as Settings gives them
    -- (src/lib/data/accounts.ts). Only the President holds permissions,
    -- so no election hands it out.
    v_caps := case v_office
      when 'vice-president' then array[
        'finances', 'requests', 'documents', 'communications', 'voting',
        'vendors', 'compliance', 'forum', 'settings']::capability[]
      when 'treasurer' then array[
        'finances', 'vendors', 'documents', 'communications', 'compliance']::capability[]
      else array[
        'documents', 'communications', 'voting', 'requests', 'compliance', 'forum']::capability[]
    end;

    -- The office's sitting holder steps back to being a resident, unless
    -- the winner is the holder re-elected to it.
    update memberships
       set role = 'resident', capabilities = '{}'::capability[], views = '{}'::capability[]
     where association_id = v_association and role = v_office::board_role and ends_on is null
       and id <> v_seat_id;

    update memberships
       set role = v_office::board_role, capabilities = v_caps, views = v_all_views
     where id = v_seat_id;

    v_words := case when v_words = '' then '' else v_words || ' and ' end
      || format('%s as %s', r.plan_row ->> 'name',
        case v_office
          when 'vice-president' then 'Vice President'
          when 'treasurer' then 'Treasurer'
          else 'Secretary' end);
    v_seated := v_seated + 1;
    v_sealed := v_sealed || (r.plan_row - 'seat_id');
  end loop;

  update ballots
     set winners_seated = v_sealed,
         winners_seated_by = (
           select m.full_name from memberships m
           where m.association_id = v_association and m.profile_id = v_caller and m.ends_on is null
           order by m.created_at limit 1
         ),
         winners_seated_on = current_date
   where id = p_ballot_id;

  perform record_activity(v_association, 'ballot', p_ballot_id,
    format('Seated the winners of "%s": %s', v_title, v_words),
    jsonb_build_object('seated', v_seated, 'not_seated', jsonb_array_length(v_rows) - v_seated));

  return v_sealed;
end;
$$;

revoke all on function seat_election_winners(uuid, jsonb) from public;
revoke execute on function seat_election_winners(uuid, jsonb) from anon;
grant execute on function seat_election_winners(uuid, jsonb) to authenticated;

-- The stamp that says the results went out. The sender reads it back and
-- refuses outside the hour after it, so the email is sent once however the
-- roster is carried. One update with one predicate: two presses race and
-- only the first writes.
create or replace function begin_results_email(p_ballot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_association uuid;
  v_audience text;
  v_status text;
begin
  if v_caller is null then
    raise exception 'Sign in to email the results' using errcode = '42501';
  end if;

  select b.association_id, b.audience, b.status
    into v_association, v_audience, v_status
  from ballots b
  join associations a on a.id = b.association_id
  where b.id = p_ballot_id and a.deleted_at is null;
  if v_association is null then
    raise exception 'No such ballot' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'voting') then
    raise exception 'You cannot email the results for this association' using errcode = '42501';
  end if;
  perform assert_association_writable(v_association);

  if v_audience <> 'owners' then
    raise exception 'Board votes are not emailed to the homes' using errcode = '22000';
  end if;
  if v_status not in ('closed', 'certified') then
    raise exception 'Record the result first' using errcode = '22000';
  end if;

  update ballots set results_emailed_at = now()
   where id = p_ballot_id and results_emailed_at is null;
  return found;
end;
$$;

revoke all on function begin_results_email(uuid) from public;
revoke execute on function begin_results_email(uuid) from anon;
grant execute on function begin_results_email(uuid) to authenticated;

-- The turnout, with the paper and the proxy counted out (0006 kept the
-- count and kept silent about how it arrived). Same shape as before, so a
-- build that reaches a database before this migration still reads it.
drop view if exists ballot_turnout;

create view ballot_turnout as
  select
    b.id as ballot_id,
    b.association_id,
    count(distinct v.unit_id)::integer as homes_voted,
    (count(distinct v.unit_id) filter (where v.method = 'paper'))::integer as paper_homes,
    (count(distinct v.unit_id) filter (where v.method = 'proxy'))::integer as proxy_homes,
    b.quorum_required
  from ballots b
  left join votes v on v.ballot_id = b.id
  where is_member_of(b.association_id)
  group by b.id, b.association_id, b.quorum_required;

-- What the board sees of the votes it entered: which home, how it arrived,
-- who typed it, who held the proxy. Not which choice. A home's rows for a
-- multi seat race differ only by choice, so distinct keeps one line a home.
-- Whoever holds no voting capability gets nothing, the way ballot_tallies
-- keeps the count and hands over no names.
create view ballot_entered_votes as
  select distinct
    b.id as ballot_id,
    b.association_id,
    v.unit_id,
    u.label as unit_label,
    v.method,
    v.entered_by_name,
    (v.cast_at at time zone 'utc')::date as entered_on,
    v.proxy_holder
  from ballots b
  join votes v on v.ballot_id = b.id
  join units u on u.id = v.unit_id
  where v.method in ('paper', 'proxy')
    and has_capability(b.association_id, 'voting');
