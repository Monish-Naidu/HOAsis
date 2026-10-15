-- The ballot guard (0120, 0121) raised on every ballot update.
--
-- plpgsql checks every field a CASE names against the row's type, whichever
-- branch runs, so `old.ballot_id` failed on the ballots table ("record old
-- has no field ballot_id") and closing, certifying or seating a ballot with
-- votes was refused. Found by scripts/verify-voting.mjs minutes after 0121
-- went in; the row is read as json now, the way 0106 compares rows.
-- Copied whole from 0121 with that one change.

create or replace function ballot_with_votes_is_fixed()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_row    jsonb := to_jsonb(coalesce(old, new));
  v_ballot uuid := case tg_table_name when 'ballots' then (v_row ->> 'id')::uuid
                                      else (v_row ->> 'ballot_id')::uuid end;
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
