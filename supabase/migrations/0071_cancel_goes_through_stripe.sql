-- "Cancel the subscription" could say billing had stopped while Stripe went
-- on charging the card.
--
-- cancel_subscription (0010) only writes subscription_status = 'canceled'
-- on the association. For an association still in its trial that is the
-- whole truth: there is no card and nothing to stop. For one with a
-- subscription on file it was not. The Stripe subscription was never
-- touched, so the next month's invoice was paid, the webhook wrote 'active'
-- again, and a board that had been shown "Cancelled. Nothing is billed" was
-- billed indefinitely.
--
-- The function now refuses when billing_subscription_id is set, so the
-- column cannot say cancelled while Stripe says otherwise, from the button
-- or from the console. The cancel for those associations is made on
-- Stripe's billing page (/api/billing/portal); customer.subscription.deleted
-- then writes 'canceled' and clears the id, as it always has.
--
-- Everything else is as it was in 0010: same signature, same grants, and an
-- association with no subscription cancels exactly as before.

create or replace function cancel_subscription(
  p_association_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_capability(p_association_id, 'settings') then
    raise exception 'You do not have the settings capability' using errcode = '42501';
  end if;

  -- A card is being billed. Only Stripe can stop that, and this column must
  -- not claim it has been stopped until Stripe says so.
  if exists (
    select 1 from associations
     where id = p_association_id and billing_subscription_id is not null
  ) then
    raise exception 'This subscription is billed through Stripe. Cancel it on the billing page so the card stops being charged.'
      using errcode = '22000';
  end if;

  update associations
     set subscription_status = 'canceled',
         canceled_at = now(),
         cancel_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_association_id;
end;
$$;

revoke all on function cancel_subscription(uuid, text) from public;
revoke execute on function cancel_subscription(uuid, text) from anon;
grant execute on function cancel_subscription(uuid, text) to authenticated;
