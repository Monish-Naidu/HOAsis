-- Saved payment methods live on a Stripe Customer, and a Customer exists per
-- connected account, so the natural home is the unit: one home, one
-- association, one customer. The payment-method id itself rides in
-- payment_instruments.detail with the rest of the per-kind fields, in the
-- `token` slot the type has reserved for a processor token all along.
alter table units add column if not exists stripe_customer_id text;
