-- Empties the target so a rehearsal can run again. Only the migrate job runs
-- this, only with RESET=1, and only against the Azure server: the source
-- connection is never passed to it.
drop schema if exists public cascade;
drop schema if exists auth cascade;
drop schema if exists storage cascade;
drop schema if exists supabase_migrations cascade;
create schema public;
grant usage on schema public to public;
