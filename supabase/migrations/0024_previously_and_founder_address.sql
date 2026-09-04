-- 0024: where an established association is coming from, and the founder's
-- own address.
--
-- Monish, 2026-09-03: "just homeowners coming to the app" is three different
-- first months (a manager ran it, another platform held the books, or it is
-- brand new), and the founder should give their home address rather than a
-- bare number. Both are captured at founding, so the plan can use them.

alter table associations
  add column if not exists previously text
    check (previously is null or previously in ('manager', 'platform', 'fresh'));

comment on column associations.previously is
  'For an established association: manager, platform, or fresh (new, nothing before).';

drop function if exists create_association(
  text, text, char(2), integer, dues_cadence, smallint, text, text, jsonb,
  property_type, association_origin, text[], text[]
);

create or replace function create_association(
  p_name            text,
  p_city            text,
  p_state           char(2),
  p_dues_cents      integer,
  p_dues_cadence    dues_cadence,
  p_due_day         smallint,
  p_founder_name    text,
  p_founder_unit    text,
  p_households      jsonb default '[]'::jsonb,
  p_property_type   property_type default null,
  p_origin          association_origin default null,
  p_collects        text[] default '{}',
  p_shared_spaces   text[] default '{}',
  p_previously      text default null,
  p_founder_address text default null
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
     property_type, origin, collects, shared_spaces, previously)
  values
    (btrim(p_name), btrim(p_city), p_state, p_dues_cents, p_dues_cadence, p_due_day,
     p_property_type, p_origin, coalesce(p_collects, '{}'), coalesce(p_shared_spaces, '{}'),
     nullif(btrim(coalesce(p_previously, '')), ''))
  returning id into v_association;

  -- The founder's own home, with its address, and the founder as President.
  insert into units (association_id, label, address)
  values (v_association, btrim(p_founder_unit), btrim(coalesce(p_founder_address, '')))
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

grant execute on function create_association(
  text, text, char(2), integer, dues_cadence, smallint, text, text, jsonb,
  property_type, association_origin, text[], text[], text, text
) to authenticated;
