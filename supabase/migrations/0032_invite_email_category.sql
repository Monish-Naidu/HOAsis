-- 0032: the invitation and the "you're in" note are email too, and every
-- message the association sends is logged under a category. Optional, so an
-- owner can stop them like any other non-statutory mail.
alter type email_category add value if not exists 'invite';
