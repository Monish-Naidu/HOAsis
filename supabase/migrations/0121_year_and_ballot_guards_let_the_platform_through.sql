-- The two guards 0120 added refused the platform too.
--
-- money_year_is_open refused every row dated inside a closed year, including
-- the ones the platform writes as the service role: a late-found receipt the
-- ops job books before re-closing, a correction a support script posts. The
-- guard is for a board member at a screen, who reopens the year first; the
-- platform and the database owner already carry that judgement, the way
-- money_is_append_only (0106) lets them through.
--
-- ballot_with_votes_is_fixed refused the delete that cascades from an
-- association being deleted, so a board could not close its account once
-- anyone had voted, and a verify suite could not clean up after itself. A
-- cascade arrives one trigger deeper than a hand delete, and the service role
-- and the owner pass as above.
--
-- Both copied whole from 0120 with the exemptions added at the top.

create or replace function money_year_is_open()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_on date := case tg_table_name when 'charges' then (to_jsonb(new) ->> 'due_on')::date
                                  else (to_jsonb(new) ->> 'occurred_on')::date end;
begin
  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if exists (
    select 1 from fiscal_years fy
    where fy.association_id = new.association_id
      and fy.reopened_at is null
      and v_on between fy.starts_on and fy.ends_on
  ) then
    raise exception 'That year is closed. Reopen it on Finances before posting into it.'
      using errcode = '22000';
  end if;
  return new;
end;
$$;

revoke all on function money_year_is_open() from public;
revoke execute on function money_year_is_open() from anon, authenticated;

create or replace function ballot_with_votes_is_fixed()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ballot uuid := case tg_table_name when 'ballots' then coalesce(old.id, new.id)
                                      else coalesce(old.ballot_id, new.ballot_id) end;
begin
  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin')
     or (tg_op = 'DELETE' and pg_trigger_depth() > 1) then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from votes v where v.ballot_id = v_ballot) then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'A ballot people have voted on is kept. Close it instead.'
      using errcode = '42501';
  end if;
  if tg_table_name = 'ballots'
     and (to_jsonb(new) - 'status' - 'closes_on' - 'live_results_visible'
            - 'certified_by' - 'certified_on' - 'results_emailed_at'
            - 'winners_seated' - 'winners_seated_on' - 'winners_seated_by')
       = (to_jsonb(old) - 'status' - 'closes_on' - 'live_results_visible'
            - 'certified_by' - 'certified_on' - 'results_emailed_at'
            - 'winners_seated' - 'winners_seated_on' - 'winners_seated_by') then
    return new;
  end if;
  raise exception 'A ballot people have voted on cannot be changed. Close it and open a new one.'
    using errcode = '42501';
end;
$$;

revoke all on function ballot_with_votes_is_fixed() from public;
revoke execute on function ballot_with_votes_is_fixed() from anon, authenticated;
