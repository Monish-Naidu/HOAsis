-- The roles and schemas Supabase's own Postgres image creates at birth, and
-- that every migration in supabase/migrations/ takes for granted. Run as the
-- administrator (postgres) before the restore; safe to run twice.
--
-- :services_password is the one password the three services sign in with,
-- as in Supabase's own docker-compose. It lives in Key Vault.

do $$
begin
  -- The data API roles. anon and authenticated are what a request becomes;
  -- service_role is the server key and bypasses row level security, which
  -- Flexible Server allows a non-superuser to grant from Postgres 16 on.
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  -- PostgREST signs in as authenticator and switches to one of the three.
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
  -- GoTrue and the storage service own their schemas and run their own migrations.
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login noinherit createrole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
    create role supabase_storage_admin login noinherit createrole;
  end if;
  -- Roles the dump mentions in grants and default privileges. They own
  -- nothing here and cannot sign in; they exist so the restore does not trip.
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'dashboard_user') then
    create role dashboard_user nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_read_only_user') then
    create role supabase_read_only_user nologin;
  end if;
end $$;

alter role authenticator password :'services_password';
alter role supabase_auth_admin password :'services_password';
alter role supabase_storage_admin password :'services_password';

grant anon, authenticated, service_role to authenticator;
-- The administrator must be a member to reassign ownership after the restore.
grant anon, authenticated, service_role, authenticator, supabase_auth_admin, supabase_storage_admin,
  supabase_admin, dashboard_user, supabase_read_only_user to postgres;

-- Hosted Supabase gives anonymous requests three seconds and signed-in ones eight.
alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';
alter role service_role set statement_timeout = '8s';

-- Supabase keeps extensions out of public; the migrations and PostgREST find
-- them through the search path.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
grant execute on all functions in schema extensions to anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
alter database postgres set search_path = public, extensions;
alter role authenticator set search_path = public, extensions;
alter role supabase_auth_admin set search_path = auth, extensions;
alter role supabase_storage_admin set search_path = storage, extensions;

create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists storage authorization supabase_storage_admin;
create schema if not exists supabase_migrations;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
