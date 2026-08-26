-- What onboarding learned about the association, kept.
--
-- The three questions were asked, answered, and then discarded for anybody
-- signed in: the browser path stored them on the community it built locally,
-- and the server path did not store them at all. So a real board answered
-- "condominiums, leaving a management company, we pass on utilities" and then
-- got the generic plan, which is the one case the questions exist to avoid.
--
-- Stored on the association rather than in a settings blob because the plan,
-- the compliance register and the shared cost screens all read them, and a
-- column can be queried.

do $$ begin
  create type property_type as enum ('single-family', 'townhomes', 'condos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type association_origin as enum ('new', 'self-managed', 'leaving-manager');
exception when duplicate_object then null; end $$;

alter table associations
  add column if not exists property_type  property_type,
  add column if not exists origin         association_origin,
  -- Free text rather than enums: these are lists a board ticks, and adding a
  -- shared space should not need a migration.
  add column if not exists collects       text[] not null default '{}',
  add column if not exists shared_spaces  text[] not null default '{}';

-- The old nine argument version has to go explicitly. Adding arguments with
-- defaults creates an overload rather than replacing it, and then every call
-- is ambiguous: Postgres cannot tell which one the browser meant.
drop function if exists create_association(
  text, text, char(2), integer, dues_cadence, smallint, text, text, jsonb
);

/**
 * Founding, now carrying the profile.
 *
 * Replaces the previous signature rather than adding a second function, so
 * there is one way to found an association and no chance of the browser
 * calling the version that drops the answers.
 */
create or replace function create_association(
  p_name          text,
  p_city          text,
  p_state         char(2),
  p_dues_cents    integer,
  p_dues_cadence  dues_cadence,
  p_due_day       smallint,
  p_founder_name  text,
  p_founder_unit  text,
  p_households    jsonb default '[]'::jsonb,
  p_property_type property_type default null,
  p_origin        association_origin default null,
  p_collects      text[] default '{}',
  p_shared_spaces text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_caller      uuid := auth.uid();
  v_unit        uuid;
  v_household   jsonb;
  v_label       text;
begin
  if v_caller is null then
    raise exception 'Sign in before founding an association' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'An association needs a name';
  end if;
  if p_dues_cents is null or p_dues_cents < 0 then
    raise exception 'Dues cannot be negative';
  end if;

  insert into associations
    (name, city, state, dues_cents, dues_cadence, due_day,
     property_type, origin, collects, shared_spaces)
  values
    (btrim(p_name), btrim(p_city), p_state, p_dues_cents, p_dues_cadence, p_due_day,
     p_property_type, p_origin, coalesce(p_collects, '{}'), coalesce(p_shared_spaces, '{}'))
  returning id into v_association;

  -- The founder's own home, and the founder as President.
  insert into units (association_id, label)
  values (v_association, btrim(p_founder_unit))
  returning id into v_unit;

  insert into memberships
    (association_id, unit_id, profile_id, full_name, role, capabilities)
  values (
    v_association, v_unit, v_caller, btrim(p_founder_name), 'president',
    array['finances', 'requests', 'documents', 'communications', 'voting',
          'vendors', 'compliance', 'forum', 'settings', 'permissions']::capability[]
  );

  -- Everyone else the founder listed. A repeated unit is collapsed rather
  -- than duplicated, because two rows for one home means two bills.
  for v_household in select * from jsonb_array_elements(coalesce(p_households, '[]'::jsonb))
  loop
    v_label := btrim(coalesce(v_household ->> 'unit', ''));
    continue when v_label = '';

    select id into v_unit from units
     where association_id = v_association and label = v_label;

    if v_unit is null then
      insert into units (association_id, label)
      values (v_association, v_label)
      returning id into v_unit;

      insert into memberships
        (association_id, unit_id, invited_email, full_name, role, capabilities)
      values (
        v_association, v_unit,
        nullif(btrim(coalesce(v_household ->> 'email', '')), ''),
        btrim(coalesce(v_household ->> 'name', '')),
        'resident', '{}'::capability[]
      );
    end if;
  end loop;

  return v_association;
end;
$$;

revoke all on function create_association(
  text, text, char(2), integer, dues_cadence, smallint, text, text, jsonb,
  property_type, association_origin, text[], text[]
) from public;
grant execute on function create_association(
  text, text, char(2), integer, dues_cadence, smallint, text, text, jsonb,
  property_type, association_origin, text[], text[]
) to authenticated;
