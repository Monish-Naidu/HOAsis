-- A billing webhook that could not write used to answer Stripe "received"
-- anyway: the update's error came back in the result, nobody looked at it,
-- and the provider moved on. The association row then disagreed with Stripe
-- until something else happened to fix it. And every event was applied as
-- its snapshot arrived, so a delayed deletion for a subscription the board
-- had already replaced could cancel the replacement.
--
-- These two functions are the webhook's only writes. Both run as the
-- service role, both take the association's row lock so simultaneous
-- deliveries serialize, and both decide under that lock whether the event
-- is about the association's canonical subscription: the one its newest
-- billing operation (0126) produced, or what the row already believes. An
-- event about anything else is acknowledged as history and changes nothing,
-- so arrival order and event timestamps can never move billing backwards.
--
-- The route checks every result and answers 500 on a database error, so a
-- failed write is retried rather than lost. The writes themselves are
-- idempotent: a replayed delivery sets the same columns to the same values.

-- Apply a subscription's current state to its association. Returns:
--   applied              the row now describes this subscription
--   stale-subscription   the event is about a replaced subscription; skipped
--   customer-mismatch    the subscription's customer is not the association's
--   no-such-association  the metadata named an association that is not there
create or replace function public.apply_billing_subscription(
  p_association_id uuid,
  p_subscription_id text,
  p_customer_id text,
  p_status text,
  p_brand text,
  p_last4 text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc public.associations;
  v_canonical text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Billing webhooks are applied by the server only' using errcode = '42501';
  end if;
  if p_status not in ('trialing', 'active', 'past_due', 'canceled', 'ended') then
    raise exception 'Unknown subscription status: %', p_status using errcode = '22000';
  end if;

  -- The row lock serializes concurrent deliveries for this association.
  select * into v_assoc from public.associations where id = p_association_id for update;
  if not found then
    return 'no-such-association';
  end if;

  -- A customer, once recorded, cannot change hands: an event naming this
  -- association but another customer is not this association's billing.
  if v_assoc.billing_customer_id is not null
     and v_assoc.billing_customer_id <> p_customer_id then
    return 'customer-mismatch';
  end if;

  -- The canonical subscription is the one the association's newest billing
  -- operation produced; before any operation has one, it is what the row
  -- already believes. An event about any other subscription is history: a
  -- replaced card's late deletion must not cancel its replacement.
  select o.subscription_id into v_canonical
    from public.billing_operations o
   where o.association_id = p_association_id
     and o.subscription_id is not null
     and o.status <> 'superseded'
   order by o.created_at desc, o.id desc
   limit 1;
  v_canonical := coalesce(v_canonical, v_assoc.billing_subscription_id);
  if v_canonical is not null and v_canonical <> p_subscription_id then
    return 'stale-subscription';
  end if;

  update public.associations set
    billing_subscription_id = case when p_status = 'canceled' then null else p_subscription_id end,
    billing_customer_id = p_customer_id,
    billing_brand = case when p_status = 'canceled' then null else p_brand end,
    billing_last4 = case when p_status = 'canceled' then null else p_last4 end,
    subscription_status = p_status,
    -- The first failure's date stands until a payment clears it; the lock
    -- counts from it (0105).
    past_due_since = case when p_status = 'past_due' then past_due_since else null end,
    canceled_at = case when p_status = 'canceled' then coalesce(canceled_at, now()) else canceled_at end
  where id = p_association_id;
  return 'applied';
end;
$$;

revoke all on function public.apply_billing_subscription(uuid, text, text, text, text, text) from public;
revoke execute on function public.apply_billing_subscription(uuid, text, text, text, text, text) from anon;
revoke execute on function public.apply_billing_subscription(uuid, text, text, text, text, text) from authenticated;
grant execute on function public.apply_billing_subscription(uuid, text, text, text, text, text) to service_role;

-- Apply an invoice's outcome to the association that owns its customer.
-- Returns:
--   applied              the row now reflects the outcome
--   stale-subscription   the invoice belongs to a replaced subscription
--   no-subscription      a paid invoice for an association with no card on
--                        file; nothing to reactivate
--   unknown-customer     no association bills this customer
create or replace function public.apply_billing_invoice(
  p_customer_id text,
  p_subscription_id text,
  p_outcome text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc public.associations;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Billing webhooks are applied by the server only' using errcode = '42501';
  end if;
  if p_outcome not in ('paid', 'failed') then
    raise exception 'Unknown invoice outcome: %', p_outcome using errcode = '22000';
  end if;

  select * into v_assoc from public.associations
   where billing_customer_id = p_customer_id
   limit 1
   for update;
  if not found then
    return 'unknown-customer';
  end if;

  -- The invoice belongs to the subscription the association is billed on
  -- now, or it is history: a replaced subscription's late failure must not
  -- mark its replacement past due.
  if p_subscription_id is not null
     and v_assoc.billing_subscription_id is distinct from p_subscription_id then
    return 'stale-subscription';
  end if;

  if p_outcome = 'failed' then
    -- The day the card first failed decides the lock; a second failure
    -- while already past due must not restart the count.
    update public.associations set
      subscription_status = 'past_due',
      past_due_since = coalesce(past_due_since, now())
    where id = v_assoc.id;
    return 'applied';
  end if;

  if v_assoc.billing_subscription_id is null then
    return 'no-subscription';
  end if;
  update public.associations set
    subscription_status = 'active',
    past_due_since = null
  where id = v_assoc.id;
  return 'applied';
end;
$$;

revoke all on function public.apply_billing_invoice(text, text, text) from public;
revoke execute on function public.apply_billing_invoice(text, text, text) from anon;
revoke execute on function public.apply_billing_invoice(text, text, text) from authenticated;
grant execute on function public.apply_billing_invoice(text, text, text) to service_role;
