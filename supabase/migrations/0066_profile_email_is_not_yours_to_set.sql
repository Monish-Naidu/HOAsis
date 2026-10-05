-- A person could change the email on their own profile, and two functions
-- seat people by it.
--
-- profiles_update_self (0001) lets somebody update their own row with no
-- limit on the columns. add_household and import_households fill an
-- unclaimed seat by matching profiles.email against the address the board
-- invited. So a resident could read a neighbour's invited address off the
-- roster, write it onto their own profile, and wait: the next time the
-- board imported the roster or added that household, the resident's
-- profile was seated at the neighbour's home, with its statement, its vote
-- and its autopay. claim_my_seats (0035) already matches on the address
-- Supabase Auth verified and never on anything the browser sends; this
-- closes the same door on the column the other two read.
--
-- The email on a profile is written by the signup trigger from auth.users
-- and by nothing else. The browser's only write to this table is
-- home_association_id (the association switcher). A person may also change
-- their own name and phone. Everything else, the email and the id
-- included, is now refused for a signed-in browser. The server's service
-- role is untouched.
--
-- A later screen that lets somebody edit another profile column needs that
-- column added to the grant below, or the save fails with "permission
-- denied".

revoke update on profiles from anon, authenticated;
grant update (full_name, phone, home_association_id) on profiles to authenticated;
