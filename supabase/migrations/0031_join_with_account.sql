-- 0031: joining with a code means creating an account in the community.
--
-- Before this, /join took a code and a name and put a row in the board's
-- queue, and the person was told an email would follow. Nothing followed:
-- they still had to find /signin, create an account with the same address,
-- and hope. Now the join screen creates the account and the request in one
-- go, and the front door needs one more answer for somebody who is signed
-- in but belongs to nothing yet: is the board looking at their request?

-- What the signed in person has asked for. Matched on the address they
-- signed up with, because that is what request_to_join recorded and what
-- add_household will match when the board says yes.
create or replace function my_join_requests()
returns table (
  association_id uuid,
  name           text,
  city           text,
  state          text,
  unit_label     text,
  status         text,
  created_at     timestamptz,
  decided_on     date
)
language sql
stable
security definer
set search_path = public
as $$
  select j.association_id, a.name, a.city, a.state, j.unit_label, j.status, j.created_at, j.decided_on
    from join_requests j
    join associations a on a.id = j.association_id
   where lower(j.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and a.deleted_at is null
   order by j.created_at desc;
$$;

revoke all on function my_join_requests() from public;
grant execute on function my_join_requests() to authenticated;

-- The board reads a request to send the "you're in" email from the server.
-- Nothing new is granted: settings holders could already read these rows.
-- Kept as a comment so the next reader does not go looking for a policy.
