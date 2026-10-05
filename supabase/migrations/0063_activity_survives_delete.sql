-- An association with a bank account or a document could not be deleted.
--
-- Since 0059 the activity triggers write a row whenever a bank account or a
-- document is removed. Deleting an association cascades to both, so each
-- trigger fired during the cascade and inserted an activity row for an
-- association whose own row was already gone. The foreign key on activity
-- refused it and the whole delete rolled back. Nothing said so: every
-- verify script ignored the error its cleanup returned, so each run since
-- 2026-09-26 left its association in the live project, where the dues cron
-- then billed it.
--
-- record_activity now writes nothing when the association no longer exists.
-- That is only ever true inside a hard delete, where the record is being
-- removed along with everything else; assert_one_president (0011) steps
-- aside the same way. Everything else is as it was in 0059, and the grants
-- are as 0062 left them.
--
-- The verify scripts now fail the run when their cleanup fails. The
-- associations earlier runs left behind are not removed here: that is a
-- decision about live data, for a person.

create or replace function record_activity(
  p_association uuid,
  p_kind        text,
  p_subject     uuid,
  p_summary     text,
  p_details     jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
begin
  -- Mid-cascade from a deleted association: there is nothing left to keep a
  -- record for, and the insert below would fail the delete.
  if not exists (select 1 from associations where id = p_association) then
    return;
  end if;
  select * into v_actor from activity_actor(p_association);
  insert into activity (association_id, actor_id, actor_name, subject_kind, subject_id, summary, details)
  values (p_association, v_actor.actor_id, v_actor.actor_name, p_kind, p_subject, p_summary, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Called only from inside the activity triggers, which run as their owner.
revoke all on function record_activity(uuid, text, uuid, text, jsonb) from public;
revoke execute on function record_activity(uuid, text, uuid, text, jsonb) from anon, authenticated;
