-- 0114: sign a person out everywhere.
--
-- When a board member's access ends (removed, demoted, a lost phone), the
-- rows that gave them rights go away at once and the activity log says so,
-- but a session they already hold keeps its token until it expires. A
-- support script needs a way to end every session a person has.
--
-- auth.sessions is Supabase's own table, not exposed through the API, so
-- this is a definer function owned by the database owner, granted to the
-- service role only, and it writes one activity row per association the
-- person belongs to so the log says who was signed out and by what.

create or replace function sign_out_everywhere(p_profile_id uuid, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
  r record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the platform signs a person out' using errcode = '42501';
  end if;

  delete from auth.sessions where user_id = p_profile_id;
  get diagnostics v_count = row_count;

  for r in
    select distinct m.association_id, m.full_name
    from memberships m
    where m.profile_id = p_profile_id and m.ends_on is null
  loop
    perform record_activity(r.association_id, 'seat', p_profile_id,
      r.full_name || ' was signed out everywhere' || case when p_reason is null then '' else ': ' || p_reason end,
      jsonb_build_object('sessions', v_count, 'reason', p_reason));
  end loop;

  return v_count;
end;
$$;

revoke all on function sign_out_everywhere(uuid, text) from public;
revoke execute on function sign_out_everywhere(uuid, text) from anon, authenticated;
grant execute on function sign_out_everywhere(uuid, text) to service_role;
