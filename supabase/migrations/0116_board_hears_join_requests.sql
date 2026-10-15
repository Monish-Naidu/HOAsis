-- 0116: the board hears when somebody asks to join.
--
-- The join code put a request in front of the board (0029), and the Homeowners
-- screen shows it, but nobody was told: a request that arrived between two
-- board visits sat unseen. Now every officer who can manage homeowners (the
-- settings capability, the same one "Let them in" asks) gets one email per
-- request, with a link to Homeowners.
--
-- Once per request, by the row itself. A retry or a second submit is absorbed
-- by request_to_join, and the browser asks for the notice again either way, so
-- the send is claimed in the database: board_notified_at is set by one update
-- guarded on being null, and only the call that set it sends anything. Two
-- submits at once, two serverless instances, one email.
--
-- The email is logged to email_log under 'join', a category for mail that
-- goes to the board about who is at the door. It is not statutory (an owner
-- may never be told to opt out of it because no owner receives it), so
-- is_statutory says no and the opt-out table refuses a row for it as before.

alter table join_requests
  add column if not exists board_notified_at timestamptz;

alter type email_category add value if not exists 'join';

-- No new function and no new grant: the notice is sent by the server route
-- through the service role, which owns the claim and the log rows. The
-- existing join_requests policies already keep the column to the settings
-- holders who can act on a request, and email_log is written by the service
-- role as it is for every send.
