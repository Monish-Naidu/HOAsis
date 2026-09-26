-- Two more things the association emails, each logged under its own name.
--
-- A board reply on a message thread, a note from the roster, and a change
-- on a request used to land on the resident's screen and nowhere else. Both
-- are about the person's own conversation, not about money or governance,
-- so an owner may switch them off and is_statutory stays as it was.
--
-- Dues letters written in the product keep going out under 'delinquency',
-- which is statutory and cannot be declined.

alter type email_category add value if not exists 'message';
alter type email_category add value if not exists 'request';
