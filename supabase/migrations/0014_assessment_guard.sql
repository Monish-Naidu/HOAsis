-- Billing dues twice for one month is a conversation with every owner, so
-- `issue_assessment` has always refused to bill a period it had already billed.
-- It decided that by due date alone.
--
-- That was correct while dues were the only thing an association charged. The
-- moment a water bill lands on the same due date, the guard reads it as "this
-- month is already billed" and silently skips the dues. Nobody gets an invoice,
-- the balances look fine, and the shortfall only shows up as a cash problem
-- months later. A three year run with utilities layered on found it; a year of
-- dues alone never could.
--
-- The guard now looks at dues only, which is what it always meant.

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
  if not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  select dues_cents into v_dues from associations where id = p_association_id;

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

-- A payment is not a dues charge, and grouping it under one in a trend chart
-- makes a month with a big receipt look like a month with a big bill. Payments
-- carry the category of what they cleared only through their allocations, so
-- the trend view reads charges and payments apart rather than together.
create or replace view monthly_activity as
  select ch.association_id,
         date_trunc('month', ch.due_on)::date as month,
         ch.category,
         sum(case when ch.kind = 'charge' then ch.amount_cents else 0 end)::bigint as billed_cents,
         sum(case when ch.kind <> 'charge' then -ch.amount_cents else 0 end)::bigint as credited_cents,
         count(*) filter (where ch.kind = 'charge') as charge_count
    from charges ch
   where is_member_of(ch.association_id)
     and ch.kind = 'charge'
   group by 1, 2, 3;

grant select on monthly_activity to authenticated;
