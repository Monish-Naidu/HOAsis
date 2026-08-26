-- The founder's own membership carried no email.
--
-- create_association recorded invited_email only for the households being
-- invited, on the reasoning that the founder is already signed in and does not
-- need an invitation. True, but the roster reads that column to answer a
-- different question: can this household be reached at all. The founder came
-- out looking unreachable, and the dashboard told a President who had just
-- typed their own email address to go and collect it.

create or replace function create_association(
  p_name          text,
  p_city          text,
  p_state         char(2),
  p_dues_cents    integer,
  p_dues_cadence  dues_cadence,
  p_due_day       smallint,
  p_founder_name  text,
  p_founder_unit  text,
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
  v_email        text;
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

  -- Their own address, so the roster can tell a reachable household from one
  -- nobody has contact details for.
  select email into v_email from profiles where id = v_caller;

  insert into associations (name, city, state, dues_cents, dues_cadence, due_day)
  values (trim(p_name), trim(p_city), p_state, p_dues_cents, p_dues_cadence, p_due_day)
  returning id into v_association;

  insert into units (association_id, label, address)
  values (v_association, trim(p_founder_unit), 'Unit ' || trim(p_founder_unit))
  returning id into v_unit;

  insert into memberships (
    association_id, unit_id, profile_id, invited_email, full_name, role, capabilities
  )
  values (
    v_association, v_unit, v_caller, v_email, trim(p_founder_name), 'president',
    array[
      'finances', 'requests', 'documents', 'communications', 'voting',
      'vendors', 'compliance', 'forum', 'settings', 'permissions'
    ]::capability[]
  );

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

-- What HOAsis charges, recorded per association so a change of price is a
-- decision with a date rather than a constant somebody edits.
alter table associations
  add column if not exists software_fee_cents_per_home integer not null default 400,
  add column if not exists payment_fee_cents integer not null default 200,
  add column if not exists payment_fee_paid_by text not null default 'owner',
  add column if not exists payment_fee_waived_on_ach boolean not null default false;

comment on column associations.software_fee_cents_per_home is
  'Our subscription, per home per month. $4.00 by default.';
comment on column associations.payment_fee_cents is
  'Our fee per payment, on top of the processor cost. $2.00 by default.';
