-- Recording a sale.
--
-- Homes change hands, and it is the single most common structural change an
-- association ever makes. There was no way to record one: a board could end a
-- tenure and start another by hand, in two statements, with nothing checking
-- that the dates lined up or that the home ended up with exactly one holder.
--
-- Doing it in two steps also has a trap. Memberships carry
-- `check (ends_on is null or ends_on >= starts_on)`, so ending a tenure on a
-- closing date earlier than the day that tenure was recorded is refused, which
-- is right, and mystifying if you meet it through a form that does not explain
-- it. That is what this function is for.
--
-- The balance is untouched on purpose. It belongs to the home, not to whoever
-- last lived in it, which is why charges reference a unit. What the parties
-- owe each other for the unpaid portion is settled at closing, by the title
-- company, from the resale certificate.

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
  v_current     record;
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

  select * into v_current
  from memberships
  where unit_id = p_unit_id and ends_on is null
  order by starts_on desc
  limit 1;

  if v_current.id is not null then
    if p_closing_date < v_current.starts_on then
      raise exception
        'The closing date is before the current owner''s tenure began on %. Check the date.',
        v_current.starts_on
        using errcode = '22000';
    end if;

    -- A President cannot be sold out of the association without handing over
    -- the office first, or nobody can grant access back.
    if v_current.role = 'president' then
      raise exception
        'This home is held by the President. Hand over the office before recording the sale.'
        using errcode = '23514';
    end if;

    update memberships set ends_on = p_closing_date where id = v_current.id;
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
grant execute on function transfer_home to authenticated;

-- Who has ever held a home, for a board reconstructing the past.
create or replace function home_history(p_unit_id uuid)
returns table (
  full_name  text,
  email      text,
  starts_on  date,
  ends_on    date,
  is_current boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.full_name,
    coalesce(p.email, m.invited_email),
    m.starts_on,
    m.ends_on,
    m.ends_on is null
  from memberships m
  left join profiles p on p.id = m.profile_id
  join units u on u.id = m.unit_id
  where m.unit_id = p_unit_id
    and (
      m.unit_id in (select my_unit_ids())
      or has_capability(u.association_id, 'finances')
      or has_capability(u.association_id, 'settings')
    )
  order by m.starts_on;
$$;

revoke all on function home_history from public;
grant execute on function home_history to authenticated;
