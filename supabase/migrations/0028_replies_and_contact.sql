-- Replies on a post, and how to reach an owner.
--
-- Two things residents could do in the demo and not in a real association:
-- answer a neighbour's post, and tell the board their phone number and where
-- their post goes.
--
-- Replies are rows under a post. Anyone in the association reads them,
-- anyone in the association writes their own, and the forum capability or
-- the author removes one. The post's own read rule carries through, since
-- a reply on a post you cannot see is not yours to see either.
--
-- Contact details sit on the membership rather than the profile, because
-- the profile is private to its owner and the roster is the association's.
-- An owner changes their own through one function that touches nothing but
-- those two columns, so the row's role and seat stay the board's to set.

create table post_replies (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  post_id        uuid not null references posts (id) on delete cascade,
  author_id      uuid references profiles (id) on delete set null,
  author_name    text not null,
  author_role    text,
  unit_label     text not null default '',
  body           text not null,
  created_at     timestamptz not null default now()
);

create index on post_replies (post_id, created_at);
create index on post_replies (association_id);

alter table post_replies enable row level security;

create policy post_replies_read on post_replies
  for select using (
    is_member_of(association_id)
    and exists (select 1 from posts p where p.id = post_id)
  );
create policy post_replies_write on post_replies
  for insert with check (is_member_of(association_id) and author_id = auth.uid());
create policy post_replies_remove on post_replies
  for delete using (has_capability(association_id, 'forum') or author_id = auth.uid());

alter table memberships
  add column if not exists phone           text not null default '',
  add column if not exists mailing_address text not null default '';

create or replace function update_my_contact(
  p_association_id  uuid,
  p_phone           text,
  p_mailing_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update memberships
     set phone = coalesce(btrim(p_phone), ''),
         mailing_address = coalesce(btrim(p_mailing_address), '')
   where association_id = p_association_id
     and profile_id = auth.uid()
     and ends_on is null;
  if not found then
    raise exception 'You are not a member of that association' using errcode = '42501';
  end if;
end;
$$;

revoke all on function update_my_contact(uuid, text, text) from public;
grant execute on function update_my_contact(uuid, text, text) to authenticated;
