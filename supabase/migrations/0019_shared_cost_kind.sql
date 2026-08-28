-- A shared cost knows what kind of bill it is and what the provider measures.
--
-- Both were in the domain type and on the screen from the start and never had
-- a column, so a real association could not say "water, in gallons".
alter table shared_costs
  add column if not exists kind       text not null default 'other',
  add column if not exists usage_unit text not null default '';
