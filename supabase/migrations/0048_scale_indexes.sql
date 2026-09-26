-- Indexes for the reads the app actually makes.
--
-- Every screen loads one association's rows filtered by association_id, and
-- most of those tables had no index on it at all: at forty homes Postgres
-- scans the table faster than it would read an index, so nothing noticed.
-- At five hundred homes and ten years of ledger, with a few hundred
-- associations sharing the tables, every query on every page becomes a
-- scan of everyone else's rows. Row level security makes it worse, because
-- has_capability and my_unit_ids run per row and both hit memberships.
--
-- Ordering columns match the order clauses in src/lib/data/remote.ts so the
-- index serves the sort as well as the filter. Additive, idempotent.

-- The two lookups behind every RLS policy.
create index if not exists memberships_profile_idx
  on memberships (profile_id) where ends_on is null;
create index if not exists memberships_invited_email_idx
  on memberships (lower(invited_email)) where ends_on is null and profile_id is null;

-- The register.
create index if not exists units_association_idx on units (association_id, label);
create index if not exists bank_accounts_association_idx on bank_accounts (association_id);

-- Money. charges already has (association_id, unit_id, due_on); the autopay
-- run and the balance view start from the unit instead.
create index if not exists charges_unit_due_idx on charges (unit_id, due_on);
create index if not exists payments_association_state_idx
  on payments (association_id, state, created_at desc);
create index if not exists payments_unit_idx on payments (unit_id, created_at desc);
create index if not exists payment_allocations_charge_idx on payment_allocations (charge_id);
create index if not exists ledger_entries_association_date_id_idx
  on ledger_entries (association_id, occurred_on desc, id);
create index if not exists ledger_entries_bank_idx on ledger_entries (bank_account_id);
create index if not exists payouts_association_issued_idx
  on payouts (association_id, issued_on desc, id);
create index if not exists payment_instruments_association_idx
  on payment_instruments (association_id, added_on);
create index if not exists autopay_runs_association_month_idx
  on autopay_runs (association_id, month);

-- Shared costs and special assessments.
create index if not exists special_assessments_association_idx
  on special_assessments (association_id);
create index if not exists shared_costs_association_idx on shared_costs (association_id);
create index if not exists shared_cost_shares_unit_idx on shared_cost_shares (unit_id);

-- Community life.
create index if not exists requests_association_submitted_idx
  on requests (association_id, submitted_on desc);
create index if not exists requests_unit_idx on requests (unit_id);
create index if not exists documents_association_updated_idx
  on documents (association_id, updated_on desc);
create index if not exists meetings_association_held_idx on meetings (association_id, held_on);
create index if not exists ballots_association_closes_idx on ballots (association_id, closes_on);
create index if not exists ballot_options_ballot_idx on ballot_options (ballot_id, position);
create index if not exists votes_option_idx on votes (option_id);
create index if not exists posts_association_created_idx
  on posts (association_id, created_at desc);
create index if not exists post_likes_post_idx on post_likes (post_id);
create index if not exists vendors_association_idx on vendors (association_id);
create index if not exists amenities_association_idx on amenities (association_id);
create index if not exists violation_reports_association_idx
  on violation_reports (association_id, submitted_on desc);
create index if not exists violations_association_opened_idx
  on violations (association_id, opened_on desc);
create index if not exists violations_unit_idx on violations (unit_id);
create index if not exists threads_association_updated_idx
  on threads (association_id, updated_on desc, id);
create index if not exists threads_unit_idx on threads (unit_id);
create index if not exists governing_articles_association_idx
  on governing_articles (association_id, position);
create index if not exists budget_lines_association_idx on budget_lines (association_id, position);
create index if not exists reserve_components_association_idx
  on reserve_components (association_id);
create index if not exists message_templates_association_idx
  on message_templates (association_id);
create index if not exists forms_association_idx on forms (association_id, updated_on);

-- The crons. Each one walks associations in id order with a cursor.
create index if not exists associations_live_idx
  on associations (id) where deleted_at is null;
create index if not exists associations_trial_idx
  on associations (subscription_status)
  where deleted_at is null and billing_subscription_id is null;
create index if not exists memberships_autopay_idx
  on memberships (association_id, id) where ends_on is null and autopay is not null;
