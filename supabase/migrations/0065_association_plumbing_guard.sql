-- A settings holder could rewrite the columns that say who is paid and
-- whether the association pays us.
--
-- associations_write (0001) lets anyone with the settings capability update
-- their association's row, and it has never said which columns. The browser
-- needs most of them: the name, the dues, the fees, the settings blob. It
-- has no business with the rest, and the rest were open all the same. From
-- the console a President could set trial_ends_at to 2099 and
-- subscription_status to 'active' and never be billed, or point
-- stripe_account_id at another connected account so every owner's dues
-- landed in the wrong bank while the books said paid. deleted_at skipped
-- the President-only deletion function, and slug could be set to a
-- reserved word.
--
-- A trigger now refuses a change to those columns when the statement comes
-- straight from a signed-in browser. It is a list of what is closed rather
-- than column grants of what is open, on purpose: the browser writes some
-- twenty columns from four places, and a grant missed for one of them
-- would fail a whole Settings save.
--
-- It asks current_user, not auth.role(). Inside cancel_subscription,
-- resume_subscription and the two deletion functions current_user is the
-- function's owner, so they keep working; auth.role() would still say
-- 'authenticated' there and break all four. The server's routes use the
-- service role and are untouched.
--
-- A column added later that the browser must not write belongs on this
-- list.

create or replace function associations_guard_plumbing()
returns trigger
language plpgsql
-- Security invoker on purpose: current_user has to be the role that ran the
-- update, which is the whole test.
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.stripe_account_id        is distinct from old.stripe_account_id
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payout_bank     is distinct from old.stripe_payout_bank
     or new.stripe_payout_last4    is distinct from old.stripe_payout_last4
     or new.billing_customer_id    is distinct from old.billing_customer_id
     or new.billing_subscription_id is distinct from old.billing_subscription_id
     or new.billing_brand          is distinct from old.billing_brand
     or new.billing_last4          is distinct from old.billing_last4
     or new.billing_email          is distinct from old.billing_email
     or new.billing_notices        is distinct from old.billing_notices
     or new.subscription_status    is distinct from old.subscription_status
     or new.trial_ends_at          is distinct from old.trial_ends_at
     or new.past_due_since         is distinct from old.past_due_since
     or new.canceled_at            is distinct from old.canceled_at
     or new.cancel_reason          is distinct from old.cancel_reason
     or new.software_fee_cents_per_home is distinct from old.software_fee_cents_per_home
     or new.deleted_at             is distinct from old.deleted_at
     or new.deletion_requested_by  is distinct from old.deletion_requested_by
     or new.join_code              is distinct from old.join_code
     or new.slug                   is distinct from old.slug
     or new.created_at             is distinct from old.created_at
  then
    raise exception 'That part of the association is not changed from here'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Runs before associations_slug (triggers fire in name order), so a slug a
-- browser sends is refused as sent, before anything tidies it.
drop trigger if exists associations_plumbing on associations;
create trigger associations_plumbing
  before update on associations
  for each row execute function associations_guard_plumbing();
