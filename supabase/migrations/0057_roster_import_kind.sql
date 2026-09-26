-- import_households, with the charge kind cast.
--
-- 0056 wrote the opening balance line with a text literal where the column
-- is the charge_kind enum, and Postgres refused the insert on the first real
-- import. Same function, one cast. Everything else in 0056 stands.

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
          (case when v_balance > 0 then 'charge' else 'credit' end)::charge_kind,
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
