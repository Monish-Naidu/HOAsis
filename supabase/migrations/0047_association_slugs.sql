-- Association slugs.
--
-- Every association gets a short, human, stable name for links:
-- yourhoasis.com/c/oakview-commons and oakview-commons.yourhoasis.com both
-- open Oakview Commons. The slug is derived from the name once, on insert,
-- and then left alone: a board that renames itself keeps its links, the way
-- a Slack workspace keeps its subdomain. The uuid stays the primary key and
-- the only thing rows reference; the slug is an address, not an identity.
--
-- Additive. Nothing existing reads the column yet.

create or replace function slugify(p_text text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'), '-');
$$;

alter table associations
  add column if not exists slug text;

-- Words that name a host or a route, never an association.
create or replace function reserved_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select p_slug in (
    'www', 'app', 'api', 'mail', 'admin', 'board', 'resident', 'signin', 'join',
    'start', 'auth', 'about', 'pricing', 'library', 'dev', 'c', 'help', 'support',
    'status', 'demo', 'test', 'staging'
  );
$$;

-- The slug a name gets, made unique with a numeric suffix on collision.
create or replace function unique_association_slug(p_name text, p_self uuid default null)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_base      text := left(slugify(p_name), 48);
  v_candidate text;
  v_n         integer := 2;
begin
  if v_base = '' or reserved_slug(v_base) then
    v_base := case when v_base = '' then 'community' else v_base || '-hoa' end;
  end if;
  v_candidate := v_base;
  while exists (
    select 1 from associations a
     where a.slug = v_candidate and (p_self is null or a.id <> p_self)
  ) loop
    v_candidate := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;
  return v_candidate;
end;
$$;

-- Set on insert, and on update only if somebody cleared it. Never rewritten
-- from a rename.
create or replace function associations_set_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := unique_association_slug(new.name, new.id);
  else
    new.slug := slugify(new.slug);
  end if;
  return new;
end;
$$;

drop trigger if exists associations_slug on associations;
create trigger associations_slug
  before insert or update of slug on associations
  for each row execute function associations_set_slug();

-- Backfill in name order so the oldest holder of a name keeps the clean one.
do $$
declare
  r record;
begin
  for r in
    select id, name from associations where slug is null order by created_at, id
  loop
    update associations set slug = unique_association_slug(name, id) where id = r.id;
  end loop;
end;
$$;

alter table associations
  alter column slug set not null,
  add constraint associations_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

create unique index if not exists associations_slug_key on associations (slug);

-- The signed in person's associations, now with the slug the links use.
-- Return type changes, so the function is replaced rather than altered.
drop function if exists my_associations();
create function my_associations()
returns table (
  association_id uuid,
  name           text,
  role           board_role,
  capabilities   capability[],
  slug           text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, m.role, m.capabilities, a.slug
  from memberships m
  join associations a on a.id = m.association_id
  where m.profile_id = auth.uid()
    and m.ends_on is null
    and a.deleted_at is null
  order by a.name;
$$;

revoke all on function my_associations() from public;
-- anon as before: it answers nothing without a session, and the sign-in
-- form calls it the instant the session lands.
grant execute on function my_associations() to anon, authenticated;

-- What a stranger sees from a link: the name and the town, nothing else.
-- The join code is not here on purpose; the board hands that out.
create or replace function association_by_slug(p_slug text)
returns table (name text, city text, state text)
language sql
stable
security definer
set search_path = public
as $$
  select a.name, a.city, a.state
    from associations a
   where a.slug = slugify(coalesce(p_slug, ''))
     and a.deleted_at is null;
$$;

revoke all on function association_by_slug(text) from public;
grant execute on function association_by_slug(text) to anon, authenticated;
