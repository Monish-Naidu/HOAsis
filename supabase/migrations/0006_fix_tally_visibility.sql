-- A tally nobody can count is not a tally.
--
-- votes carries the right rule for individual rows: you may read your own and
-- nobody else's, so the secretary cannot see how a neighbor voted. The tally
-- view inherited that rule through security_invoker and therefore counted only
-- the rows the caller could see, which for everyone except the voter is none.
-- Every ballot read zero.
--
-- Counting and disclosing are different acts. The count is a fact the whole
-- association is entitled to; who cast which vote is not. So the view runs as
-- its owner, with full sight of the rows, and is filtered to associations the
-- caller actually belongs to. Members get real numbers, outsiders get nothing,
-- and no individual vote is exposed by either.

drop view if exists ballot_tallies;

create view ballot_tallies as
  select
    o.ballot_id,
    o.id                      as option_id,
    o.label,
    count(v.unit_id)::integer as votes
  from ballot_options o
  join ballots b on b.id = o.ballot_id
  left join votes v on v.option_id = o.id
  where is_member_of(b.association_id)
  group by o.ballot_id, o.id, o.label;

-- How many homes have voted, for quorum. Same reasoning: a count, not a roll.
create view ballot_turnout as
  select
    b.id                              as ballot_id,
    b.association_id,
    count(distinct v.unit_id)::integer as homes_voted,
    b.quorum_required
  from ballots b
  left join votes v on v.ballot_id = b.id
  where is_member_of(b.association_id)
  group by b.id, b.association_id, b.quorum_required;
