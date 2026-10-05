-- Dues that differ home by home.
--
-- A condo building where a one-bedroom pays $210 and a three-bedroom pays
-- $340 could not be set up: an association had one amount, and at most one
-- amount per kind of home. A home may now carry its own regular assessment.
--
-- What a home pays, in one place (unit_dues_cents): its own amount if it has
-- one, else its kind's amount if the association bills by kind, else the
-- association's amount. The TypeScript side applies the same order in
-- ownerDues (src/lib/home-types.ts); change both together.
--
-- Only issue_assessment reads a home's dues. Every other reader of
-- dues_cents is the association's own amount (create_association's insert,
-- the settings audit trigger), which stays what it is.

alter table units
  add column if not exists dues_cents integer check (dues_cents is null or dues_cents >= 0);

comment on column units.dues_cents is
  'This home''s own regular assessment, in cents. Null means it pays what its kind or the association pays (unit_dues_cents).';

-- The rule. A zero on a kind or on the home reads as "not set", as it did
-- before, so the only way to get a free home is not to bill it.
create or replace function unit_dues_cents(p_unit units)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(p_unit.dues_cents, 0),
    nullif((a.dues_by_type ->> p_unit.home_type::text)::integer, 0),
    a.dues_cents
  )
  from associations a
  where a.id = p_unit.association_id;
$$;

revoke all on function unit_dues_cents(units) from public;
revoke execute on function unit_dues_cents(units) from anon;
grant execute on function unit_dues_cents(units) to authenticated;
grant execute on function unit_dues_cents(units) to service_role;

-- issue_assessment, copied whole from 0069. The permission check, the
-- advisory lock, the billing_starts_on guard, the one-bill-per-period guard,
-- the signature, the security settings and the grants are as they were. The
-- one change is the amount each home is billed: unit_dues_cents(u) instead of
-- the kind-or-association coalesce.
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
  v_starts date;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  -- One billing run per association at a time. The "already billed" tests
  -- below read what is committed; without this, two runs that start
  -- together each see nothing and both insert. Held until this transaction
  -- ends, and every statement after it takes a fresh look, so the second
  -- run finds the first run's lines. Shared with assess_late_fees.
  perform pg_advisory_xact_lock(hashtext('dues:' || p_association_id::text));

  select dues_cents, dues_by_type, coalesce(billing_starts_on, created_at::date)
    into v_dues, v_bytype, v_starts
    from associations where id = p_association_id;
  if v_dues is null or v_dues <= 0 then
    return 0;
  end if;
  if p_due_on < v_starts then
    return 0;
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select p_association_id, u.id, 'charge', 'dues', p_label,
         unit_dues_cents(u),
         p_due_on
  from units u
  where u.association_id = p_association_id
    and not exists (
      select 1 from charges c
      where c.unit_id = u.id
        and c.kind = 'charge'
        and c.category = 'dues'
        and c.due_on = p_due_on
    )
    and not exists (
      select 1 from charges c
      where c.unit_id = u.id
        and c.label = 'Balance brought forward'
        and c.due_on >= p_due_on
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function issue_assessment(uuid, text, date) from public;
revoke execute on function issue_assessment(uuid, text, date) from anon;
grant execute on function issue_assessment(uuid, text, date) to authenticated;

-- Set or clear one home's own amount. Null clears it, so the home pays its
-- kind's or the association's amount from the next bill. Bills already
-- issued keep the amount they were issued at.
create or replace function set_home_dues(
  p_unit_id    uuid,
  p_dues_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to change dues' using errcode = '42501';
  end if;
  if p_dues_cents is not null and p_dues_cents < 0 then
    raise exception 'Dues cannot be negative' using errcode = '22000';
  end if;

  select association_id into v_association from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not (has_capability(v_association, 'finances')
          or has_capability(v_association, 'settings')) then
    raise exception 'You cannot change dues for that home' using errcode = '42501';
  end if;

  update units set dues_cents = p_dues_cents where id = p_unit_id;
end;
$$;

revoke all on function set_home_dues(uuid, integer) from public;
revoke execute on function set_home_dues(uuid, integer) from anon;
grant execute on function set_home_dues(uuid, integer) to authenticated;
