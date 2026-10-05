-- A sale ends every owner's seat, not only the newest.
--
-- transfer_home ended the one seat with the latest starts_on and started the
-- buyer's. With a second owner on the home (0080) the other owner kept their
-- access, their vote and their view of the balance after the closing date.
-- Now every seat open on the home ends on the closing date.
--
-- Everything else is as 0012 wrote it, with the same signature, so the
-- deployed client is unaffected. The checks that guarded the one seat guard
-- all of them: no seat may end before it began, and the President's seat is
-- never sold out from under the association. anon is revoked by name.

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
