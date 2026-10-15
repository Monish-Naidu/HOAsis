-- The ballot guard (0122) saw no votes and let everything through.
--
-- A trigger runs with the caller's rights, and votes_read_own (0005) shows a
-- person only their own home's votes. So a President deleting a ballot the
-- whole association had voted on found "no votes" and the delete went
-- through, which is the exact thing the guard is for. The function is
-- security definer now, so it counts every vote; it still writes nothing.
-- Found by scripts/verify-voting.mjs. Copied whole from 0122 with that one
-- change.

create or replace function ballot_with_votes_is_fixed()
returns trigger
language plpgsql
security definer
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
