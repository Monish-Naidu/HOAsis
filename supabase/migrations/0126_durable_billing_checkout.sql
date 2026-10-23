-- Adding a card could be pressed twice, by two officers, or retried after a
-- timeout, and each press made a fresh Stripe customer and Checkout session.
--
-- billing_operations is the one durable record of "this association is adding
-- its card". begin_billing_operation reserves it under the association's row
-- lock, so concurrent officers receive the same operation, and the operation
-- carries everything a retry must not change: the mode (a subscription
-- Checkout, or a setup Checkout when the trial is nearly over), the quantity
-- and exact trial end, the customer name and email, the return origin, and
-- the idempotency keys Stripe is called with. A retried request replays with
-- identical parameters; Stripe answers with the object the first attempt
-- made, and a recovered caller reconciles what is already there before
-- making anything new.
--
-- Only the service role runs it: the browser reaches it through
-- /api/billing/checkout, which has already checked has_capability('settings').

create table public.billing_operations (
  id uuid primary key,
  association_id uuid not null references public.associations(id) on delete cascade,
  -- open: a checkout is usable or being made. completed: the webhook or the
  --   reconciler saw it through. superseded: an expired session was replaced.
  status text not null default 'open' check (status in ('open', 'completed', 'superseded')),
  mode text not null check (mode in ('subscription', 'setup')),
  quantity integer not null check (quantity >= 1),
  -- The promised trial end, unix seconds. Null when the trial had already
  -- ended when the operation was reserved: billing starts at once.
  trial_end_ts bigint,
  customer_name text not null,
  customer_email text,
  return_origin text not null,
  customer_id text,
  customer_key text not null,
  session_id text,
  session_key text not null,
  subscription_id text,
  subscription_key text not null,
  created_at timestamptz not null default now()
);

-- One operation a board can still use. History may hold any number of
-- completed or superseded ones.
create unique index billing_operations_one_open
  on public.billing_operations (association_id)
  where status = 'open';

alter table public.billing_operations enable row level security;
revoke all on public.billing_operations from anon, authenticated;
grant select, insert, update on public.billing_operations to service_role;

-- Reserve the association's billing operation, or hand back the one already
-- open. The association row lock serializes two officers pressing at once:
-- the second waits, then sees the first's operation and returns it unchanged.
create or replace function begin_billing_operation(
  p_association_id uuid,
  p_quantity integer,
  p_trial_end_ts bigint,
  p_mode text,
  p_customer_name text,
  p_customer_email text,
  p_return_origin text
)
returns public.billing_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.billing_operations;
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Billing operations are opened by the server only' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 or p_mode not in ('subscription', 'setup') then
    raise exception 'A billing operation needs at least one home and a known mode'
      using errcode = '22000';
  end if;

  perform 1 from public.associations where id = p_association_id for update;
  if not found then
    raise exception 'No such association' using errcode = 'P0002';
  end if;

  select * into v_op
    from public.billing_operations
   where association_id = p_association_id and status = 'open';
  if found then return v_op; end if;

  v_id := gen_random_uuid();
  insert into public.billing_operations (
    id, association_id, mode, quantity, trial_end_ts,
    customer_name, customer_email, return_origin,
    customer_key, session_key, subscription_key
  ) values (
    v_id, p_association_id, p_mode, p_quantity, p_trial_end_ts,
    p_customer_name, p_customer_email, p_return_origin,
    'bill-cus-' || v_id, 'bill-sess-' || v_id, 'bill-sub-' || v_id
  ) returning * into v_op;
  return v_op;
end;
$$;

revoke all on function begin_billing_operation(uuid, integer, bigint, text, text, text, text) from public;
revoke execute on function begin_billing_operation(uuid, integer, bigint, text, text, text, text) from anon;
revoke execute on function begin_billing_operation(uuid, integer, bigint, text, text, text, text) from authenticated;
grant execute on function begin_billing_operation(uuid, integer, bigint, text, text, text, text) to service_role;
