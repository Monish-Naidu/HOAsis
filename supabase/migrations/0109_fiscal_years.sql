-- 0109: the fiscal year closes, and a closed year stops moving.
--
-- Step 2 of docs/financial-reporting.md. A board reads "last year" in
-- March and again in June and the two must agree. Until now every figure
-- was recomputed from the rows each time; a late-dated correction moved a
-- year that the accountant already had.
--
-- fiscal_years holds one row per association per year once the year has
-- ended: opening and closing balance per account, money in and out by
-- category, what was billed and what was collected, who closed it and
-- when. The figures are copied from the rollups (0108) at the close, and
-- a closed year is read from this row, not recomputed.
--
-- Closing is the platform's job, not a chore: close_ended_fiscal_years()
-- runs from the daily ops job and closes every year that ended before
-- today and has no row yet. A board that needs to post into a closed year
-- reopens it with a reason (reopen_fiscal_year, finances capability,
-- logged), posts, and the job closes it again next morning with the new
-- figures; both closes and the reopen are in the activity log.
--
-- The year is the association's fiscal year (fiscal_year_start, 'MM-DD').
-- Years before the association's first money row are not closed: there is
-- nothing to say about them.

create table if not exists fiscal_years (
  association_id   uuid not null references associations (id) on delete cascade,
  starts_on        date not null,
  ends_on          date not null,
  -- Balance per account at the start and at the end of the year.
  -- [{bank_account_id, opening_cents, closing_cents}]
  accounts         jsonb not null default '[]'::jsonb,
  -- Money in and out by ledger category. [{category, in_cents, out_cents}]
  categories       jsonb not null default '[]'::jsonb,
  in_cents         bigint not null default 0,
  out_cents        bigint not null default 0,
  -- From the statements: what every home was billed and what came in.
  billed_cents     bigint not null default 0,
  collected_cents  bigint not null default 0,
  closed_at        timestamptz not null default now(),
  closed_by        uuid references profiles (id) on delete set null,
  -- Set while the year is open for a correction; cleared by the next close.
  reopened_at      timestamptz,
  reopened_by      uuid references profiles (id) on delete set null,
  reopen_reason    text,
  primary key (association_id, starts_on)
);

alter table fiscal_years enable row level security;

drop policy if exists "finance viewers read fiscal years" on fiscal_years;
create policy "finance viewers read fiscal years" on fiscal_years
  for select to authenticated
  using (can_view(association_id, 'finances'));

grant select on fiscal_years to authenticated;
grant select on fiscal_years to service_role;

-- The first day of the fiscal year that contains p_day.
create or replace function fiscal_year_start_for(p_association_id uuid, p_day date)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start text;
  v_from  date;
begin
  select fiscal_year_start into v_start from associations where id = p_association_id;
  v_from := make_date(
    extract(year from p_day)::int,
    split_part(coalesce(v_start, '01-01'), '-', 1)::int,
    split_part(coalesce(v_start, '01-01'), '-', 2)::int
  );
  if v_from > p_day then
    v_from := (v_from - interval '1 year')::date;
  end if;
  return v_from;
end;
$$;

revoke all on function fiscal_year_start_for(uuid, date) from public;
grant execute on function fiscal_year_start_for(uuid, date) to authenticated, service_role;

-- Writes or rewrites the row for one year from the rollups. Internal: the
-- two callers below check who is asking and whether the year has ended.
create or replace function write_fiscal_year(p_association_id uuid, p_starts_on date, p_closed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_on date := (p_starts_on + interval '1 year' - interval '1 day')::date;
  v_row     fiscal_years%rowtype;
begin
  select
    p_association_id, p_starts_on, v_ends_on,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'bank_account_id', b.id,
        'opening_cents', coalesce((select sum(m.in_cents - m.out_cents) from ledger_months m
          where m.bank_account_id = b.id and m.month < p_starts_on), 0),
        'closing_cents', coalesce((select sum(m.in_cents - m.out_cents) from ledger_months m
          where m.bank_account_id = b.id and m.month <= v_ends_on), 0)
      ) order by b.created_at)
      from bank_accounts b where b.association_id = p_association_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('category', t.category, 'in_cents', t.in_cents, 'out_cents', t.out_cents) order by t.category)
      from (
        select m.category, sum(m.in_cents) as in_cents, sum(m.out_cents) as out_cents
        from ledger_months m
        where m.association_id = p_association_id and m.month >= p_starts_on and m.month <= v_ends_on
        group by m.category
      ) t
    ), '[]'::jsonb),
    coalesce((select sum(m.in_cents) from ledger_months m
      where m.association_id = p_association_id and m.month >= p_starts_on and m.month <= v_ends_on), 0),
    coalesce((select sum(m.out_cents) from ledger_months m
      where m.association_id = p_association_id and m.month >= p_starts_on and m.month <= v_ends_on), 0),
    coalesce((select sum(m.cents) from statement_months m
      where m.association_id = p_association_id and m.month >= p_starts_on and m.month <= v_ends_on and m.kind = 'charge'), 0),
    coalesce((select -sum(m.cents) from statement_months m
      where m.association_id = p_association_id and m.month >= p_starts_on and m.month <= v_ends_on and m.kind = 'payment'), 0),
    now(), p_closed_by, null, null, null
  into v_row.association_id, v_row.starts_on, v_row.ends_on, v_row.accounts, v_row.categories,
       v_row.in_cents, v_row.out_cents, v_row.billed_cents, v_row.collected_cents,
       v_row.closed_at, v_row.closed_by, v_row.reopened_at, v_row.reopened_by, v_row.reopen_reason;

  insert into fiscal_years select v_row.*
  on conflict (association_id, starts_on) do update set
    ends_on = excluded.ends_on, accounts = excluded.accounts, categories = excluded.categories,
    in_cents = excluded.in_cents, out_cents = excluded.out_cents,
    billed_cents = excluded.billed_cents, collected_cents = excluded.collected_cents,
    closed_at = excluded.closed_at, closed_by = excluded.closed_by,
    reopened_at = null, reopened_by = null, reopen_reason = null;

  perform record_activity(p_association_id, 'fiscal_year', null,
    'Closed the fiscal year that began ' || to_char(p_starts_on, 'FMMonth FMDD, YYYY'),
    jsonb_build_object('starts_on', p_starts_on, 'ends_on', v_ends_on,
      'in_cents', v_row.in_cents, 'out_cents', v_row.out_cents));
end;
$$;

revoke all on function write_fiscal_year(uuid, date, uuid) from public;

-- The daily job. Every association, every fiscal year that has ended, is
-- not closed (or was reopened), and has money in it. Returns how many it
-- closed.
create or replace function close_ended_fiscal_years()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the platform closes years' using errcode = '42501';
  end if;

  for r in
    select a.id as association_id, y.starts_on
    from associations a
    cross join lateral (
      -- From the year of the first money row to the last year that ended.
      select (fiscal_year_start_for(a.id, f.first_on) + (n || ' years')::interval)::date as starts_on
      from (
        select least(
          (select min(m.month) from ledger_months m where m.association_id = a.id),
          (select min(m.month) from statement_months m where m.association_id = a.id)
        ) as first_on
      ) f
      cross join generate_series(0, 50) n
      where f.first_on is not null
    ) y
    where (y.starts_on + interval '1 year')::date <= current_date
      and not exists (
        select 1 from fiscal_years fy
        where fy.association_id = a.id and fy.starts_on = y.starts_on and fy.reopened_at is null
      )
    order by a.id, y.starts_on
  loop
    perform write_fiscal_year(r.association_id, r.starts_on, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function close_ended_fiscal_years() from public;
grant execute on function close_ended_fiscal_years() to service_role;

-- A board member with the finances capability reopens a closed year to
-- post a correction. The row stays, marked reopened, until the job closes
-- it again with the corrected figures.
create or replace function reopen_fiscal_year(p_association_id uuid, p_starts_on date, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_capability(p_association_id, 'finances') then
    raise exception 'You cannot reopen a year for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(p_association_id);
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why the year is being reopened' using errcode = '22023';
  end if;
  if not exists (select 1 from fiscal_years where association_id = p_association_id and starts_on = p_starts_on) then
    raise exception 'That year is not closed' using errcode = 'P0002';
  end if;

  update fiscal_years
     set reopened_at = now(), reopened_by = auth.uid(), reopen_reason = trim(p_reason)
   where association_id = p_association_id and starts_on = p_starts_on;

  perform record_activity(p_association_id, 'fiscal_year', null,
    'Reopened the fiscal year that began ' || to_char(p_starts_on, 'FMMonth FMDD, YYYY'),
    jsonb_build_object('starts_on', p_starts_on, 'reason', trim(p_reason)));
end;
$$;

revoke all on function reopen_fiscal_year(uuid, date, text) from public;
grant execute on function reopen_fiscal_year(uuid, date, text) to authenticated;

-- A board member closes a reopened year by hand rather than waiting for
-- the morning, so the corrected figures are there when the meeting is.
create or replace function close_fiscal_year(p_association_id uuid, p_starts_on date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_capability(p_association_id, 'finances') then
    raise exception 'You cannot close a year for that association' using errcode = '42501';
  end if;
  perform assert_association_writable(p_association_id);
  if (p_starts_on + interval '1 year')::date > current_date then
    raise exception 'That year has not ended yet' using errcode = '22023';
  end if;
  if p_starts_on <> fiscal_year_start_for(p_association_id, p_starts_on) then
    raise exception 'That is not the first day of a fiscal year' using errcode = '22023';
  end if;
  perform write_fiscal_year(p_association_id, p_starts_on, auth.uid());
end;
$$;

revoke all on function close_fiscal_year(uuid, date) from public;
grant execute on function close_fiscal_year(uuid, date) to authenticated;
