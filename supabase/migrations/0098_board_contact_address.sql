-- The association has an address owners can write back to.
--
-- Every email to an owner is sent from one shared address, and some of them
-- said "reply to this email". A reply went nowhere. The board now sets a
-- contact address in Settings, and the emails carry it as their reply-to.
-- While it is blank the emails say not to reply.
--
-- Nothing else is needed for access. associations_write (0001) lets a seat
-- with the settings capability update its association's row, and the
-- plumbing guard (0065) is a list of columns that are closed, not a list of
-- columns that are open, so a new column is writable from Settings the same
-- way name and insurance_carrier are. Owners can already read the row, which
-- is how the address reaches a resident's screen if one ever needs it.
-- Existing associations get a blank address, so nothing changes for them
-- until the board fills it in.

alter table associations add column if not exists contact_email text not null default '';
