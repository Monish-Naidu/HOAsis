-- 0108: monthly rollups, so the overview reads sums instead of summing rows.
--
-- association_overview (0064) summed every ledger line and every statement
-- line of the association on every load. Fine at eighty homes and two
-- years; the first query to slow down at ten years, and the one every
-- report in docs/financial-reporting.md is built on. Append-only money
-- (0106) makes a running sum safe to keep: a line is written once, and a
-- correction is another line.
--
-- Two tables, one row per month and key:
--   ledger_months     association, month, bank account, category:
--                     money in, money out, line count. Confirmed lines only,
--                     the same rule the overview and the account balances
--                     already apply.
--   statement_months  association, home, month, kind: cents and line count.
--                     Kept per home so an owner's view and a home's history
--                     come from the same rows as the board's.
--
-- Maintained by one trigger on each table, after insert, update and delete:
-- the old row's share comes out, the new row's goes in. Update and delete
-- are refused to people by 0106, but the service role, a migration and the
-- "on delete set null" of a bank account still change rows, and the sums
-- have to follow them. A row whose count reaches zero is removed.
--
-- The trigger functions run as their owner: the person writing a charge
-- has no policy on the rollup tables and needs none.
--
-- association_overview is copied whole from 0064 with its two month lists
-- read from these tables. The client sees the same shape.
--
-- Nothing is deleted or rewritten; the rollups are built from the rows that
-- exist and kept from here on.

-- ---------------------------------------------------------------- tables

drop table if exists ledger_months;
create table ledger_months (
  association_id  uuid not null references associations (id) on delete cascade,
  month           date not null,
  -- Null is a line no account claims (the account was deleted). Not a
  -- foreign key: the line's own column follows the account, and the
  -- trigger moves the sum when it does.
  bank_account_id uuid,
  category        text not null,
  in_cents        bigint not null default 0,
  out_cents       bigint not null default 0,
  line_count      integer not null default 0,
  check (month = date_trunc('month', month)::date)
);

create unique index ledger_months_key
  on ledger_months (association_id, month, coalesce(bank_account_id, '00000000-0000-0000-0000-000000000000'::uuid), category);

drop table if exists statement_months;
create table statement_months (
  association_id uuid not null references associations (id) on delete cascade,
  unit_id        uuid not null,
  month          date not null,
  kind           charge_kind not null,
  cents          bigint not null default 0,
  line_count     integer not null default 0,
  primary key (association_id, unit_id, month, kind),
  check (month = date_trunc('month', month)::date)
);

alter table ledger_months enable row level security;
alter table statement_months enable row level security;

-- Readable by the same people as the lines they sum. Nobody writes them by
-- hand: no insert, update or delete policy exists.
drop policy if exists "finance viewers read ledger months" on ledger_months;
create policy "finance viewers read ledger months" on ledger_months
  for select to authenticated
  using (can_view(association_id, 'finances'));

drop policy if exists "a home or a finance viewer reads statement months" on statement_months;
create policy "a home or a finance viewer reads statement months" on statement_months
  for select to authenticated
  using (can_view(association_id, 'finances') or unit_id in (select my_unit_ids()));

grant select on ledger_months, statement_months to authenticated;
grant select on ledger_months, statement_months to service_role;

-- -------------------------------------------------------------- triggers

create or replace function bump_ledger_month(
  p_association_id uuid, p_on date, p_bank_account_id uuid, p_category text,
  p_in bigint, p_out bigint, p_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_on)::date;
  v_hit   integer;
begin
  update ledger_months
     set in_cents = in_cents + p_in, out_cents = out_cents + p_out, line_count = line_count + p_count
   where association_id = p_association_id and month = v_month and category = p_category
     and bank_account_id is not distinct from p_bank_account_id;
  get diagnostics v_hit = row_count;

  -- A line going in makes the row; a line coming out never does, so a
  -- cascade that is deleting the association does not write it back.
  if v_hit = 0 and p_count > 0 then
    insert into ledger_months (association_id, month, bank_account_id, category, in_cents, out_cents, line_count)
    values (p_association_id, v_month, p_bank_account_id, p_category, p_in, p_out, p_count);
  end if;

  delete from ledger_months
  where association_id = p_association_id and month = v_month and category = p_category
    and bank_account_id is not distinct from p_bank_account_id
    and line_count <= 0;
end;
$$;

create or replace function bump_statement_month(
  p_association_id uuid, p_unit_id uuid, p_on date, p_kind charge_kind, p_cents bigint, p_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_on)::date;
  v_hit   integer;
begin
  update statement_months
     set cents = cents + p_cents, line_count = line_count + p_count
   where association_id = p_association_id and unit_id = p_unit_id and month = v_month and kind = p_kind;
  get diagnostics v_hit = row_count;

  if v_hit = 0 and p_count > 0 then
    insert into statement_months (association_id, unit_id, month, kind, cents, line_count)
    values (p_association_id, p_unit_id, v_month, p_kind, p_cents, p_count);
  end if;

  delete from statement_months
  where association_id = p_association_id and unit_id = p_unit_id and month = v_month and kind = p_kind
    and line_count <= 0;
end;
$$;

revoke all on function bump_ledger_month(uuid, date, uuid, text, bigint, bigint, integer) from public;
revoke all on function bump_statement_month(uuid, uuid, date, charge_kind, bigint, integer) from public;

create or replace function roll_ledger_month()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A line waiting on review is in no sum until it is confirmed; confirming
  -- it is an update, and that update is the moment it goes in.
  if tg_op in ('UPDATE', 'DELETE') and old.confirmed_at is not null then
    perform bump_ledger_month(old.association_id, old.occurred_on, old.bank_account_id, old.category,
      -greatest(old.amount_cents, 0)::bigint, -greatest(-old.amount_cents, 0)::bigint, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.confirmed_at is not null then
    perform bump_ledger_month(new.association_id, new.occurred_on, new.bank_account_id, new.category,
      greatest(new.amount_cents, 0)::bigint, greatest(-new.amount_cents, 0)::bigint, 1);
  end if;
  return null;
end;
$$;

create or replace function roll_statement_month()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform bump_statement_month(old.association_id, old.unit_id, old.due_on, old.kind, -old.amount_cents::bigint, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform bump_statement_month(new.association_id, new.unit_id, new.due_on, new.kind, new.amount_cents::bigint, 1);
  end if;
  return null;
end;
$$;

drop trigger if exists roll_ledger_month on ledger_entries;
create trigger roll_ledger_month
  after insert or update or delete on ledger_entries
  for each row execute function roll_ledger_month();

drop trigger if exists roll_statement_month on charges;
create trigger roll_statement_month
  after insert or update or delete on charges
  for each row execute function roll_statement_month();

-- --------------------------------------------------------------- backfill

insert into ledger_months (association_id, month, bank_account_id, category, in_cents, out_cents, line_count)
select e.association_id, date_trunc('month', e.occurred_on)::date, e.bank_account_id, e.category,
       sum(greatest(e.amount_cents, 0)), sum(greatest(-e.amount_cents, 0)), count(*)
from ledger_entries e
where e.confirmed_at is not null
group by 1, 2, 3, 4;

insert into statement_months (association_id, unit_id, month, kind, cents, line_count)
select c.association_id, c.unit_id, date_trunc('month', c.due_on)::date, c.kind,
       sum(c.amount_cents), count(*)
from charges c
group by 1, 2, 3, 4;

-- --------------------------------------------- the overview reads the sums

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
  v_from    date := date_trunc('month', p_from)::date;
begin
  if not is_member_of(p_association_id) then
    raise exception 'Not a member of this association' using errcode = '42501';
  end if;
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
      -- The months before the window the client loads, from the rollup.
      -- p_from is the first of a month (the client sends one); a day in the
      -- middle would put that month's earlier lines in both places, so it
      -- is rounded down here as well.
      'months', coalesce((
        select jsonb_agg(jsonb_build_object(
          'month', t.month, 'category', t.category,
          'in_cents', t.in_cents, 'out_cents', t.out_cents, 'count', t.n
        ) order by t.month, t.category)
        from (
          select to_char(m.month, 'YYYY-MM') as month, m.category,
                 sum(m.in_cents)::bigint as in_cents, sum(m.out_cents)::bigint as out_cents,
                 sum(m.line_count)::int as n
          from ledger_months m
          where m.association_id = p_association_id and m.month < v_from
          group by 1, 2
        ) t
      ), '[]'::jsonb),
      'accounts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bank_account_id', b.id,
          'balance_cents', coalesce((
            select sum(m.in_cents - m.out_cents) from ledger_months m
            where m.association_id = p_association_id and m.bank_account_id = b.id
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
          select to_char(m.month, 'YYYY-MM') as month, m.kind,
                 sum(m.cents)::bigint as cents, sum(m.line_count)::int as n
          from statement_months m
          where m.association_id = p_association_id and m.month < v_from
            and (v_finance or m.unit_id = any (v_units))
          group by 1, 2
        ) t
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function association_overview(uuid, date) from public;
grant execute on function association_overview(uuid, date) to authenticated;
