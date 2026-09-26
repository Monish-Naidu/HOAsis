-- Bringing a real roster in, and billing the first period once.
--
-- Three things a board moving from a spreadsheet or another product needs
-- that nothing offered:
--
--   1. A way to put many homes on the register at once, each with the
--      household's name, email, phone, address and what it owed on the day
--      the books moved here. create_association seats the first households
--      and add_household seats one more; neither carries a phone or a
--      balance, and neither can be run over an existing register without
--      refusing on the first home it already knows.
--
--   2. A date the books start here. A board that imports on the 10th with
--      balances that already include this month's dues must not be billed
--      this month again by the daily run. associations.billing_starts_on is
--      the first due date this product bills; null means the day the
--      association was founded, which is what the run assumed before.
--
--   3. A per home guard in issue_assessment: a home whose opening balance
--      is dated on or after a due date already carries that period in the
--      figure the treasurer typed, so it is not billed for it a second time.
--
-- Everything is additive. The opening balance line keeps the label the
-- Homeowners screen has always written ("Balance brought forward"), so the
-- statement, the balance view and this import cannot disagree about what an
-- opening figure looks like.

alter table associations
  add column if not exists billing_starts_on date;

comment on column associations.billing_starts_on is
  'First due date this product bills. Null means from the founding date. Set by the setup wizard or the roster import so a period already inside the opening balances is never billed twice.';

-- ---------------------------------------------------------------- import

-- p_rows is a JSON array of { unit, address, name, email, phone,
-- opening_balance_cents }. unit is the register key; when it is blank the
-- address is the key, as the wizard does for a community that never numbered
-- its homes. A home already on the register is updated, not refused:
-- blanks are filled and a seat nobody has claimed yet takes the email. A
-- seat somebody already signed in to keeps its email, because changing it
-- would hand their home to a different address.
--
-- Opening balances are one dated line per home, replaced rather than
-- stacked, exactly as the Homeowners screen writes them. A row with no
-- balance column leaves any existing line alone; a row with an explicit 0
-- clears it.
--
-- Refused when a home has already been billed dues here for a period on or
-- before p_as_of: the opening figure would count that period twice, and a
-- balance that is silently wrong on day one is the failure this product is
-- built against. The board picks an earlier as-of date or leaves the balance
-- blank for that home.

create or replace function import_households(
  p_association_id uuid,
  p_rows           jsonb,
  p_as_of          date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       jsonb;
  v_label     text;
  v_address   text;
  v_name      text;
  v_email     text;
  v_phone     text;
  v_balance   integer;
  v_has_bal   boolean;
  v_unit      uuid;
  v_created   integer := 0;
  v_updated   integer := 0;
  v_balances  integer := 0;
  v_skipped   integer := 0;
  v_any_bal   boolean := false;
begin
  if not has_capability(p_association_id, 'settings') then
    raise exception 'Only a settings holder can import the roster' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of homes' using errcode = '22000';
  end if;

  select exists (
    select 1 from jsonb_array_elements(p_rows) r
    where r ? 'opening_balance_cents'
      and coalesce((r ->> 'opening_balance_cents')::integer, 0) <> 0
  ) into v_any_bal;
  if v_any_bal and not has_capability(p_association_id, 'finances') then
    raise exception 'Opening balances need the finances capability' using errcode = '42501';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_address := btrim(coalesce(v_row ->> 'address', ''));
    v_label   := btrim(coalesce(v_row ->> 'unit', ''));
    if v_label = '' then
      v_label := v_address;
    end if;
    if v_label = '' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_name    := btrim(coalesce(v_row ->> 'name', ''));
    v_email   := nullif(lower(btrim(coalesce(v_row ->> 'email', ''))), '');
    v_phone   := btrim(coalesce(v_row ->> 'phone', ''));
    v_has_bal := (v_row ? 'opening_balance_cents') and ((v_row ->> 'opening_balance_cents') is not null);
    v_balance := case when v_has_bal then coalesce((v_row ->> 'opening_balance_cents')::integer, 0) else 0 end;

    select id into v_unit from units
     where association_id = p_association_id and label = v_label;

    if v_unit is null then
      insert into units (association_id, label, address)
      values (p_association_id, v_label, v_address)
      returning id into v_unit;

      insert into memberships
        (association_id, unit_id, invited_email, full_name, role, capabilities, phone)
      values
        (p_association_id, v_unit, v_email, v_name, 'resident', '{}'::capability[], v_phone);
      v_created := v_created + 1;
    else
      -- Fill what is blank on the home and on its open seat. A claimed seat
      -- keeps its email; everything else takes the file's word where the
      -- register had nothing.
      update units
         set address = case when address = '' then v_address else address end
       where id = v_unit;

      update memberships m
         set full_name     = case when m.full_name = '' then v_name else m.full_name end,
             invited_email = case when m.profile_id is null and v_email is not null then v_email
                                  else m.invited_email end,
             phone         = case when m.phone = '' then v_phone else m.phone end
       where m.unit_id = v_unit
         and m.ends_on is null
         and m.role = 'resident'
         and m.id = (
           select id from memberships
            where unit_id = v_unit and ends_on is null and role = 'resident'
            order by created_at limit 1
         );

      -- A home with no seat at all (every seat closed by a sale) gets one.
      if not exists (select 1 from memberships where unit_id = v_unit and ends_on is null) then
        insert into memberships
          (association_id, unit_id, invited_email, full_name, role, capabilities, phone)
        values
          (p_association_id, v_unit, v_email, v_name, 'resident', '{}'::capability[], v_phone);
      end if;
      v_updated := v_updated + 1;
    end if;

    -- Somebody who already has an account is seated now rather than waiting
    -- for a signup that will never come.
    update memberships m
       set profile_id = p.id
      from profiles p
     where m.unit_id = v_unit
       and m.ends_on is null
       and m.profile_id is null
       and m.invited_email is not null
       and lower(p.email) = lower(m.invited_email);

    if v_has_bal then
      if v_balance <> 0 and exists (
        select 1 from charges c
         where c.unit_id = v_unit
           and c.kind = 'charge'
           and c.category = 'dues'
           and c.label <> 'Balance brought forward'
           and c.due_on <= p_as_of
      ) then
        raise exception
          'Home % was already billed here for a period on or before %. Pick an earlier as-of date or leave its opening balance blank.',
          v_label, p_as_of
          using errcode = '22000';
      end if;

      delete from charges
       where unit_id = v_unit and label = 'Balance brought forward';
      if v_balance <> 0 then
        insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
        values (
          p_association_id, v_unit,
          case when v_balance > 0 then 'charge' else 'credit' end,
          'dues', 'Balance brought forward', v_balance, p_as_of
        );
        v_balances := v_balances + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'balances', v_balances,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function import_households(uuid, jsonb, date) from public;
grant execute on function import_households(uuid, jsonb, date) to authenticated;

-- ---------------------------------------------------------------- the guard

-- Same body as 0036, with two refusals in front of the insert:
--
--   the association's books do not start until billing_starts_on, so a due
--   date before it bills nothing (the run reads created_at as "since" and
--   this column tightens that without touching the run);
--
--   a home whose opening balance is dated on or after the due date already
--   owes that period inside the opening figure, so it is left out.

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
  if auth.uid() is not null and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

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

revoke all on function issue_assessment from public;
grant execute on function issue_assessment to authenticated;
