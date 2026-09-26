-- The figures a screen needs, summed where the rows live.
--
-- Ten years of a forty home association is 9,800 statement lines and 5,300
-- ledger lines, and every screen pulled all of them into the browser to add
-- them up (60 REST calls, six seconds before the first number). The screens
-- only ever need three things from the old rows: each home's standing, the
-- ledger by month and category, and each bank account's balance. This
-- function returns those, and the app loads the rows themselves for the
-- recent months only, fetching earlier ones when a screen asks.
--
-- Security invoker on purpose: every table read here is scoped by the same
-- row level security the screens rely on, so a resident gets their own home
-- and no ledger, and a treasurer gets the books, from one function that
-- never branches on who is asking. Units are listed only where the caller
-- may read the charges, as unit_balances does, so no home reads $0 for want
-- of permission.
--
-- p_from is the first day the app loads rows for. Months before it are
-- summed here; the home's balance carried into that day lets the statement
-- run its balance forward from there and still agree with the view.

create or replace function association_overview(p_association_id uuid, p_from date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_start   text;
  v_fy_from date;
begin
  select fiscal_year_start into v_start from associations where id = p_association_id;

  -- The start of the current fiscal year, from its MM-DD, as association_funds reads it.
  v_fy_from := make_date(
    extract(year from current_date)::int,
    split_part(coalesce(v_start, '01-01'), '-', 1)::int,
    split_part(coalesce(v_start, '01-01'), '-', 2)::int
  );
  if v_fy_from > current_date then
    v_fy_from := v_fy_from - interval '1 year';
  end if;

  return jsonb_build_object(
    -- Each home the caller may read: what it owes, how many lines its
    -- statement holds, the balance carried into the loaded window, the charge
    -- the past-due clock runs from, and the late fees inside what it owes.
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'unit_id', u.id,
        'balance_cents', s.balance_cents,
        'line_count', s.line_count,
        'carried_cents', s.carried_cents,
        'oldest_open_due_on', o.due_on,
        'late_fees_owed_cents', case when s.balance_cents > 0 then f.cents else 0 end
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
      -- Money is applied oldest first, so what is still owed is the newest
      -- charges whose amounts add up to the balance; the oldest of those is
      -- the one the clock runs from.
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
      -- Late fees since the statement last stood at zero.
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
        and (u.id in (select my_unit_ids()) or has_capability(u.association_id, 'finances'))
    ), '[]'::jsonb),

    -- The ledger before the window, one row per month and category, with
    -- money in and money out kept apart so a month's flows sum exactly as
    -- they would from the lines. Every line counts, confirmed or not, as the
    -- screens count them.
    'ledger', jsonb_build_object(
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
          group by 1, 2
        ) t
      ), '[]'::jsonb),
      -- What the books say is in each account: confirmed lines, all time.
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
    ),

    -- Statements before the window, one row per month and kind across every
    -- home the caller may read, for dues billed against dues paid by month.
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
          group by 1, 2
        ) t
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function association_overview(uuid, date) from public;
grant execute on function association_overview(uuid, date) to authenticated;

-- The per-unit walks above read one home's charges in due order.
create index if not exists charges_unit_kind_due_idx on charges (unit_id, kind, due_on);
