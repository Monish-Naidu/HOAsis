-- Two things the five-year run found. Both are additive.
--
-- 1. The founder had no email on their own seat.
--
-- create_association seats the founder by profile and never copies the
-- address they signed up with onto the membership, while every other seat
-- is created from an invited email. Everything that reaches a household
-- reads the membership's invited_email: the plan's "can every household be
-- reached", the roster, invites, autopay receipts. So the President's own
-- home was listed as a household nobody can email, in every association.
--
-- A trigger rather than another copy of create_association, so the founding
-- function can keep changing without this being lost, and so any other path
-- that seats a profile directly is covered too. Existing seats are left
-- alone; filling them is a one-line update the owner can choose to run:
--
--   update memberships m set invited_email = p.email
--     from profiles p
--    where m.profile_id = p.id and m.invited_email is null and p.email is not null;

create or replace function memberships_default_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invited_email is null and new.profile_id is not null then
    select email into new.invited_email from profiles where id = new.profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_default_email on memberships;
create trigger memberships_default_email
  before insert on memberships
  for each row execute function memberships_default_email();

-- 2. Two owners could not both file a request.
--
-- The request form numbers a request from the requests the filer can see,
-- and an owner sees only their own. So every owner's first request was the
-- same REQ number, and requests are unique by (association, reference): the
-- second household to file anything was refused with a duplicate key. A
-- number already taken in the association now becomes the next free one for
-- that year. The lock keeps two owners filing in the same second apart.

create or replace function requests_free_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next   integer;
begin
  perform pg_advisory_xact_lock(hashtext('requests:' || new.association_id::text));
  if not exists (
    select 1 from requests
     where association_id = new.association_id and reference = new.reference
  ) then
    return new;
  end if;

  v_prefix := 'REQ-' || to_char(coalesce(new.submitted_on, current_date), 'YYYY') || '-';
  select coalesce(max(substring(reference from length(v_prefix) + 1)::integer), 199) + 1
    into v_next
    from requests
   where association_id = new.association_id
     and reference like v_prefix || '%'
     and substring(reference from length(v_prefix) + 1) ~ '^[0-9]+$';
  new.reference := v_prefix || v_next;
  return new;
end;
$$;

drop trigger if exists requests_free_reference on requests;
create trigger requests_free_reference
  before insert on requests
  for each row execute function requests_free_reference();
