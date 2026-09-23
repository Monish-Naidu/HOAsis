-- Dues that bill themselves.
--
-- issue_assessment has existed since 0004 and nothing in the product ever
-- called it: the seed scripts did, so every demo had bills, and no real
-- association ever got one. The daily cron now issues each period's dues on
-- its due day, under the service role, which has no auth.uid(). The same
-- trust rule record_payment uses applies: a null caller is the server, and
-- the server is trusted by definition because no browser reaches it. A
-- signed-in caller still needs the finances capability.
--
-- The guard on (unit, dues, due_on) is unchanged, so the cron and a board
-- member pressing "bill dues now" on the same morning produce one bill.

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
  v_count integer := 0;
  v_dues  integer;
begin
  if auth.uid() is not null and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  select dues_cents into v_dues from associations where id = p_association_id;
  if v_dues is null or v_dues <= 0 then
    return 0;
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select p_association_id, u.id, 'charge', 'dues', p_label, v_dues, p_due_on
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
