-- Three settings changes could not be saved since 0059.
--
-- activity_associations builds its summary in a text[]. Appending a bare
-- string literal to a text[] with || is read by Postgres as array || array,
-- so 'collection policy changed' was parsed as an array literal and the
-- trigger raised 22P02 (malformed array literal). The update it fired on was
-- rolled back with it. That took out three writes:
--
--   a board changing its collection policy (late fee, notice days),
--   a board changing who pays the payment fee,
--   Stripe onboarding storing the connected account id.
--
-- Renames and dues changes were unaffected because format() returns text and
-- text[] || text is an append. array_append says which one is meant in every
-- branch, so the next line added here cannot repeat it.
--
-- Found by scripts/verify-late-fees.mjs ("a policy with no fee posts none"),
-- whose settings update had been failing unnoticed.

create or replace function activity_associations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_words   text[] := '{}';
begin
  if new.name is distinct from old.name then
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', old.name, 'to', new.name));
    v_words := array_append(v_words, format('renamed to %s', new.name));
  end if;
  if new.dues_cents is distinct from old.dues_cents or new.due_day is distinct from old.due_day
     or new.dues_cadence is distinct from old.dues_cadence then
    v_changes := v_changes || jsonb_build_object('dues', jsonb_build_object(
      'from', jsonb_build_object('cents', old.dues_cents, 'day', old.due_day, 'cadence', old.dues_cadence),
      'to',   jsonb_build_object('cents', new.dues_cents, 'day', new.due_day, 'cadence', new.dues_cadence)));
    v_words := array_append(v_words, format('dues set to $%s %s on day %s',
      to_char(new.dues_cents / 100.0, 'FM999,990.00'), new.dues_cadence, new.due_day));
  end if;
  if new.payment_fee_cents is distinct from old.payment_fee_cents
     or new.payment_fee_paid_by is distinct from old.payment_fee_paid_by
     or new.payment_fee_waived_on_ach is distinct from old.payment_fee_waived_on_ach then
    v_changes := v_changes || jsonb_build_object('payment_fee', jsonb_build_object(
      'from', jsonb_build_object('cents', old.payment_fee_cents, 'paid_by', old.payment_fee_paid_by, 'waived_on_ach', old.payment_fee_waived_on_ach),
      'to',   jsonb_build_object('cents', new.payment_fee_cents, 'paid_by', new.payment_fee_paid_by, 'waived_on_ach', new.payment_fee_waived_on_ach)));
    v_words := array_append(v_words, 'payment fee changed'::text);
  end if;
  if (new.settings -> 'collectionPolicy') is distinct from (old.settings -> 'collectionPolicy') then
    v_changes := v_changes || jsonb_build_object('collection_policy', jsonb_build_object(
      'from', old.settings -> 'collectionPolicy', 'to', new.settings -> 'collectionPolicy'));
    v_words := array_append(v_words, 'collection policy changed'::text);
  end if;
  if new.stripe_account_id is distinct from old.stripe_account_id and new.stripe_account_id is not null then
    v_words := array_append(v_words, 'online payments set up'::text);
  end if;
  if array_length(v_words, 1) > 0 then
    perform record_activity(new.id, 'association', new.id,
      'Association ' || array_to_string(v_words, '; '), v_changes);
  end if;
  return new;
end;
$$;
