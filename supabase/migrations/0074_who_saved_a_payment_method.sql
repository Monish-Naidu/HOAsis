-- Anybody on a home could say they were the one who saved its bank.
--
-- The routes that move money ask who saved a method before they charge it
-- (src/lib/stripe/saved-method-owner.ts): a method whose saver no longer
-- holds a seat on the home is charged by nobody. That is what stops a
-- seller's bank being debited for the buyer's dues.
--
-- The answer was the browser's to write. payment_instruments_own (0018)
-- lets any current member of the home insert and update any column of any
-- row on it, profile_id included. A buyer could put their own id on the
-- seller's row and the check passed, or save a row in a co-owner's name.
--
-- A trigger now keeps that column honest:
--
--   on insert, a signed-in person's row is theirs, whatever was sent. The
--     app already sends the caller's own id, so nothing it does changes;
--   on update, a signed-in browser cannot change who saved the row. The
--     default flag, the label and the rest stay writable by the household,
--     as they are today.
--
-- The update half asks current_user, as 0065 does, and not auth.uid() or
-- auth.role(): deleting a profile sets profile_id to null through the
-- foreign key, and that statement runs as the table's owner on behalf of
-- whoever deleted the account. It has to pass. The server's routes are
-- the service role and pass too.
--
-- Nothing is asked of the rows already there.

create or replace function payment_instruments_keep_saver()
returns trigger
language plpgsql
-- Security invoker on purpose: current_user has to be the role that ran
-- the statement.
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- The server and the seed scripts have no signed-in person, and say
    -- who the row belongs to themselves.
    if auth.uid() is not null then
      new.profile_id := auth.uid();
    end if;
    return new;
  end if;

  if new.profile_id is distinct from old.profile_id
     and current_user in ('authenticated', 'anon') then
    raise exception 'Who saved a payment method is not changed from here'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_instruments_keep_saver on payment_instruments;
create trigger payment_instruments_keep_saver
  before insert or update on payment_instruments
  for each row execute function payment_instruments_keep_saver();
