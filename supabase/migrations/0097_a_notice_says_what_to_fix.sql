-- A rule notice has a title and a "what needs fixing", not one text for both.
--
-- The notice form asked "What needs fixing" and stored the answer in `rule`,
-- the column every list shows as the title. A notice the board had just sent
-- was titled "Bring the bins in by Tuesday evening" beside older ones titled
-- "Trash bins". The rule is the title; what to do about it is its own text.
-- Nothing is backfilled: old rows keep their text in `rule`, which is what
-- the screens showed for them anyway.

alter table violations add column if not exists fix text not null default '';
