-- Two text columns that the screens read as a closed set, now held to it.
--
-- fiscal_year_start is MM-DD. One association carried a full date
-- (2026-01-01), association_funds built "2026-2026-01" from it, and every
-- owner of that association saw $0 in every fund.
--
-- payouts.status is one of four steps. One row said "pending", which the
-- Vendors page had no badge for, and the page did not load for anybody.

update associations
   set fiscal_year_start = right(fiscal_year_start, 5)
 where fiscal_year_start ~ '^\d{4}-\d{2}-\d{2}$';

update associations
   set fiscal_year_start = '01-01'
 where fiscal_year_start !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';

alter table associations
  add constraint associations_fiscal_year_start_mm_dd
  check (fiscal_year_start ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');

update payouts
   set status = case
     when jsonb_array_length(coalesce(approvals, '[]'::jsonb)) >= approvals_required then 'scheduled'
     else 'needs-approval'
   end
 where status not in ('needs-approval', 'scheduled', 'in-transit', 'paid');

alter table payouts
  add constraint payouts_status_known
  check (status in ('needs-approval', 'scheduled', 'in-transit', 'paid'));
