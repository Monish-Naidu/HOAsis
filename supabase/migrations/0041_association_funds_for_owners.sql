-- What an owner may know about the association's money.
--
-- The resident funds page read bank accounts and the ledger, and both are
-- readable only by finance holders, so every owner of a real association saw
-- $0 in operating and $0 in reserves. Opening those tables to members is not
-- the fix: a payment's ledger line names the household that paid, and nobody
-- sees a neighbour's account.
--
-- So one function answers for members, only while the board shows funds to
-- residents: each account's balance, what each category has come to this
-- fiscal year, and the most recent spending. Owners' own payments are left
-- out of the list by category; the totals still include them.

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
grant execute on function association_funds(uuid) to authenticated;
