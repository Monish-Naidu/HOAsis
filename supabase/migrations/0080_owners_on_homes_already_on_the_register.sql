-- Letting somebody in to a home that is already on the register, adding a
-- second owner, and correcting an owner's email.
--
-- After the setup wizard every home is on the register, most of them with an
-- empty seat. The only way the board could answer a join request was
-- add_household, which refuses a label that exists, so "Let them in" was
-- disabled and a mistyped label made a duplicate home. These three functions
-- put a person on the home the board chose. Nothing here creates a home.
--
--   seat_join_request   a join request, a home, and whether they share it.
--   add_second_owner    a second person on a home that already has an owner.
--   change_owner_email  the address a not yet signed in owner will claim
--                       their seat with.
--
-- All three need the settings capability on the association, the same one
-- add_household and the decision on a request ask. Dues, balances and votes
-- are per home (units, charges, votes keyed on unit_id), so a second seat
-- does not bill or vote twice. A sale is the one place that counted seats;
-- see 0081.
--
-- New names, no changed signatures: the deployed client keeps working until
-- the next deploy. Supabase grants EXECUTE to anon, authenticated and
-- service_role individually, so anon is revoked by name.

-- The one place a seat is added, shared by the two functions below. Not
-- callable by anyone: only the functions that checked the caller reach it.
create or replace function add_unit_owner_seat(
  p_unit_id uuid,
  p_name    text,
  p_email   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc   uuid;
  v_name    text := btrim(coalesce(p_name, ''));
  v_email   text := nullif(btrim(coalesce(p_email, '')), '');
  v_profile uuid;
  v_new     uuid;
begin
  select association_id into v_assoc from units where id = p_unit_id;
  if v_assoc is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if v_name = '' then
    raise exception 'An owner needs a name' using errcode = '22000';
  end if;

  -- Somebody who already has an account is seated now rather than waiting
  -- for a sign in that may never come, as add_household does.
  if v_email is not null then
    select id into v_profile from profiles where lower(email) = lower(v_email) limit 1;
  end if;
  if exists (
    select 1 from memberships m
     where m.unit_id = p_unit_id
       and m.ends_on is null
       and ((v_profile is not null and m.profile_id = v_profile)
         or (v_email is not null and lower(m.invited_email) = lower(v_email)))
  ) then
    raise exception 'That person is already an owner of this home' using errcode = '23505';
  end if;

  insert into memberships (association_id, unit_id, profile_id, invited_email, full_name, role, capabilities)
  values (v_assoc, p_unit_id, v_profile, v_email, v_name, 'resident', '{}'::capability[])
  returning id into v_new;
  return v_new;
end;
$$;
revoke all on function add_unit_owner_seat(uuid, text, text) from public;
revoke execute on function add_unit_owner_seat(uuid, text, text) from anon, authenticated;

-- A join request answered by choosing a home.
--
--   no owner listed, or a listed owner who has not signed in and has the
--   same email or none: the requester takes that seat (name and email, and
--   the account when they already have one).
--   a home with another owner: refused, unless p_as_second, which adds the
--   requester as a second owner with a seat of their own.
--
-- Does not decide the request: the app marks it approved once this has
-- landed, so a refusal leaves it waiting. Asking again for somebody already
-- on the home answers with the home and changes nothing.
create or replace function seat_join_request(
  p_request_id uuid,
  p_unit_id    uuid,
  p_as_second  boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req     join_requests%rowtype;
  v_email   text;
  v_profile uuid;
  v_first   memberships%rowtype;
  v_any       boolean;
  v_has_owner boolean;
begin
  select * into v_req from join_requests where id = p_request_id;
  if not found then
    raise exception 'No such request' using errcode = '22000';
  end if;
  if not has_capability(v_req.association_id, 'settings') then
    raise exception 'Only a settings holder can let somebody in' using errcode = '42501';
  end if;
  if not exists (select 1 from units where id = p_unit_id and association_id = v_req.association_id) then
    raise exception 'That home is not on this association''s register' using errcode = '22000';
  end if;

  v_email := lower(btrim(v_req.email));
  select id into v_profile from profiles where lower(email) = v_email limit 1;

  -- Already on the home: nothing to do, and a second press is not an error.
  if exists (
    select 1 from memberships m
     where m.unit_id = p_unit_id
       and m.ends_on is null
       and ((v_profile is not null and m.profile_id = v_profile)
         or lower(m.invited_email) = v_email)
  ) then
    return p_unit_id;
  end if;

  if v_req.status = 'approved' then
    raise exception 'That request was already let in' using errcode = '22000';
  end if;

  -- The listed owner is the first open seat, the one the roster shows.
  select * into v_first from memberships
   where unit_id = p_unit_id and ends_on is null
   order by starts_on, created_at, id
   limit 1;
  v_any := found;
  v_has_owner := v_any and btrim(v_first.full_name) <> '';

  if p_as_second and v_has_owner then
    perform add_unit_owner_seat(p_unit_id, v_req.full_name, v_req.email);
    return p_unit_id;
  end if;

  if not v_any then
    perform add_unit_owner_seat(p_unit_id, v_req.full_name, v_req.email);
    return p_unit_id;
  end if;

  -- One seat to hand over, and only when it is nobody else's.
  if v_first.profile_id is not null
     or (v_has_owner and v_first.invited_email is not null and lower(v_first.invited_email) <> v_email) then
    raise exception 'That home already has an owner. Add them as a second owner, or record a sale'
      using errcode = '22000';
  end if;

  update memberships
     set full_name     = btrim(v_req.full_name),
         invited_email = v_email,
         profile_id    = v_profile
   where id = v_first.id;
  return p_unit_id;
end;
$$;
revoke all on function seat_join_request(uuid, uuid, boolean) from public;
revoke execute on function seat_join_request(uuid, uuid, boolean) from anon;
grant execute on function seat_join_request(uuid, uuid, boolean) to authenticated;

-- A second owner of a home that already has one, from the household card.
-- Needs a name already on the home, so the roster never shows an empty
-- first seat above a named second one.
create or replace function add_second_owner(
  p_unit_id uuid,
  p_name    text,
  p_email   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc uuid;
begin
  select association_id into v_assoc from units where id = p_unit_id;
  if v_assoc is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if not has_capability(v_assoc, 'settings') then
    raise exception 'Only a settings holder can add an owner' using errcode = '42501';
  end if;
  if btrim(coalesce(p_email, '')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A second owner needs a working email address to sign in with' using errcode = '22000';
  end if;
  if not exists (
    select 1 from memberships
     where unit_id = p_unit_id and ends_on is null and btrim(full_name) <> ''
  ) then
    raise exception 'Name the first owner before adding a second' using errcode = '22000';
  end if;
  return add_unit_owner_seat(p_unit_id, p_name, p_email);
end;
$$;
revoke all on function add_second_owner(uuid, text, text) from public;
revoke execute on function add_second_owner(uuid, text, text) from anon;
grant execute on function add_second_owner(uuid, text, text) to authenticated;

-- The address a listed owner will claim their seat with.
--
-- claim_my_seats matches an open seat's invited_email to the signed in
-- address, so correcting this is what lets the next press of the owner's
-- invitation link claim the seat. The seat is found by the address it has
-- now, because a home can have two owners. Refused once the owner has
-- signed in: a signed in person's notices go to their account's email, and
-- that is theirs to change. When the new address already has an account it
-- is seated now, as add_household does. Returns the seat.
create or replace function change_owner_email(
  p_unit_id   uuid,
  p_old_email text,
  p_new_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assoc   uuid;
  v_old     text := lower(btrim(coalesce(p_old_email, '')));
  v_new     text := btrim(coalesce(p_new_email, ''));
  v_seat    memberships%rowtype;
  v_profile uuid;
begin
  select association_id into v_assoc from units where id = p_unit_id;
  if v_assoc is null then
    raise exception 'No such home' using errcode = '23503';
  end if;
  if not has_capability(v_assoc, 'settings') then
    raise exception 'Only a settings holder can change an owner''s email' using errcode = '42501';
  end if;
  if v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address does not look right' using errcode = '22000';
  end if;

  select * into v_seat from memberships
   where unit_id = p_unit_id
     and ends_on is null
     and btrim(full_name) <> ''
     and lower(coalesce(invited_email, '')) = v_old
   order by starts_on, created_at, id
   limit 1;
  if not found then
    raise exception 'No owner of this home has that email' using errcode = '22000';
  end if;
  if v_seat.profile_id is not null then
    raise exception 'They have already signed in. Their email is theirs to change' using errcode = '22000';
  end if;
  if exists (
    select 1 from memberships m
     where m.unit_id = p_unit_id and m.ends_on is null and m.id <> v_seat.id
       and lower(m.invited_email) = lower(v_new)
  ) then
    raise exception 'Another owner of this home already has that email' using errcode = '23505';
  end if;

  select id into v_profile from profiles where lower(email) = lower(v_new) limit 1;
  if v_profile is not null and exists (
    select 1 from memberships m
     where m.unit_id = p_unit_id and m.ends_on is null and m.profile_id = v_profile
  ) then
    v_profile := null;
  end if;

  update memberships
     set invited_email = v_new,
         profile_id    = v_profile
   where id = v_seat.id;
  return v_seat.id;
end;
$$;
revoke all on function change_owner_email(uuid, text, text) from public;
revoke execute on function change_owner_email(uuid, text, text) from anon;
grant execute on function change_owner_email(uuid, text, text) to authenticated;
