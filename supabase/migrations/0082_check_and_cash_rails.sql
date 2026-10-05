-- Two ways an owner pays that were missing from the rail list.
--
-- payment_rail knew ach, card, apple-pay and google-pay, all of them paths
-- through Stripe. A check handed to the treasurer or cash at the clubhouse has
-- no rail, so the only thing a board could do with one was leave the home past
-- due. 0083 adds the function that records them; the two values go in on their
-- own here because a new enum value cannot be used in the transaction that
-- adds it.

alter type payment_rail add value if not exists 'check';
alter type payment_rail add value if not exists 'cash';
