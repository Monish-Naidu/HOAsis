-- Late fees that actually get charged.
--
-- The pay screen and the collection policy have promised "a $25 late fee
-- from 30 days past due" since 2026-09-01, and nothing ever posted one. The
-- daily dues run now calls this after billing: for every dues line that is
-- still unpaid past the policy's notice day, one late fee line, once. The
-- fee is a charge like any other, so it lands on the owner's statement,
-- counts in past due, and is paid oldest first like the rest.
--
-- The policy lives in associations.settings->'collectionPolicy' (the board's
-- ladder, set on Finances > Collections); the defaults match
-- DEFAULT_COLLECTION_POLICY in src/lib/collections.ts. A fee of zero means
-- the board chose no fee, and nothing posts. Idempotent: the fee for a dues
-- line is keyed by label, so a second run the same day, or a retried cron,
-- finds it and stops.

create or replace function assess_late_fees(
  p_association_id uuid,
  p_today          date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy     jsonb;
  v_notice_day integer;
  v_fee_cents  integer;
  v_count      integer := 0;
begin
  if auth.uid() is not null and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  select coalesce(settings -> 'collectionPolicy', '{}'::jsonb)
    into v_policy
    from associations
   where id = p_association_id and deleted_at is null;
  if v_policy is null then
    return 0;
  end if;

  v_notice_day := coalesce((v_policy ->> 'lateNoticeDay')::integer, 30);
  v_fee_cents  := coalesce((v_policy ->> 'lateFeeCents')::integer, 2500);
  if v_fee_cents <= 0 or v_notice_day < 1 then
    return 0;
  end if;

  insert into charges (association_id, unit_id, kind, category, label, amount_cents, due_on)
  select c.association_id, c.unit_id, 'charge', 'late_fee',
         'Late fee, ' || c.label, v_fee_cents, p_today
    from charges c
   where c.association_id = p_association_id
     and c.kind = 'charge'
     and c.category = 'dues'
     and c.due_on + v_notice_day <= p_today
     -- Still owed: what was billed less what payments were applied to it.
     and c.amount_cents > coalesce((
           select sum(pa.amount_cents) from payment_allocations pa where pa.charge_id = c.id
         ), 0)
     -- Once per dues line, ever.
     and not exists (
           select 1 from charges f
            where f.unit_id = c.unit_id
              and f.category = 'late_fee'
              and f.label = 'Late fee, ' || c.label
         );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function assess_late_fees(uuid, date) from public;
grant execute on function assess_late_fees(uuid, date) to authenticated;
