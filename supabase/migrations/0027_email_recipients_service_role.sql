-- The recipient list, when the server asks for it.
--
-- email_recipients gated on has_capability(), which reads auth.uid(). The
-- dues mailer runs on the server with the service role, which has no user,
-- so the function answered with nobody and every dues run "sent" zero
-- emails while reporting success. The API route already refuses callers
-- without the communications capability before it gets here, so the
-- service role is trusted to have done that check.

create or replace function email_recipients(
  p_association_id uuid,
  p_category       email_category,
  p_only_past_due  boolean default false
)
returns table (
  profile_id uuid,
  unit_id    uuid,
  unit_label text,
  full_name  text,
  email      text,
  balance_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.profile_id,
    m.unit_id,
    u.label,
    m.full_name,
    coalesce(p.email, m.invited_email) as email,
    coalesce(b.balance_cents, 0)
  from memberships m
  join units u on u.id = m.unit_id
  left join profiles p on p.id = m.profile_id
  left join unit_balances b on b.unit_id = m.unit_id
  where m.association_id = p_association_id
    and m.ends_on is null
    and (auth.role() = 'service_role' or has_capability(p_association_id, 'communications'))
    and coalesce(p.email, m.invited_email) is not null
    and not exists (
      select 1 from email_optouts o
      where o.profile_id = m.profile_id and o.category = p_category
    )
    and (not p_only_past_due or coalesce(b.balance_cents, 0) > 0);
$$;
