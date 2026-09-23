-- Claiming the seat that was set out for you.
--
-- A board lists a home with an owner's email before that owner has an
-- account. add_household seats a profile that already exists, and the invite
-- link seats the person who clicks it, but somebody who was listed by the
-- founding wizard, or who signs in through the front door instead of the
-- invite, arrived to an empty product: their membership sat with a null
-- profile and my_associations found nothing. This is the missing third path:
-- on every sign-in, any open seat whose invited email is the signed-in
-- address becomes theirs.
--
-- Matching is on the address Supabase Auth verified, never on anything the
-- browser sends, and only seats nobody holds can be claimed.

create or replace function claim_my_seats()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return 0;
  end if;

  update memberships m
     set profile_id = auth.uid()
   where m.profile_id is null
     and m.ends_on is null
     and lower(m.invited_email) = v_email;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function claim_my_seats() from public;
grant execute on function claim_my_seats() to authenticated;
