-- A seller's bank stayed on the home after the sale.
--
-- Saved payment methods are kept by home (0018), and the Stripe customer
-- they hang from is kept on the unit (0023). Neither knew about a change
-- of owner. After transfer_home the buyer's pay screen listed the seller's
-- bank, by name and last four digits, and the buyer's first saved card was
-- attached to the seller's Stripe customer. The server already refuses to
-- charge a method whose saver has left; this removes the row and the
-- customer so there is nothing left to refuse.
--
-- It is a trigger on memberships and not a change to transfer_home, on
-- purpose. A seat ends in three places today: a sale (transfer_home, 0012),
-- somebody leaving (leave_association, 0010), and a permissions holder
-- ending or deleting a seat directly. Rewriting two functions would have
-- covered two of them and left the next one to remember. The trigger sees
-- every seat that ends, however it ended, and neither function changes.
--
-- When a seat that somebody had claimed ends or is deleted:
--
--   that person's saved methods on that home go, unless they still hold
--     another seat on it;
--   the home's Stripe customer is forgotten once no method saved by a
--     current member is left, so the next person to save one gets a
--     customer of their own (setup-intent makes one when the column is
--     empty). A co-owner who saved a method keeps it and keeps the
--     customer it is attached to.
--
-- A method with no saver on record is left where it is. It was never
-- chargeable and it is not ours to guess whose it was.
--
-- The method stays attached to the old customer at Stripe. Nothing here
-- can reach Stripe, and with the row and the customer id gone the app has
-- no way left to charge it.
--
-- Security definer: the person ending the seat is usually an officer, who
-- cannot see a household's saved methods (payment_instruments_own), and a
-- person leaving has already lost their own access by the time this runs.

create or replace function memberships_take_saved_methods()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only a seat that was current and now is not.
  if old.ends_on is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if new.ends_on is null then
      return null;
    end if;
  end if;

  -- A seat nobody had claimed saved nothing.
  if old.profile_id is null then
    return null;
  end if;

  -- Still on the home through another seat: nothing to take.
  if exists (
    select 1 from memberships m
     where m.unit_id = old.unit_id
       and m.profile_id = old.profile_id
       and m.ends_on is null
  ) then
    return null;
  end if;

  delete from payment_instruments
   where unit_id = old.unit_id
     and profile_id = old.profile_id;

  if not exists (
    select 1
      from payment_instruments pi
      join memberships m
        on m.unit_id = pi.unit_id
       and m.profile_id = pi.profile_id
       and m.ends_on is null
     where pi.unit_id = old.unit_id
  ) then
    update units
       set stripe_customer_id = null
     where id = old.unit_id
       and stripe_customer_id is not null;
  end if;

  return null;
end;
$$;

drop trigger if exists memberships_take_saved_methods on memberships;
create trigger memberships_take_saved_methods
  after update of ends_on or delete on memberships
  for each row execute function memberships_take_saved_methods();

-- The seats that ended before this existed. The same rule, once: a method
-- whose saver holds no current seat on the home goes, and a home that lost
-- one this way forgets its customer unless a current member still has a
-- method on it. Homes nothing was taken from are not touched, so nobody
-- part way through saving a card loses the customer it was started on.
-- Running it again finds nothing.
with gone as (
  delete from payment_instruments pi
   where pi.profile_id is not null
     and not exists (
       select 1 from memberships m
        where m.unit_id = pi.unit_id
          and m.profile_id = pi.profile_id
          and m.ends_on is null
     )
  returning pi.unit_id
)
update units u
   set stripe_customer_id = null
 where u.id in (select unit_id from gone)
   and u.stripe_customer_id is not null
   and not exists (
     select 1
       from payment_instruments pi
       join memberships m
         on m.unit_id = pi.unit_id
        and m.profile_id = pi.profile_id
        and m.ends_on is null
      where pi.unit_id = u.id
   );
