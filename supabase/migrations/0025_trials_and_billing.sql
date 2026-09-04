-- The ninety days, and what comes after them.
--
-- The front page has promised "90 days free, no card to start" since August,
-- and nothing in the database knew when anyone's ninety days began. Every
-- association sat at subscription_status = 'active' forever, which is a
-- price of zero with extra steps.
--
-- The rules:
--   a new association is 'trialing' and its trial ends ninety days after it
--     was created; the date is a column, not arithmetic in a component, so a
--     support conversation can extend it by editing one field
--   the platform subscription (what the association pays us) is a separate
--     thing from the connected account (how residents pay the association),
--     so it gets its own columns rather than overloading stripe_account_id
--   the daily sweep is the only thing that moves 'trialing' to 'ended', and
--     Stripe's webhook is the only thing that moves anything to 'active'
--   cancelling still stops billing and changes nothing else

alter table associations
  add column if not exists trial_ends_at            timestamptz,
  add column if not exists billing_customer_id      text,
  add column if not exists billing_subscription_id  text,
  add column if not exists billing_brand            text,
  add column if not exists billing_last4            text,
  add column if not exists billing_email            text,
  add column if not exists past_due_since           timestamptz,
  -- Which trial notices have gone out ('14-days', '3-days', 'ended'), so a
  -- sweep that runs twice in a day sends nothing twice.
  add column if not exists billing_notices          text[] not null default '{}';

comment on column associations.trial_ends_at is
  'When the free period ends. Ninety days from founding by default; editable by hand for a board that asked for longer.';
comment on column associations.billing_customer_id is
  'Our Stripe customer for this association, on the platform account. Not the connected account residents pay into.';
comment on column associations.billing_subscription_id is
  'The Stripe subscription that bills software_fee_cents_per_home per home per month.';

-- Everyone already here started their clock when they were founded.
update associations
   set trial_ends_at = created_at + interval '90 days'
 where trial_ends_at is null;

alter table associations
  alter column trial_ends_at set default (now() + interval '90 days'),
  alter column trial_ends_at set not null;

-- 'active' meant nothing before today. An association with no subscription
-- is trialing, or past the trial with nothing on file.
update associations
   set subscription_status = case
     when billing_subscription_id is not null then 'active'
     when trial_ends_at > now() then 'trialing'
     else 'ended'
   end
 where subscription_status = 'active';

alter table associations
  alter column subscription_status set default 'trialing';

alter table associations
  drop constraint if exists associations_subscription_status_check;
alter table associations
  add constraint associations_subscription_status_check
  check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'ended'));

-- Resuming after a cancel goes back to wherever the association actually is,
-- not to a free 'active'.
create or replace function resume_subscription(p_association_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_capability(p_association_id, 'settings') then
    raise exception 'You do not have the settings capability' using errcode = '42501';
  end if;

  update associations
     set subscription_status = case
           when billing_subscription_id is not null then 'active'
           when trial_ends_at > now() then 'trialing'
           else 'ended'
         end,
         canceled_at = null,
         cancel_reason = null
   where id = p_association_id;
end;
$$;

-- ------------------------------------------------------------ isolation audit

/**
 * Every table in the public schema that row level security does not cover.
 *
 * Isolation between associations is a property of the policies, and a table
 * added without one leaks every row to every signed in person. This is the
 * check that catches it. Callable by the service role only: the answer is
 * useful to an audit script and to nobody else.
 */
create or replace function tables_without_rls()
returns table (table_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity
   order by 1;
$$;

revoke all on function tables_without_rls from public;
revoke all on function tables_without_rls from authenticated;
revoke all on function tables_without_rls from anon;

-- Trial notices are logged like every other email, under their own category.
-- Not statutory: is_statutory lists the statutory ones by name and this is
-- not among them, but there is no opt out either, because the association
-- asked to be told when its free period ends.
alter type email_category add value if not exists 'billing';
