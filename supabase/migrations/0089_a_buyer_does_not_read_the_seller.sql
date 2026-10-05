-- A buyer does not read what the seller did while they owned the home.
--
-- A sale (transfer_home, 0081) ends every seat on the home and seats the buyer
-- from the closing date. The owner side of the read policies asked only
-- "do I hold a current seat on this home" (my_unit_ids, 0001), with no date. So
-- the day the buyer claimed the seat they could read the seller's requests and
-- the board's answers on them, the seller's private threads with the board,
-- how the seller voted, and the rule notices sent to the seller. That is the
-- seller's correspondence, not the home's.
--
-- Now an owner reads a home's requests, threads (the messages live inside the
-- thread row), votes and rule notices only from the day the home's current
-- owners took it over: the EARLIEST starts_on among the seats still open on the
-- home. A spouse added later (add_second_owner) therefore still sees the
-- household's whole history, while after a sale, with every old seat ended, the
-- date is the buyer's closing date. Compared by date, inclusive: a row dated on
-- the closing day itself is visible to the buyer (a sale on the same calendar
-- day cannot tell the seller's morning from the buyer's afternoon).
--
-- unit_owned_since(unit) returns that date, and only to a caller who holds one
-- of the open seats. Null cannot carry both meanings ("no seat" and "no lower
-- bound"), so it is never returned:
--   no open seat for the caller  -> 'infinity'   (no row is dated after it)
--   an open seat with no start   -> '-infinity'  (every row is dated after it)
-- starts_on is not null in the table today; the second case is belt and braces.
-- security definer, so a policy on one table can consult memberships without
-- recursing through memberships' own policy.
--
-- What does NOT change:
--   * Board side. Every policy keeps its capability branch exactly as written,
--     so anyone who reads through a capability or role sees everything as today.
--     Only the "because it is my home" branch gains the date test.
--   * Money. charges, payments, payment_allocations, unit_balances,
--     payment_instruments, autopay_runs and shared_cost_shares are untouched. A
--     home's ledger is continuous and its balance is summed from those rows
--     under the caller's own rights; hiding old lines would change what the
--     buyer owes.
--   * Writes. cast_votes (0076), start_owner_thread / reply_as_owner (0044),
--     requests_file (0077) and mark_violation_fixed (0029) are as they were.
--
-- Every owner-side read found (grep my_unit_ids, then the highest-numbered file
-- that creates or replaces each policy):
--
--   table              policy                   last defined   date column used            here
--   requests           requests_read            0005           submitted_on (date)         CHANGED
--                        (a request's thread and attachments are columns of
--                         the row, not separate tables)
--   threads            threads_read             0044           created_at, as a UTC date   CHANGED
--                        (messages are a jsonb column of the thread row)
--   votes              votes_read_own           0005           cast_at, as a UTC date      CHANGED
--                        (0067 dropped the insert and update policies; the
--                         only read policy is this one, and the board has none)
--   violations         violations_read          0018           opened_on (date)            CHANGED
--   violation_reports  violation_reports_read   0018           -                           left: read by the reporter's
--                        profile, not by home; the accused home never reaches it
--   email_log          email_log_read           0008           -                           left: read by profile_id
--   documents, meetings, ballots, ballot_options, posts, forms, amenities,
--   announcements      (their read policies)    various        -                           left: whole association,
--                        no home in the test
--   join_requests      join_requests_read       0029           -                           left: settings capability only
--   charges, payments, payment_allocations, unit_balances (view),
--   payment_instruments, autopay_runs, shared_cost_shares
--                                               0064/0033/0013 -                           left: money, see above
--   amenity bookings, form submissions: no such tables exist; nothing to do.
--
-- Owner reads that go through a security definer function or view instead of
-- a policy (policies do not apply inside them):
--   * ballot_tallies, ballot_turnout (0006): counts per choice and homes
--     voted, never a roll. Left; the seller's vote still counts for the home
--     until it is changed, and nobody reads who cast it.
--   * home_history (0012): the owners of a home with their dates, readable by
--     a current owner. Left on purpose: the register of who held the home is
--     the association's record, not a private conversation.
--   * cast_votes (0076) reads the home's existing receipt and replaces its
--     rows as the definer. Left as is, see the note on votes below.
--   * mark_violation_fixed and reply_as_owner write through my_unit_ids by
--     id. A buyer cannot learn the id of a row they can no longer read, so
--     they are left alone.
--
-- Votes: after this, a buyer's resident screen finds no vote row of its own
-- on a ballot the seller voted on, so it shows the ballot as not yet voted.
-- Casting works: cast_votes deletes the home's rows for other choices and
-- inserts the buyer's, and the key is (ballot_id, unit_id, option_id) since
-- 0042, with an on-conflict clause, so there is no unique violation. The
-- buyer's new rows are dated now and are visible to them. The one thing the
-- buyer carries over is the home's receipt string (VR-...), which cast_votes
-- reuses; it says nothing about how anybody voted.
--
-- Helper grants follow can_view (0059), which policies call for visitors too:
-- not public, but anon, authenticated and service_role.

-- Reviewed 2026-10-05: the lower bound applies only where somebody owned the
-- home before the current owners, that is, where a seat on it ended on or
-- before the day the earliest current seat began. A seat's starts_on defaults
-- to the day the row was made, so on a home that has never changed hands it
-- says when the owner was added here, not when their history begins; using it
-- there would hide an owner's own earlier rows (imported or seeded) from
-- them. A co-owner who was removed later ended after that day, so they are
-- not a previous household and bound nothing.
create or replace function unit_owned_since(p_unit_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from memberships m
       where m.unit_id = p_unit_id
         and m.profile_id = auth.uid()
         and m.ends_on is null
    )
    then 'infinity'::date
    else coalesce(
      (
        select s.since
          from (
            select min(m.starts_on) as since
              from memberships m
             where m.unit_id = p_unit_id
               and m.ends_on is null
          ) s
         where exists (
           select 1 from memberships e
            where e.unit_id = p_unit_id
              and e.ends_on is not null
              and e.ends_on <= s.since
         )
      ),
      '-infinity'::date
    )
  end;
$$;

revoke all on function unit_owned_since(uuid) from public;
grant execute on function unit_owned_since(uuid) to anon, authenticated, service_role;

-- requests: same expression as 0005, owner branch dated by submitted_on.
drop policy if exists requests_read on requests;
create policy requests_read on requests
  for select using (
    (unit_id in (select my_unit_ids()) and submitted_on >= unit_owned_since(unit_id))
    or has_capability(association_id, 'requests')
  );

-- threads: same three branches as 0044, owner branch dated by created_at.
drop policy if exists threads_read on threads;
create policy threads_read on threads
  for select using (
    (
      unit_id in (select my_unit_ids())
      and (created_at at time zone 'utc')::date >= unit_owned_since(unit_id)
    )
    or has_capability(association_id, 'communications')
    or (tag = 'Billing' and has_capability(association_id, 'finances'))
  );

-- votes: same expression as 0005, dated by cast_at.
drop policy if exists votes_read_own on votes;
create policy votes_read_own on votes
  for select using (
    unit_id in (select my_unit_ids())
    and (cast_at at time zone 'utc')::date >= unit_owned_since(unit_id)
  );

-- violations: same expression as 0018, owner branch dated by opened_on.
drop policy if exists violations_read on violations;
create policy violations_read on violations
  for select using (
    (unit_id in (select my_unit_ids()) and opened_on >= unit_owned_since(unit_id))
    or has_capability(association_id, 'compliance')
  );
