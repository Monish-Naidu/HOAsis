-- No late fee on a balance brought forward.
--
-- A starting balance is stored as a dues line labelled "Balance brought
-- forward", dated the day the board says the figure was true (0057). To
-- assess_late_fees that was a dues bill like any other: a board that moved in
-- October with balances as of the first of the year, and had set a late fee,
-- would have charged that fee to every home that owed anything, on the first
-- morning after setup. The figure came from another system, may already hold
-- that system's late fees, and nobody here ever sent a bill for it.
--
-- So a brought-forward line never draws a fee. Dues billed here still do,
-- exactly as before, and an owner who leaves the old balance unpaid is still
-- past due on every screen. A board that wants to charge for it can add a
-- charge by hand.
--
-- Copied whole from 0079 with that one condition added. Signature, security
-- settings, the advisory lock and the grants are as 0079 left them.

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
  if coalesce(auth.role(), '') <> 'service_role'
     and not has_capability(p_association_id, 'finances') then
    raise exception 'You do not have the finances capability' using errcode = '42501';
  end if;

  -- The same lock issue_assessment takes: one run per association at a
  -- time, so "once per dues line, ever" holds when two runs overlap.
  perform pg_advisory_xact_lock(hashtext('dues:' || p_association_id::text));

  select coalesce(settings -> 'collectionPolicy', '{}'::jsonb)
    into v_policy
    from associations
   where id = p_association_id and deleted_at is null;
  if v_policy is null then
    return 0;
  end if;

  -- No fee until the board sets one. An association with no policy stored,
  -- or a policy with no fee in it, posts nothing.
  v_notice_day := coalesce((v_policy ->> 'lateNoticeDay')::integer, 30);
  v_fee_cents  := coalesce((v_policy ->> 'lateFeeCents')::integer, 0);
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
     -- Not what a home owed before it came here; see the note at the top.
     and c.label <> 'Balance brought forward'
     and c.due_on + v_notice_day <= p_today
     -- Still owed, read off the statement oldest first: this line is open
     -- only while the home owes more than everything billed after it. The
     -- allocation rows cannot answer this, because they are written at
     -- payment time against lines that already exist; money paid ahead, an
     -- opening credit, or a payment at closing never attaches to a later
     -- bill, and every such home read as unpaid.
     and (
           select coalesce(sum(x.amount_cents), 0) from charges x
            where x.unit_id = c.unit_id and x.due_on <= p_today
         ) > (
           select coalesce(sum(n.amount_cents), 0) from charges n
            where n.unit_id = c.unit_id and n.kind = 'charge' and n.due_on <= p_today
              and (n.due_on, n.created_at, n.id) > (c.due_on, c.created_at, c.id)
         )
     -- A bank payment takes days to clear and is on the statement only once
     -- it does. While one is in flight the home is left alone; the run is
     -- daily, so a payment that fails is picked up the next morning. Two
     -- weeks bounds it, so a row nobody ever settled cannot shield a home
     -- for good.
     and not exists (
           select 1 from payments p
            where p.unit_id = c.unit_id and p.state = 'pending'
              and p.created_at > now() - interval '14 days'
         )
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

-- As 0069 left them: a finance holder or the server, never a visitor with
-- no session.
revoke all on function assess_late_fees(uuid, date) from public;
revoke execute on function assess_late_fees(uuid, date) from anon;
grant execute on function assess_late_fees(uuid, date) to authenticated;
