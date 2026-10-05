-- A member could write votes straight into the table, for every option and
-- into a ballot that had closed.
--
-- votes_cast and votes_change (0005) let an owner insert or update a vote
-- row for their own home while "the ballot" was open, and nothing tied the
-- option to that ballot. When 0042 widened the key to one row per option, a
-- home could insert a row for each choice on a one-seat ballot and count
-- once for all of them. Worse, a row naming any open ballot and an option
-- from a closed or certified one passed the policy, and the tally, which
-- counts by option, added it to the certified result. The receipt was
-- whatever the caller typed.
--
-- cast_votes (0042) checks the seat count, that each choice is on the
-- ballot, and that the ballot is open, and writes the receipt itself. It is
-- security definer, and it is the only way the app has ever voted, so the
-- two policies go and nothing replaces them. Reading your own vote
-- (votes_read_own) stays. With no insert, update or delete policy left, row
-- level security refuses every direct write from a browser.

drop policy if exists votes_cast on votes;
drop policy if exists votes_change on votes;
