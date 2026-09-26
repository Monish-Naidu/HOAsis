-- The association a person lands in.
--
-- Somebody who holds seats in two associations was landing in whichever one
-- sorted first by name, with the browser remembering the last switch. The
-- choice belongs to the person, not the browser, so it lives on the profile
-- and travels with them to a new phone. Set from the switcher; read on
-- sign-in; null means "the first one, like before".

alter table profiles
  add column if not exists home_association_id uuid references associations (id) on delete set null;

-- The return shape grows a column, which Postgres only allows by
-- recreating the function. Same body as 0047 plus is_home, and the home
-- association sorts first.
drop function if exists my_associations();
create function my_associations()
returns table (
  association_id uuid,
  name           text,
  role           board_role,
  capabilities   capability[],
  slug           text,
  is_home        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, m.role, m.capabilities, a.slug,
         coalesce(a.id = p.home_association_id, false) as is_home
  from memberships m
  join associations a on a.id = m.association_id
  left join profiles p on p.id = auth.uid()
  where m.profile_id = auth.uid()
    and m.ends_on is null
    and a.deleted_at is null
  order by coalesce(a.id = p.home_association_id, false) desc, a.name;
$$;

revoke all on function my_associations() from public;
grant execute on function my_associations() to anon, authenticated;
