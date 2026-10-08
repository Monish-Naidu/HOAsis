-- 0113: a fine is a charge on the home.
--
-- The notice letters said "no fine is decided before the hearing" and then
-- "a fine of $X has been imposed", but nothing could charge one: the
-- violation's fine_cents was always 0 and the owner's balance never moved.
-- Section 15 of the tracker, "Fines that post to the balance".
--
-- fine_violation(notice, cents, note) does the whole act at once: a charge
-- row on the home (category 'fine', label "Fine: {rule}", due in 30 days),
-- the notice moved to the 'fined' stage with the amount and the next
-- action date, and one activity row. It asks the compliance capability
-- (the person running notices) and the billing lock; it does not ask
-- finances, because the fine is decided at the hearing, not at the bank,
-- and the hearing is the board's compliance work. A fine on a notice that
-- has been cured, or a second fine on a fined notice, is refused: the
-- next fine is a new notice. A fine needs a hearing first (stage
-- 'hearing'), which is the order the library's own page insists on.
--
-- A fine that was wrong is reversed the way any charge is: a credit
-- (add_credit, 0103) with a reason. The notice keeps its record.

create or replace function fine_violation(p_violation_id uuid, p_amount_cents integer, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_violation violations%rowtype;
  v_charge    uuid;
  v_label     text;
begin
  select * into v_violation from violations where id = p_violation_id;
  if not found then
    raise exception 'No such notice' using errcode = 'P0002';
  end if;
  if not has_capability(v_violation.association_id, 'compliance') then
    raise exception 'You cannot fine for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(v_violation.association_id);
  if v_violation.unit_id is null then
    raise exception 'That notice is not on a home' using errcode = '22023';
  end if;
  if v_violation.stage <> 'hearing' then
    raise exception 'A fine follows a hearing' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 1000000 then
    raise exception 'A fine is between $1 and $10,000' using errcode = '22000';
  end if;

  v_label := left('Fine: ' || coalesce(nullif(trim(v_violation.rule), ''), 'rule violation'), 80);

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  values (v_violation.association_id, v_violation.unit_id, 'charge', 'fine', v_label, p_amount_cents, current_date + 30)
  returning id into v_charge;

  update violations
     set stage = 'fined',
         fine_cents = p_amount_cents,
         next_action_on = current_date + 30
   where id = p_violation_id;

  perform record_activity(v_violation.association_id, 'violation', p_violation_id,
    format('Fined %s $%s: %s',
      coalesce(nullif(v_violation.unit_label, ''), 'a home'),
      to_char(p_amount_cents / 100.0, 'FM999,999,990.00'),
      coalesce(nullif(trim(v_violation.rule), ''), 'rule violation')),
    jsonb_build_object('charge_id', v_charge, 'amount_cents', p_amount_cents,
      'note', nullif(trim(coalesce(p_note, '')), '')));

  return v_charge;
end;
$$;

revoke all on function fine_violation(uuid, integer, text) from public;
grant execute on function fine_violation(uuid, integer, text) to authenticated;
