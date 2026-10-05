-- Deleting an association and changing your mind was a way never to pay,
-- and deleting one with a card on file left the card being charged.
--
-- cancel_association_deletion (0010) wrote subscription_status = 'active'
-- on the way back, whatever the association had been. A President in a
-- trial could ask for deletion, restore a minute later, and hold an
-- 'active' row with no subscription behind it. The billing sweep only
-- looks at 'trialing' and 'ended', so that association was never asked
-- for a card again. 0065 closed the same end state as a direct write;
-- this was the same thing by two buttons.
--
-- request_association_deletion (0010) wrote 'canceled' and never touched
-- Stripe, the mistake 0071 fixed for cancel_subscription: the row said
-- nothing was billed while the next invoice was paid.
--
-- So:
--
--   restoring goes back to wherever the association really is, by the same
--     three cases resume_subscription uses (0025): a subscription on file
--     is 'active', a trial with time left is 'trialing', anything else is
--     'ended'. It also only acts on an association that is waiting to be
--     deleted, so it cannot be used as a second way to restart billing;
--   asking for deletion is refused while billing_subscription_id is set,
--     with the reason. The board cancels on Stripe's billing page first,
--     customer.subscription.deleted clears the id, and then the delete
--     goes through. An association with no subscription deletes exactly
--     as before.
--
-- Same signatures, same grants. Both are security definer, so the guard on
-- the plumbing columns (0065) lets them through as it always has.

create or replace function request_association_deletion(
  p_association_id uuid,
  p_typed_name     text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not exists (
    select 1 from memberships
    where association_id = p_association_id
      and profile_id = auth.uid()
      and role = 'president'
      and ends_on is null
  ) then
    raise exception 'Only the President can delete an association' using errcode = '42501';
  end if;

  select name into v_name from associations where id = p_association_id;

  if lower(trim(coalesce(p_typed_name, ''))) <> lower(trim(v_name)) then
    raise exception 'The name did not match' using errcode = '22000';
  end if;

  -- A card is being billed. Only Stripe can stop that, and this row must
  -- not say cancelled until Stripe says so.
  if exists (
    select 1 from associations
     where id = p_association_id and billing_subscription_id is not null
  ) then
    raise exception 'This association has a subscription billed through Stripe. Cancel it on the billing page first so the card stops being charged.'
      using errcode = '22000';
  end if;

  update associations
     set deleted_at = now(),
         deletion_requested_by = auth.uid(),
         subscription_status = 'canceled',
         canceled_at = now()
   where id = p_association_id;

  return now() + interval '30 days';
end;
$$;

revoke all on function request_association_deletion(uuid, text) from public;
revoke execute on function request_association_deletion(uuid, text) from anon;
grant execute on function request_association_deletion(uuid, text) to authenticated;

/** Changing their mind, any time inside the window. */
create or replace function cancel_association_deletion(p_association_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from memberships
    where association_id = p_association_id
      and profile_id = auth.uid()
      and role = 'president'
      and ends_on is null
  ) then
    raise exception 'Only the President can restore an association' using errcode = '42501';
  end if;

  -- Back to where the association really is, not to a free 'active'. The
  -- subscription case is for a deletion asked for before this migration,
  -- when one could be asked for with a card still on file.
  update associations
     set deleted_at = null,
         deletion_requested_by = null,
         subscription_status = case
           when billing_subscription_id is not null then 'active'
           when trial_ends_at > now() then 'trialing'
           else 'ended'
         end,
         canceled_at = null
   where id = p_association_id
     and deleted_at is not null;
end;
$$;

revoke all on function cancel_association_deletion(uuid) from public;
revoke execute on function cancel_association_deletion(uuid) from anon;
grant execute on function cancel_association_deletion(uuid) to authenticated;
