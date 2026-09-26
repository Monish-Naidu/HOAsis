-- "Can change Finances and see nothing" read as a loss when the seat could
-- see everything it could change. Say what was granted, and mention the
-- see-only areas only when there are any.

create or replace function activity_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text := replace(new.role::text, '-', ' ');
  v_only  capability[];
  v_words text;
begin
  if tg_op = 'INSERT' then
    if new.role <> 'resident' then
      perform record_activity(new.association_id, 'seat', new.id,
        format('%s appointed %s', new.full_name, v_role),
        jsonb_build_object('role', new.role, 'can_change', new.capabilities, 'can_see', new.views));
    end if;
    return new;
  end if;
  if new.role is distinct from old.role then
    perform record_activity(new.association_id, 'seat', new.id,
      format('%s is now %s', new.full_name, case when new.role = 'resident' then 'an owner without an office' else v_role end),
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.capabilities is distinct from old.capabilities or new.views is distinct from old.views then
    -- See-only: in views and not already implied by a change right.
    select coalesce(array_agg(v), '{}') into v_only
      from unnest(new.views) as v where not (v = any (new.capabilities));
    v_words := case
      when array_length(new.capabilities, 1) is null and array_length(v_only, 1) is null then 'no access'
      when array_length(new.capabilities, 1) is null then format('access to see %s', capability_words(v_only))
      when array_length(v_only, 1) is null then format('access to change %s', capability_words(new.capabilities))
      else format('access to change %s, and to see %s', capability_words(new.capabilities), capability_words(v_only))
    end;
    perform record_activity(new.association_id, 'seat', new.id,
      format('%s given %s', new.full_name, v_words),
      jsonb_build_object('can_change', jsonb_build_object('from', old.capabilities, 'to', new.capabilities),
                         'can_see', jsonb_build_object('from', old.views, 'to', new.views)));
  end if;
  if new.ends_on is not null and old.ends_on is null then
    perform record_activity(new.association_id, 'seat', new.id,
      format('%s left the register', new.full_name),
      jsonb_build_object('ends_on', new.ends_on));
  end if;
  return new;
end;
$$;
