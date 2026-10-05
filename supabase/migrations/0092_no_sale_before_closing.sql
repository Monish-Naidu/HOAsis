-- A sale cannot be recorded before it has happened.
--
-- transfer_home ends every seat on the home the moment it runs and seats the
-- buyer, and every "current owner" test in the product is "ends_on is null".
-- So a board that recorded next month's closing today locked the seller out
-- of their statement, their autopay and their vote a month early, and handed
-- the buyer a home they did not own yet. The form refuses a date after today
-- since 2026-10-05; this is the same refusal where it cannot be skipped.
--
-- Copied whole from 0081 with that one check added.

create or replace function transfer_home(
  p_unit_id      uuid,
  p_new_name     text,
  p_new_email    text,
  p_closing_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_association uuid;
  v_latest_start date;
  v_new         uuid;
begin
  select association_id into v_association from units where id = p_unit_id;
  if v_association is null then
    raise exception 'No such home' using errcode = '23503';
  end if;

  if not has_capability(v_association, 'settings')
     and not has_capability(v_association, 'finances') then
    raise exception 'Recording a sale needs the settings or money capability'
      using errcode = '42501';
  end if;

  if coalesce(trim(p_new_name), '') = '' then
    raise exception 'The new owner needs a name' using errcode = '22000';
  end if;

  -- A sale takes effect when it is recorded, whatever its date. One day of
  -- grace, because the database keeps UTC and an evening closing in the
  -- United States is already tomorrow there.
  if p_closing_date > current_date + 1 then
    raise exception 'Closing has not happened yet. Record the sale on or after %.', p_closing_date
      using errcode = '22000';
  end if;

  select max(starts_on) into v_latest_start
  from memberships
  where unit_id = p_unit_id and ends_on is null;

  if v_latest_start is not null then
    if p_closing_date < v_latest_start then
      raise exception
        'The closing date is before the current owner''s tenure began on %. Check the date.',
        v_latest_start
        using errcode = '22000';
    end if;

    -- A President cannot be sold out of the association without handing over
    -- the office first, or nobody can grant access back.
    if exists (
      select 1 from memberships
      where unit_id = p_unit_id and ends_on is null and role = 'president'
    ) then
      raise exception
        'This home is held by the President. Hand over the office before recording the sale.'
        using errcode = '23514';
    end if;

    update memberships set ends_on = p_closing_date
    where unit_id = p_unit_id and ends_on is null;
  end if;

  insert into memberships (
    association_id, unit_id, profile_id, invited_email, full_name,
    role, capabilities, starts_on
  )
  values (
    v_association, p_unit_id, null,
    nullif(trim(coalesce(p_new_email, '')), ''),
    trim(p_new_name), 'resident', '{}'::capability[], p_closing_date
  )
  returning id into v_new;

  return v_new;
end;
$$;

revoke all on function transfer_home from public;
revoke execute on function transfer_home from anon;
grant execute on function transfer_home to authenticated;
