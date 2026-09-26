-- Tenancy guards.
--
-- Two things keep associations apart: the uuid, which is the identity, and
-- the rows that carry it. Names are labels and may repeat (two Maple Ridges
-- in two states); slugs and join codes may not. This migration adds:
--
-- 1. A home must belong to the association its row says it does. Every
--    table that carries both unit_id and association_id gets a trigger that
--    refuses a mismatched pair. Without it, memberships_write (which has no
--    with-check of its own) let a President seat themselves at a home in
--    another association, and my_unit_ids() then opened that home's
--    charges, payments and requests to them. The trigger runs for every
--    role, service role included, so a webhook with the wrong metadata is
--    stopped too.
--
-- 2. A public lookup by name, so the setup wizard and Settings can say
--    "there is already a Maple Ridge in Bothell, WA" and offer the join
--    page. Same disclosure as association_by_slug: name, town, slug.
--
-- Additive. No existing row or function changes.

-- ---------------------------------------------------- unit ∈ association

create or replace function unit_in_association()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if new.unit_id is null then
    return new;
  end if;
  select association_id into v_owner from units where id = new.unit_id;
  if v_owner is null or v_owner <> new.association_id then
    raise exception 'unit % does not belong to association %', new.unit_id, new.association_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'autopay_runs', 'charges', 'email_log', 'memberships', 'payment_instruments',
    'payments', 'requests', 'threads', 'violations'
  ] loop
    execute format('drop trigger if exists %I on %I', t || '_unit_in_association', t);
    execute format(
      'create trigger %I before insert or update of unit_id, association_id on %I
         for each row execute function unit_in_association()',
      t || '_unit_in_association', t
    );
  end loop;
end;
$$;

-- ------------------------------------------------------- names that match

-- Case and whitespace do not make a different name. Mirrored in
-- src/lib/community-links.ts (normalizeAssociationName).
create or replace function normalize_association_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- Associations already using this name. A stranger sees the name, the town
-- and the slug (for the join link), nothing else. Oldest first, five at most.
create or replace function associations_named(p_name text)
returns table (name text, city text, state text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select a.name, a.city, a.state, a.slug
    from associations a
   where normalize_association_name(a.name) = normalize_association_name(p_name)
     and normalize_association_name(p_name) <> ''
     and a.deleted_at is null
   order by a.created_at, a.id
   limit 5;
$$;

revoke all on function associations_named(text) from public;
grant execute on function associations_named(text) to anon, authenticated;

create index if not exists associations_normalized_name
  on associations (normalize_association_name(name))
  where deleted_at is null;
