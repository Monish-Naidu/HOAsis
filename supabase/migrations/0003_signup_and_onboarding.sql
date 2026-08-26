-- Signing up, and founding an association.
--
-- Two chicken-and-egg problems the first migration left behind.
--
-- A person who signs up has a row in auth.users and nothing else, so every
-- policy that reads `profiles` sees nobody. And founding an association is
-- impossible under the policies as written: inserting the association needs a
-- capability, the capability lives on a membership, and the membership needs
-- an association. Nobody can ever get started.
--
-- Both are solved the same way, with a function that runs as the definer and
-- checks the caller itself rather than delegating to a policy that cannot yet
-- apply.

-- ------------------------------------------------------------------ signup

-- A profile per authenticated person, created by the database rather than by
-- the client. A client that forgets, crashes, or is closed mid-signup would
-- otherwise leave an account that can never be referenced by anything.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  -- Claim any seat a board already reserved for this address. This is what
  -- makes an invitation work: the board adds the household before the person
  -- has an account, and signing up with that email takes the seat.
  update memberships
     set profile_id = new.id,
         full_name  = coalesce(nullif(full_name, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
   where profile_id is null
     and lower(invited_email) = lower(new.email)
     and ends_on is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- -------------------------------------------------------------- onboarding

-- Founds an association with the caller as its President.
--
-- Runs as the definer because the caller cannot hold a capability in an
-- association that does not exist yet. Authorization is therefore explicit:
-- there must be a signed in person, and they are the one who ends up holding
-- the presidency. Nothing here trusts a value the client supplied about who
-- they are.
create or replace function create_association(
  p_name          text,
  p_city          text,
  p_state         char(2),
  p_dues_cents    integer,
  p_dues_cadence  dues_cadence,
  p_due_day       smallint,
  p_founder_name  text,
  p_founder_unit  text,
  -- [{ "name": "...", "email": "...", "unit": "..." }, ...]
  p_households    jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller       uuid := auth.uid();
  v_association  uuid;
  v_unit         uuid;
  v_household    jsonb;
begin
  if v_caller is null then
    raise exception 'Only a signed in person can found an association'
      using errcode = '42501';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'An association needs a name' using errcode = '22000';
  end if;

  if p_dues_cents < 0 then
    raise exception 'Dues cannot be negative' using errcode = '22000';
  end if;

  insert into associations (name, city, state, dues_cents, dues_cadence, due_day)
  values (trim(p_name), trim(p_city), p_state, p_dues_cents, p_dues_cadence, p_due_day)
  returning id into v_association;

  -- The founder's own home, and the presidency that goes with founding.
  insert into units (association_id, label, address)
  values (v_association, trim(p_founder_unit), 'Unit ' || trim(p_founder_unit))
  returning id into v_unit;

  insert into memberships (
    association_id, unit_id, profile_id, full_name, role, capabilities
  )
  values (
    v_association, v_unit, v_caller, trim(p_founder_name), 'president',
    array[
      'finances', 'requests', 'documents', 'communications', 'voting',
      'vendors', 'compliance', 'forum', 'settings', 'permissions'
    ]::capability[]
  );

  -- Everyone else, held against their email until they sign up and claim it.
  for v_household in select * from jsonb_array_elements(p_households)
  loop
    continue when coalesce(trim(v_household ->> 'unit'), '') = '';

    insert into units (association_id, label, address)
    values (
      v_association,
      trim(v_household ->> 'unit'),
      'Unit ' || trim(v_household ->> 'unit')
    )
    on conflict (association_id, label) do nothing
    returning id into v_unit;

    continue when v_unit is null;

    insert into memberships (
      association_id, unit_id, profile_id, invited_email, full_name, role, capabilities
    )
    values (
      v_association,
      v_unit,
      null,
      nullif(trim(coalesce(v_household ->> 'email', '')), ''),
      trim(coalesce(v_household ->> 'name', '')),
      'resident',
      '{}'::capability[]
    );
  end loop;

  return v_association;
end;
$$;

revoke all on function create_association from public;
grant execute on function create_association to authenticated;

-- The associations a person can currently reach, for the switcher.
create or replace function my_associations()
returns table (
  association_id uuid,
  name           text,
  role           board_role,
  capabilities   capability[]
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, m.role, m.capabilities
  from memberships m
  join associations a on a.id = m.association_id
  where m.profile_id = auth.uid() and m.ends_on is null
  order by a.name;
$$;
