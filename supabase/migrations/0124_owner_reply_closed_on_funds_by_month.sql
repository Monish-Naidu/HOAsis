-- Four small things the 2026-10-15 fixes needed from the database.
--
-- 1. An owner replies on their own request. The board replies through the
--    requests_decide policy; an owner could only open a new conversation,
--    so the reply never showed on the request. reply_on_request appends a
--    resident note to the thread of a request on a home the caller holds and
--    moves "info-needed" back to "in-review", because the board asked and
--    the owner answered.
--
-- 2. A ballot remembers the day it was closed. The board's closed row read
--    "Ended <scheduled date>" because nothing stored the real day; a trigger
--    stamps closed_on when status becomes closed, whichever path closes it.
--
-- 3. The owner's funds view says what dues came in each month. association_funds
--    (0041) leaves Assessments out of "recent" so no household is named, and
--    the owner's "In" read $0 all month after they had paid. assessments_by_month
--    gives the month's dues in and out with nobody named.
--
-- 4. A closed year's in and out match Transactions. write_fiscal_year (0109)
--    summed every ledger month, so an opening balance and a transfer into
--    reserves counted as money in; Transactions counts neither and nets
--    returned payments against Assessments. The stored figures follow the
--    same rule now, and the next close rewrites the row.

-- ------------------------------------------------- 1. the owner's reply

create or replace function reply_on_request(p_request_id uuid, p_body text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request requests%rowtype;
  v_body    text := btrim(coalesce(p_body, ''));
  v_name    text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to reply' using errcode = '42501';
  end if;
  if length(v_body) < 1 or length(v_body) > 4000 then
    raise exception 'Write a reply of up to 4,000 characters' using errcode = '22000';
  end if;

  select * into v_request from requests where id = p_request_id for update;
  if not found or v_request.unit_id is null
     or v_request.unit_id <> all (my_unit_ids()) then
    raise exception 'That request is not yours' using errcode = '42501';
  end if;
  if v_request.status in ('closed', 'denied') then
    raise exception 'That request is closed. Start a new one.' using errcode = '22000';
  end if;
  perform assert_association_writable(v_request.association_id);

  select m.full_name into v_name
    from memberships m
   where m.profile_id = auth.uid() and m.unit_id = v_request.unit_id and m.ends_on is null
   order by m.starts_on
   limit 1;

  update requests
     set thread = coalesce(thread, '[]'::jsonb) || jsonb_build_object(
           'id', 'rt-' || p_request_id::text || '-' || coalesce(jsonb_array_length(thread), 0)::text,
           'at', current_date::text,
           'actor', coalesce(v_name, 'Owner'),
           'actorRole', 'resident',
           'body', v_body,
           'kind', 'note'
         ),
         status = case when status = 'info-needed' then 'in-review'::request_status else status end
   where id = p_request_id;
  return true;
end;
$$;

revoke all on function reply_on_request(uuid, text) from public;
revoke execute on function reply_on_request(uuid, text) from anon;
grant execute on function reply_on_request(uuid, text) to authenticated;
grant execute on function reply_on_request(uuid, text) to service_role;

-- ---------------------------------------------- 2. the day a ballot closed

alter table ballots add column if not exists closed_on date;

create or replace function ballot_closed_on()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'closed' and (old.status is distinct from 'closed') and new.closed_on is null then
    new.closed_on := current_date;
  end if;
  return new;
end;
$$;

revoke all on function ballot_closed_on() from public;
revoke execute on function ballot_closed_on() from anon, authenticated;

drop trigger if exists ballot_closed_on on ballots;
create trigger ballot_closed_on
  before update of status on ballots
  for each row execute function ballot_closed_on();

-- ---------------------------------------- 3. dues by month for the owner

-- Copied whole from 0041: the member check, the visibility setting, the
-- fiscal year start, accounts, by_category and recent are as they were. The
-- one addition is assessments_by_month.
create or replace function association_funds(p_association_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visible boolean;
  v_fy_from date;
  v_start   text;
begin
  if not is_member_of(p_association_id) then
    raise exception 'Not a member of this association' using errcode = '42501';
  end if;

  select coalesce((settings ->> 'showFundsToResidents')::boolean, true), fiscal_year_start
    into v_visible, v_start
    from associations where id = p_association_id;
  if not v_visible then
    return null;
  end if;

  -- The start of the current fiscal year, from its MM-DD.
  v_fy_from := make_date(
    extract(year from current_date)::int,
    split_part(coalesce(v_start, '01-01'), '-', 1)::int,
    split_part(coalesce(v_start, '01-01'), '-', 2)::int
  );
  if v_fy_from > current_date then
    v_fy_from := v_fy_from - interval '1 year';
  end if;

  return jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'kind', b.kind,
        'institution', b.institution,
        'balance_cents', coalesce((
          select sum(e.amount_cents) from ledger_entries e
          where e.bank_account_id = b.id and e.confirmed_at is not null
        ), 0)
      ) order by b.kind, b.created_at)
      from bank_accounts b where b.association_id = p_association_id
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category', t.category,
        'in_cents', t.in_cents,
        'out_cents', t.out_cents
      ))
      from (
        select e.category,
               sum(greatest(e.amount_cents, 0))::bigint  as in_cents,
               sum(greatest(-e.amount_cents, 0))::bigint as out_cents
        from ledger_entries e
        where e.association_id = p_association_id
          and e.confirmed_at is not null
          and e.occurred_on >= v_fy_from
        group by e.category
      ) t
    ), '[]'::jsonb),
    'assessments_by_month', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', t.month,
        'in_cents', t.in_cents,
        'out_cents', t.out_cents
      ) order by t.month)
      from (
        select to_char(date_trunc('month', e.occurred_on), 'YYYY-MM') as month,
               sum(greatest(e.amount_cents, 0))::bigint  as in_cents,
               sum(greatest(-e.amount_cents, 0))::bigint as out_cents
        from ledger_entries e
        where e.association_id = p_association_id
          and e.confirmed_at is not null
          and e.occurred_on >= v_fy_from
          and e.category = 'Assessments'
        group by 1
      ) t
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r order by r.occurred_on desc)
      from (
        select e.id, e.occurred_on, e.description, e.counterparty, e.category,
               e.amount_cents, e.bank_account_id
        from ledger_entries e
        where e.association_id = p_association_id
          and e.confirmed_at is not null
          and e.category <> 'Assessments'
        order by e.occurred_on desc, e.id
        limit 12
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function association_funds(uuid) from public;
revoke execute on function association_funds(uuid) from anon;
grant execute on function association_funds(uuid) to authenticated;
grant execute on function association_funds(uuid) to service_role;

-- ------------------------------------- 4. a closed year's in and out

-- Copied whole from 0109: the shape of the row, accounts, categories, billed
-- and collected, and the upsert are as they were. in_cents and out_cents now
-- leave out the Opening balance and Reserve transfer categories and net
-- Assessments, which is the rule the Transactions screen applies.
create or replace function write_fiscal_year(p_association_id uuid, p_starts_on date, p_closed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_on date := (p_starts_on + interval '1 year' - interval '1 day')::date;
  v_row     fiscal_years%rowtype;
  v_in      bigint;
  v_out     bigint;
begin
  select
    coalesce(sum(case when t.category = 'Assessments' then greatest(t.net, 0) else t.in_cents end), 0),
    coalesce(sum(case when t.category = 'Assessments' then greatest(-t.net, 0) else t.out_cents end), 0)
    into v_in, v_out
  from (
    select m.category, sum(m.in_cents) as in_cents, sum(m.out_cents) as out_cents,
           sum(m.in_cents) - sum(m.out_cents) as net
    from ledger_months m
    where m.association_id = p_association_id and m.month >= p_starts_on and m.month <= v_ends_on
      and m.category not in ('Opening balance', 'Reserve transfer')
    group by m.category
  ) t;

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
    v_in,
    v_out,
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
