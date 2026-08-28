-- The three situations the wizard actually asks about.
--
-- 0015 created association_origin with the values from before the product was
-- repositioned to new communities. The wizard has sent builder, handover and
-- existing since 2026-08-26, and Postgres refused every one of them, so no
-- association could be created while signed in: "invalid input value for
-- enum association_origin". The old values stay so nothing that holds one
-- breaks; nothing writes them any more.
alter type association_origin add value if not exists 'builder';
alter type association_origin add value if not exists 'handover';
alter type association_origin add value if not exists 'existing';
