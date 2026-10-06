-- A board can turn off the bill that goes out by email the day it posts.
--
-- The daily email job (/api/email/bills) mails every owner their dues the day
-- the bill posts. A board moving over mid month, or one that sends bills some
-- other way, may not want the first automatic one. This column is the switch,
-- on by default, so a new association gets the bill emailed without being
-- asked and an existing one starts getting it tomorrow unless it turns it off
-- in Settings.
--
-- Nothing else is needed for access. associations_write (0001) lets a seat
-- with the settings capability update its association's row, and the
-- plumbing guard (0065) is a list of columns that are closed, not a list of
-- columns that are open, so this one is writable from Settings the same way
-- contact_email is (0098). A resident has no write policy on the row at all.

alter table associations add column if not exists bills_by_email boolean not null default true;
