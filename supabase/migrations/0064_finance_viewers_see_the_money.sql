-- A seat that may look at Finances sees the real numbers, and two figures in
-- the overview stop disagreeing with the screens beside them.
--
-- 1. A view-only seat saw $0 in every bank account and every home paid up.
--    0059 gave seats a second list, `views`, and moved the bank accounts and
--    the ledger to it. The statements stayed on the change right: charges,
--    payments, allocations, autopay runs, the balance view, and the question
--    association_overview asks before it returns other homes and account
--    balances. So a Secretary, who views Finances by default, got the bank
--    rows with no balances to go with them and a roster where every home but
--    her own read as current. A board member was told the bank was empty and
--    nobody was behind.
--
--    Those reads now ask can_view, which is true for a seat that may change
--    the area as well. An owner still reads their own home and nothing else:
--    the my_unit_ids() branch is kept in every one. Writes are untouched and
--    still ask has_capability.
--
-- 2. Lines waiting on review were in the overview's month sums. The account
--    balances already left them out, and so does every client total since
--    the 2026-10-04 audit; the month sums for the years before the loaded
--    window did not, so a duplicate from a bank feed could be counted twice.
--
-- 3. Late fees owed could exceed the balance. A home that owed $325 ($300
--    of dues and a $25 fee) and paid $310 read as "$15 past due, $25 of it
--    late fees". The fee figure is now capped at what the home owes. The
--    client walk in src/lib/metrics.ts (lateFeesOwed) has to apply the same
--    cap in the same deploy, or the demo and a real association disagree.
--
-- association_overview is copied whole from 0055 with those three changes
-- and nothing else; one file redefines it so two cannot undo each other.
-- Same signature, same shape of answer.

drop policy if exists charges_read on charges;
create policy charges_read on charges
  for select using (
    unit_id in (select my_unit_ids()) or can_view(association_id, 'finances')
  );

drop policy if exists payments_read on payments;
create policy payments_read on payments
  for select using (
    unit_id in (select my_unit_ids()) or can_view(association_id, 'finances')
  );

drop policy if exists allocations_read on payment_allocations;
create policy allocations_read on payment_allocations
  for select using (
    exists (
      select 1 from payments p
      where p.id = payment_id
        and (p.unit_id in (select my_unit_ids()) or can_view(p.association_id, 'finances'))
    )
  );

-- Still never writable from a browser: the cron is the only author.
drop policy if exists "autopay runs: own home or finances" on autopay_runs;
create policy "autopay runs: own home or finances"
  on autopay_runs for select
  using (
    unit_id in (select my_unit_ids())
    or can_view(association_id, 'finances')
  );

-- Replaced in place, not dropped: the columns are the same, and security
-- invoker has to be said again or the view would start answering as its
-- owner and show every balance to everyone. A row still exists only for a
-- home whose charges the caller may read, so nobody is shown a false zero
-- (0002).
create or replace view unit_balances with (security_invoker = true) as
  select
    u.id                                      as unit_id,
    u.association_id,
    coalesce(sum(c.amount_cents), 0)::integer as balance_cents
  from units u
  left join charges c on c.unit_id = u.id and c.due_on <= current_date
  where u.id in (select my_unit_ids())
     or can_view(u.association_id, 'finances')
  group by u.id, u.association_id;

create or replace function association_overview(p_association_id uuid, p_from date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start   text;
  v_fy_from date;
  v_finance boolean;
  v_units   uuid[];
begin
  if not is_member_of(p_association_id) then
    raise exception 'Not a member of this association' using errcode = '42501';
  end if;
  -- Seeing the money is the view right; changing it is still has_capability
  -- at every write. Until 0064 this asked for the change right, so a seat
  -- that could open Finances was handed its own home and no accounts.
  v_finance := can_view(p_association_id, 'finances');
  v_units := array(select my_unit_ids());

  select fiscal_year_start into v_start from associations where id = p_association_id;
  v_fy_from := make_date(
    extract(year from current_date)::int,
    split_part(coalesce(v_start, '01-01'), '-', 1)::int,
    split_part(coalesce(v_start, '01-01'), '-', 2)::int
  );
  if v_fy_from > current_date then
    v_fy_from := v_fy_from - interval '1 year';
  end if;

  return jsonb_build_object(
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'unit_id', u.id,
        'balance_cents', s.balance_cents,
        'line_count', s.line_count,
        'carried_cents', s.carried_cents,
        'oldest_open_due_on', o.due_on,
        -- Never more than the home owes. A home that paid most of a bill
        -- and its fee owes the remainder, not the whole fee again.
        'late_fees_owed_cents', case when s.balance_cents > 0 then least(f.cents, s.balance_cents) else 0 end
      ))
      from units u
      cross join lateral (
        select
          coalesce(sum(c.amount_cents) filter (where c.due_on <= current_date), 0)::bigint as balance_cents,
          count(*)::int as line_count,
          coalesce(sum(c.amount_cents) filter (where c.due_on < p_from), 0)::bigint as carried_cents
        from charges c
        where c.unit_id = u.id
      ) s
      left join lateral (
        select r.due_on
        from (
          select c.due_on,
                 coalesce(sum(c.amount_cents) over (
                   order by c.due_on desc, c.id
                   rows between unbounded preceding and 1 preceding
                 ), 0) as newer_cents
          from charges c
          where c.unit_id = u.id and c.kind = 'charge' and c.due_on <= current_date
        ) r
        where s.balance_cents - r.newer_cents > 0
        order by r.due_on asc
        limit 1
      ) o on true
      left join lateral (
        select coalesce(sum(r.amount_cents) filter (
                 where r.kind = 'charge' and r.label ~* 'late fee' and r.seq > z.last_zero
               ), 0)::bigint as cents
        from (
          select c.amount_cents, c.kind, c.label,
                 row_number() over w as seq,
                 sum(c.amount_cents) over w as running
          from charges c
          where c.unit_id = u.id
          window w as (order by c.due_on, c.created_at, c.id)
        ) r
        cross join (
          select coalesce(max(x.seq) filter (where x.running <= 0), 0) as last_zero
          from (
            select row_number() over w as seq, sum(c.amount_cents) over w as running
            from charges c
            where c.unit_id = u.id
            window w as (order by c.due_on, c.created_at, c.id)
          ) x
        ) z
      ) f on true
      where u.association_id = p_association_id
        and (v_finance or u.id = any (v_units))
    ), '[]'::jsonb),

    'ledger', case when v_finance then jsonb_build_object(
      'count', (select count(*) from ledger_entries e where e.association_id = p_association_id),
      'first_on', (select min(e.occurred_on) from ledger_entries e where e.association_id = p_association_id),
      'months', coalesce((
        select jsonb_agg(jsonb_build_object(
          'month', t.month, 'category', t.category,
          'in_cents', t.in_cents, 'out_cents', t.out_cents, 'count', t.n
        ) order by t.month, t.category)
        from (
          select to_char(e.occurred_on, 'YYYY-MM') as month,
                 e.category,
                 sum(greatest(e.amount_cents, 0))::bigint  as in_cents,
                 sum(greatest(-e.amount_cents, 0))::bigint as out_cents,
                 count(*)::int as n
          from ledger_entries e
          where e.association_id = p_association_id and e.occurred_on < p_from
            -- A line waiting on review is held out of every report until
            -- somebody confirms it, the same as the account balances below.
            and e.confirmed_at is not null
          group by 1, 2
        ) t
      ), '[]'::jsonb),
      'accounts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bank_account_id', b.id,
          'balance_cents', coalesce((
            select sum(e.amount_cents) from ledger_entries e
            where e.bank_account_id = b.id and e.confirmed_at is not null
          ), 0),
          'interest_ytd_cents', coalesce((
            select sum(e.amount_cents) from ledger_entries e
            where e.bank_account_id = b.id and e.confirmed_at is not null
              and e.category = 'Interest income' and e.amount_cents > 0
              and e.occurred_on >= v_fy_from
          ), 0)
        ))
        from bank_accounts b where b.association_id = p_association_id
      ), '[]'::jsonb)
    ) else jsonb_build_object(
      'count', 0, 'first_on', null, 'months', '[]'::jsonb, 'accounts', '[]'::jsonb
    ) end,

    'statements', jsonb_build_object(
      'months', coalesce((
        select jsonb_agg(jsonb_build_object(
          'month', t.month, 'kind', t.kind, 'cents', t.cents, 'count', t.n
        ) order by t.month, t.kind)
        from (
          select to_char(c.due_on, 'YYYY-MM') as month, c.kind,
                 sum(c.amount_cents)::bigint as cents, count(*)::int as n
          from charges c
          where c.association_id = p_association_id and c.due_on < p_from
            and (v_finance or c.unit_id = any (v_units))
          group by 1, 2
        ) t
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function association_overview(uuid, date) from public;
grant execute on function association_overview(uuid, date) to authenticated;
