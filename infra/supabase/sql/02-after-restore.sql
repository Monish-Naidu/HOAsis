-- After pg_restore --no-owner everything belongs to postgres. Hand the auth
-- and storage schemas back to the services that run their migrations there,
-- and make sure the API roles can reach what the dump granted them.

alter schema auth owner to supabase_auth_admin;
alter schema storage owner to supabase_storage_admin;

do $$
declare obj record;
begin
  for obj in
    select n.nspname as s, c.relname as name, c.relkind as kind,
           case n.nspname when 'auth' then 'supabase_auth_admin' else 'supabase_storage_admin' end as owner
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('auth', 'storage') and c.relkind in ('r', 'p', 'v', 'm', 'S')
  loop
    execute format('alter %s %I.%I owner to %I',
      case obj.kind when 'S' then 'sequence' when 'v' then 'view' when 'm' then 'materialized view' else 'table' end,
      obj.s, obj.name, obj.owner);
  end loop;
  for obj in
    select n.nspname as s, p.oid::regprocedure as sig, p.prokind as kind,
           case n.nspname when 'auth' then 'supabase_auth_admin' else 'supabase_storage_admin' end as owner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('auth', 'storage')
  loop
    execute format('alter %s %s owner to %I', case obj.kind when 'p' then 'procedure' else 'function' end, obj.sig, obj.owner);
  end loop;
  for obj in
    select n.nspname as s, t.typname as name,
           case n.nspname when 'auth' then 'supabase_auth_admin' else 'supabase_storage_admin' end as owner
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname in ('auth', 'storage') and t.typtype in ('e', 'c', 'd') and t.typrelid = 0
  loop
    execute format('alter type %I.%I owner to %I', obj.s, obj.name, obj.owner);
  end loop;
end $$;

-- What the API roles need in auth and storage, whatever the dump carried.
grant usage on schema auth, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant all on all sequences in schema storage to anon, authenticated, service_role;
grant all on all functions in schema storage to anon, authenticated, service_role;
grant select on auth.users to supabase_storage_admin;

-- PostgREST reloads its schema cache on this; hosted Supabase sends it from an
-- event trigger that needs superuser here, so it is sent by hand after every
-- migration (docs/azure-migration-plan.md).
notify pgrst, 'reload schema';
