-- The balance view reported a number nobody was entitled to compute.
--
-- With security_invoker the view applied both policies, but they disagree in
-- scope: a member can read every `unit` in their association while they can
-- read `charges` only for their own home. Left joining the two produced a row
-- per neighboring unit with the charges silently filtered out, so a resident
-- saw "unit 2: $0.00" for a home that actually owed sixty dollars.
--
-- A missing row is a gap the caller can see. A zero is a lie they cannot.
--
-- The fix states the charge visibility rule directly, so the view returns rows
-- only for homes whose charges the caller may actually read, and still reports
-- a genuine zero for a home that has simply never been billed.

drop view if exists unit_balances;

create view unit_balances with (security_invoker = true) as
  select
    u.id                                      as unit_id,
    u.association_id,
    coalesce(sum(c.amount_cents), 0)::integer as balance_cents
  from units u
  left join charges c on c.unit_id = u.id and c.due_on <= current_date
  where u.id in (select my_unit_ids())
     or has_capability(u.association_id, 'finances')
  group by u.id, u.association_id;
