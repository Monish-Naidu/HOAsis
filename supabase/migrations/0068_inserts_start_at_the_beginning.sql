-- Three insert policies trusted the browser to say how far along a record
-- already was.
--
-- requests_file (0005) checked the home and nothing else, so an owner could
-- file a request that arrived approved, with a decision, a name under it
-- and a certificate number. The resident's page showed the certificate, the
-- board's list showed it approved, and the activity record, which watches
-- status changes, never saw one. posts_write (0005) let any member insert a
-- post already published and pinned under an officer's title, skipping the
-- moderator. violation_reports_file (0018) let a report arrive verified.
--
-- Each now requires a new row to be new:
--
--   a request is filed by the caller, for a home of theirs, in that home's
--     association, as 'submitted', with no decision, certificate or work
--     order on it;
--   a post from somebody who holds no office waits as 'pending', unpinned,
--     with no likes, no moderator and no office under the name. An officer's
--     post may be published straight away, because the forum publishes for
--     every board role today (forum-board.tsx) and a Treasurer has no forum
--     capability to ask for instead;
--   a report arrives as 'new', unverified and attached to no notice.
--
-- These match what the app sends today, so nothing a real screen does is
-- refused. The update policies are untouched: deciding, moderating and
-- verifying still belong to whoever holds the capability.

drop policy if exists requests_file on requests;
create policy requests_file on requests
  for insert with check (
    unit_id in (select my_unit_ids())
    and association_id = (select u.association_id from units u where u.id = unit_id)
    and filed_by = auth.uid()
    and status = 'submitted'
    and decided_on is null
    and decided_by is null
    and decided_note is null
    and certificate_id is null
    and work_order is null
  );

drop policy if exists posts_write on posts;
create policy posts_write on posts
  for insert with check (
    is_member_of(association_id)
    and author_id = auth.uid()
    and (
      is_board_of(association_id)
      or (
        status = 'pending'
        and not pinned
        and likes = 0
        and moderated_by is null
        and moderated_at is null
        and author_role is null
      )
    )
  );

drop policy if exists violation_reports_file on violation_reports;
create policy violation_reports_file on violation_reports
  for insert with check (
    is_member_of(association_id)
    and reporter_profile_id = auth.uid()
    and status = 'new'
    and verified_by is null
    and verified_on is null
    and verification_note is null
    and dismissed_reason is null
    and violation_id is null
  );
