-- Autopay tries again once the owner has fixed what failed.
--
-- 0033 made a month one row and one decision: charged, skipped or failed,
-- exactly once, so "a declined card is one failed row and one email, never a
-- daily drain on somebody's patience". That part stays. What it also meant
-- is that an owner whose card was declined on the 5th, and who put a new card
-- on file on the 6th, was not charged again until next month, went past due
-- in between, and under a late fee policy paid for it.
--
-- So a failed month may be tried again, but only when there is a reason to
-- expect a different answer: a payment method added since the last attempt,
-- or, when the failure was having nothing to charge, any method that can now
-- be charged. Never twice in one day and never more than three times in a
-- month. The rule itself is mayRetryAutopay in src/lib/payments/autopay.ts;
-- these two columns are what it needs to remember.

alter table autopay_runs
  add column if not exists attempts integer not null default 1,
  add column if not exists last_attempt_on date;

update autopay_runs
   set last_attempt_on = (created_at at time zone 'utc')::date
 where last_attempt_on is null;
