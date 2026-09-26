-- association_overview, scoped once instead of once per row.
--
-- As a security invoker function it took two and a half seconds for the
-- treasurer of a ten year association: the charges policy calls
-- has_capability for every row it reads, and the summaries read every row
-- four times over. Security definer, with the same two questions the policy
-- asks answered once at the top, brings it under a quarter of a second. The
-- scope is stated in the where clauses, exactly as charges_read states it:
-- a finance holder sees every home, anyone else their own.

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
  v_finance := has_capability(p_association_id, 'finances');
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
