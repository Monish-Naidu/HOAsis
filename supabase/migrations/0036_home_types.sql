-- A community with more than one kind of home.
--
-- Townhomes along the entry, condos over the clubhouse, detached houses at
-- the back, all one association. The kind of home is a fact about each home:
-- it decides who insures the walls and often what the home pays. So each
-- unit carries its kind, the association lists every kind it has, and a kind
-- can pay its own amount.
--
-- property_type stays: it holds the answer when there is exactly one kind,
-- which is most associations, and every reader of it keeps working.

alter table associations
  add column if not exists home_types   property_type[] not null default '{}',
  add column if not exists dues_by_type jsonb           not null default '{}'::jsonb;

alter table units
  add column if not exists home_type property_type;

-- Existing associations of one kind: their homes are that kind.
update units u
   set home_type = a.property_type
  from associations a
 where u.association_id = a.id
   and u.home_type is null
   and a.property_type is not null;

update associations
   set home_types = array[property_type]
 where property_type is not null
   and home_types = '{}';

-- Founding, with the kinds. The old signature is dropped rather than
-- overloaded, because two functions with the same name and defaulted
-- arguments make every named call ambiguous.
drop function if exists create_association(
  text, text, char(2), integer, dues_cadence, smallint, text, text, jsonb,
  property_type, association_origin, text[], text[], text, text
);

create or replace function create_association(
  p_name              text,
  p_city              text,
  p_state             char(2),
  p_dues_cents        integer,
  p_dues_cadence      dues_cadence,
  p_due_day           smallint,
  p_founder_name      text,
  p_founder_unit      text,
  p_households        jsonb default '[]'::jsonb,
  p_property_type     property_type default null,
  p_origin            association_origin default null,
  p_collects          text[] default '{}',
  p_shared_spaces     text[] default '{}',
  p_previously        text default null,
  p_founder_address   text default null,
  p_home_types        property_type[] default null,
  p_dues_by_type      jsonb default null,
  p_founder_home_type property_type default null
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
  v_types       property_type[];
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

  v_types := coalesce(
    nullif(p_home_types, '{}'),
    case when p_property_type is null then '{}'::property_type[] else array[p_property_type] end
  );

  insert into associations
    (name, city, state, dues_cents, dues_cadence, due_day,
     property_type, origin, collects, shared_spaces, previously,
     home_types, dues_by_type)
  values
    (btrim(p_name), btrim(p_city), p_state, p_dues_cents, p_dues_cadence, p_due_day,
     p_property_type, p_origin, coalesce(p_collects, '{}'), coalesce(p_shared_spaces, '{}'),
     nullif(btrim(coalesce(p_previously, '')), ''),
     v_types, coalesce(p_dues_by_type, '{}'::jsonb))
  returning id into v_association;

  -- The founder's own home, with its address and kind, and the founder as
  -- President.
  insert into units (association_id, label, address, home_type)
  values (
    v_association, btrim(p_founder_unit), btrim(coalesce(p_founder_address, '')),
    coalesce(p_founder_home_type, v_types[1])
  )
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
      insert into units (association_id, label, address, home_type)
      values (
        v_association, v_label, btrim(coalesce(v_household ->> 'address', '')),
        coalesce(nullif(v_household ->> 'homeType', '')::property_type, v_types[1])
      )
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
  property_type, association_origin, text[], text[], text, text,
  property_type[], jsonb, property_type
) to authenticated;

-- Dues by kind. Each home is billed its kind's amount where the association
-- set one, and the association's amount otherwise. Same guard as 0034, so a
-- due date is still billed once.
create or replace function issue_assessment(
  p_association_id uuid,
  p_label          text,
  p_due_on         date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer := 0;
  v_dues   integer;
  v_bytype jsonb;
begin
  if auth.uid() is not null and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  select dues_cents, dues_by_type into v_dues, v_bytype
    from associations where id = p_association_id;
  if v_dues is null or v_dues <= 0 then
    return 0;
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select p_association_id, u.id, 'charge', 'dues', p_label,
         coalesce(nullif((v_bytype ->> u.home_type::text)::integer, 0), v_dues),
         p_due_on
  from units u
  where u.association_id = p_association_id
    and not exists (
      select 1 from charges c
      where c.unit_id = u.id
        and c.kind = 'charge'
        and c.category = 'dues'
        and c.due_on = p_due_on
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function issue_assessment from public;
grant execute on function issue_assessment to authenticated;
