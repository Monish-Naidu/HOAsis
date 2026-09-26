-- Two things a board expects from software that runs its money.
--
-- 1. Looking without touching. A seat's `capabilities` have always meant
--    "may change". `views` is the new second list: areas the seat may open
--    and read but not act in. An auditor, a treasurer's stand-in or a
--    director who only wants the numbers gets a viewer's seat instead of
--    nothing. Every write gate in this schema keeps asking has_capability,
--    so nothing a viewer can do is new; only what they can see is.
--
-- 2. Who did what. `activity` is an append-only record of board actions,
--    written by triggers so no code path can skip it: seats and access
--    changed, bills approved and paid, documents shown or hidden, the
--    association's own settings, notices, ballots, requests decided,
--    violations moved, bank accounts, and payments the board recorded by
--    hand. Nobody can update or delete a row, the platform included.

-- ---------------------------------------------------------------- views

alter table memberships
  add column if not exists views capability[] not null default '{}';

comment on column memberships.views is
  'Areas this seat may open and read but not change. capabilities is "may change".';

-- Change implies view: a seat that can act in an area can see it.
create or replace function can_view(target uuid, area capability)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.association_id = target
      and m.profile_id = auth.uid()
      and m.ends_on is null
      and (area = any (m.capabilities) or area = any (m.views))
  );
$$;

revoke all on function can_view(uuid, capability) from public;
grant execute on function can_view(uuid, capability) to anon, authenticated;

-- The five reads that were gated on the change right. Writes untouched.
drop policy if exists bank_accounts_read on bank_accounts;
create policy bank_accounts_read on bank_accounts
  for select using (can_view(association_id, 'finances'));

drop policy if exists ledger_read on ledger_entries;
create policy ledger_read on ledger_entries
  for select using (can_view(association_id, 'finances'));

drop policy if exists vendors_read on vendors;
create policy vendors_read on vendors
  for select using (can_view(association_id, 'vendors'));

drop policy if exists payouts_read on payouts;
create policy payouts_read on payouts
  for select using (can_view(association_id, 'finances'));

drop policy if exists message_templates_read on message_templates;
create policy message_templates_read on message_templates
  for select using (can_view(association_id, 'communications'));

-- A new officer sees the whole board by default and changes their own
-- area. The client writes both lists when a role is set; this backfills
-- seats that exist today so nobody loses a tab they had.
update memberships
   set views = array(
     select unnest(array['finances','requests','documents','communications','voting','vendors','compliance','forum','settings']::capability[])
     except select unnest(capabilities)
   )
 where role in ('vice-president', 'treasurer', 'secretary')
   and ends_on is null
   and views = '{}';

-- -------------------------------------------------------------- activity

create table if not exists activity (
  id             uuid primary key default gen_random_uuid(),
  association_id uuid not null references associations (id) on delete cascade,
  at             timestamptz not null default now(),
  -- Null when the platform did it: a cron, a webhook, an import script.
  actor_id       uuid references profiles (id) on delete set null,
  actor_name     text not null default 'Your HOAsis',
  -- What kind of record, and which one, so a row can be followed back.
  subject_kind   text not null,
  subject_id     uuid,
  -- One plain sentence, the way it reads in the list.
  summary        text not null,
  -- The fields that changed, before and after, for anyone who needs more.
  details        jsonb not null default '{}'::jsonb
);

create index if not exists activity_association_at_idx on activity (association_id, at desc);

alter table activity enable row level security;

-- Readable by anyone who may see Settings, which is where it shows.
-- No insert, update or delete policy for anyone: the triggers below run
-- as definer, and even the platform's service role goes through them.
create policy activity_read on activity
  for select using (can_view(association_id, 'settings'));

revoke insert, update, delete on activity from anon, authenticated;

-- Who is acting, as the row will name them. A person's seat name in this
-- association first, their profile name second, the platform when nobody
-- is signed in.
create or replace function activity_actor(p_association uuid)
returns table (actor_id uuid, actor_name text)
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid(),
         coalesce(
           (select m.full_name from memberships m
             where m.association_id = p_association and m.profile_id = auth.uid() and m.ends_on is null
             limit 1),
           (select nullif(p.full_name, '') from profiles p where p.id = auth.uid()),
           case when auth.uid() is null then 'Your HOAsis' else 'A member' end
         );
$$;

create or replace function record_activity(
  p_association uuid,
  p_kind        text,
  p_subject     uuid,
  p_summary     text,
  p_details     jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
begin
  select * into v_actor from activity_actor(p_association);
  insert into activity (association_id, actor_id, actor_name, subject_kind, subject_id, summary, details)
  values (p_association, v_actor.actor_id, v_actor.actor_name, p_kind, p_subject, p_summary, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function record_activity(uuid, text, uuid, text, jsonb) from public;

-- A capability list in words: "Finances, Vendors".
create or replace function capability_words(p capability[])
returns text
language sql
immutable
as $$
  select coalesce(string_agg(initcap(replace(c::text, '_', ' ')), ', ' order by c), 'nothing')
  from unnest(p) as c;
$$;

-- -------------------------------------------------- what gets recorded

-- Seats: appointed, role changed, access changed, seat closed.
create or replace function activity_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := replace(new.role::text, '-', ' ');
begin
  if tg_op = 'INSERT' then
    if new.role <> 'resident' then
      perform record_activity(new.association_id, 'seat', new.id,
        format('%s appointed %s', new.full_name, v_role),
        jsonb_build_object('role', new.role, 'can_change', new.capabilities, 'can_see', new.views));
    end if;
    return new;
  end if;
  if new.role is distinct from old.role then
    perform record_activity(new.association_id, 'seat', new.id,
      format('%s is now %s', new.full_name, case when new.role = 'resident' then 'an owner without an office' else v_role end),
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.capabilities is distinct from old.capabilities or new.views is distinct from old.views then
    perform record_activity(new.association_id, 'seat', new.id,
      format('%s can change %s and see %s', new.full_name, capability_words(new.capabilities), capability_words(new.views)),
      jsonb_build_object('can_change', jsonb_build_object('from', old.capabilities, 'to', new.capabilities),
                         'can_see', jsonb_build_object('from', old.views, 'to', new.views)));
  end if;
  if new.ends_on is not null and old.ends_on is null then
    perform record_activity(new.association_id, 'seat', new.id,
      format('%s left the register', new.full_name),
      jsonb_build_object('ends_on', new.ends_on));
  end if;
  return new;
end;
$$;

drop trigger if exists activity_memberships on memberships;
create trigger activity_memberships
  after insert or update of role, capabilities, views, ends_on on memberships
  for each row execute function activity_memberships();

-- Bills: approved, scheduled, paid, rejected.
create or replace function activity_payouts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform record_activity(new.association_id, 'payout', new.id,
      format('Bill from %s for $%s added', new.vendor_name, to_char(new.amount_cents / 100.0, 'FM999,999,990.00')),
      jsonb_build_object('status', new.status));
    return new;
  end if;
  if new.status is distinct from old.status then
    perform record_activity(new.association_id, 'payout', new.id,
      format('Bill from %s for $%s %s', new.vendor_name, to_char(new.amount_cents / 100.0, 'FM999,999,990.00'),
        case new.status when 'scheduled' then 'approved' when 'paid' then 'paid' when 'rejected' then 'rejected' else new.status::text end),
      jsonb_build_object('from', old.status, 'to', new.status));
  elsif new.approvals is distinct from old.approvals then
    perform record_activity(new.association_id, 'payout', new.id,
      format('Bill from %s for $%s signed', new.vendor_name, to_char(new.amount_cents / 100.0, 'FM999,999,990.00')),
      jsonb_build_object('approvals', new.approvals));
  end if;
  return new;
end;
$$;

drop trigger if exists activity_payouts on payouts;
create trigger activity_payouts
  after insert or update of status, approvals on payouts
  for each row execute function activity_payouts();

-- Documents: added, shown to a different audience, removed.
create or replace function activity_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform record_activity(new.association_id, 'document', new.id,
      format('Document "%s" added, visible to %s', new.name, new.visibility),
      jsonb_build_object('visibility', new.visibility));
    return new;
  elsif tg_op = 'DELETE' then
    perform record_activity(old.association_id, 'document', old.id,
      format('Document "%s" removed', old.name), '{}'::jsonb);
    return old;
  end if;
  if new.visibility is distinct from old.visibility then
    perform record_activity(new.association_id, 'document', new.id,
      format('Document "%s" now visible to %s', new.name, new.visibility),
      jsonb_build_object('from', old.visibility, 'to', new.visibility));
  end if;
  return new;
end;
$$;

drop trigger if exists activity_documents on documents;
create trigger activity_documents
  after insert or delete or update of visibility on documents
  for each row execute function activity_documents();

-- The association itself: name, dues, due day, fees, the collection ladder.
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
    v_words := v_words || format('renamed to %s', new.name);
  end if;
  if new.dues_cents is distinct from old.dues_cents or new.due_day is distinct from old.due_day
     or new.dues_cadence is distinct from old.dues_cadence then
    v_changes := v_changes || jsonb_build_object('dues', jsonb_build_object(
      'from', jsonb_build_object('cents', old.dues_cents, 'day', old.due_day, 'cadence', old.dues_cadence),
      'to',   jsonb_build_object('cents', new.dues_cents, 'day', new.due_day, 'cadence', new.dues_cadence)));
    v_words := v_words || format('dues set to $%s %s on day %s',
      to_char(new.dues_cents / 100.0, 'FM999,990.00'), new.dues_cadence, new.due_day);
  end if;
  if new.payment_fee_cents is distinct from old.payment_fee_cents
     or new.payment_fee_paid_by is distinct from old.payment_fee_paid_by
     or new.payment_fee_waived_on_ach is distinct from old.payment_fee_waived_on_ach then
    v_changes := v_changes || jsonb_build_object('payment_fee', jsonb_build_object(
      'from', jsonb_build_object('cents', old.payment_fee_cents, 'paid_by', old.payment_fee_paid_by, 'waived_on_ach', old.payment_fee_waived_on_ach),
      'to',   jsonb_build_object('cents', new.payment_fee_cents, 'paid_by', new.payment_fee_paid_by, 'waived_on_ach', new.payment_fee_waived_on_ach)));
    v_words := v_words || 'payment fee changed';
  end if;
  if (new.settings -> 'collectionPolicy') is distinct from (old.settings -> 'collectionPolicy') then
    v_changes := v_changes || jsonb_build_object('collection_policy', jsonb_build_object(
      'from', old.settings -> 'collectionPolicy', 'to', new.settings -> 'collectionPolicy'));
    v_words := v_words || 'collection policy changed';
  end if;
  if new.stripe_account_id is distinct from old.stripe_account_id and new.stripe_account_id is not null then
    v_words := v_words || 'online payments set up';
  end if;
  if array_length(v_words, 1) > 0 then
    perform record_activity(new.id, 'association', new.id,
      'Association ' || array_to_string(v_words, '; '), v_changes);
  end if;
  return new;
end;
$$;

drop trigger if exists activity_associations on associations;
create trigger activity_associations
  after update of name, dues_cents, due_day, dues_cadence, payment_fee_cents,
    payment_fee_paid_by, payment_fee_waived_on_ach, settings, stripe_account_id on associations
  for each row execute function activity_associations();

-- Notices posted.
create or replace function activity_announcements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform record_activity(new.association_id, 'announcement', new.id,
    format('Notice posted: %s', new.title), jsonb_build_object('category', new.category));
  return new;
end;
$$;

drop trigger if exists activity_announcements on announcements;
create trigger activity_announcements
  after insert on announcements
  for each row execute function activity_announcements();

-- Ballots: created, opened, closed, certified.
create or replace function activity_ballots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform record_activity(new.association_id, 'ballot', new.id,
      format('Ballot "%s" created, opens %s', new.title, to_char(new.opens_on, 'Mon DD, YYYY')),
      jsonb_build_object('status', new.status));
    return new;
  end if;
  if new.status is distinct from old.status then
    perform record_activity(new.association_id, 'ballot', new.id,
      format('Ballot "%s" %s', new.title, new.status),
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists activity_ballots on ballots;
create trigger activity_ballots
  after insert or update of status on ballots
  for each row execute function activity_ballots();

-- Requests decided.
create or replace function activity_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform record_activity(new.association_id, 'request', new.id,
      format('Request %s "%s" %s', new.reference, new.title,
        case new.status when 'in-review' then 'moved to review' when 'closed' then 'closed' else new.status::text end),
      jsonb_build_object('from', old.status, 'to', new.status, 'note', new.decided_note));
  end if;
  return new;
end;
$$;

drop trigger if exists activity_requests on requests;
create trigger activity_requests
  after update of status on requests
  for each row execute function activity_requests();

-- Bank accounts the association holds: connected, removed.
create or replace function activity_bank_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform record_activity(new.association_id, 'bank_account', new.id,
      format('%s account at %s ending %s connected', initcap(new.kind::text), new.institution, new.mask),
      jsonb_build_object('kind', new.kind));
    return new;
  end if;
  perform record_activity(old.association_id, 'bank_account', old.id,
    format('%s account at %s ending %s removed', initcap(old.kind::text), old.institution, old.mask),
    jsonb_build_object('kind', old.kind));
  return old;
end;
$$;

drop trigger if exists activity_bank_accounts on bank_accounts;
create trigger activity_bank_accounts
  after insert or delete on bank_accounts
  for each row execute function activity_bank_accounts();

-- Payments a person recorded by hand (a cheque, cash). Stripe's own settle
-- under the webhook with no signed-in person and are already on the books
-- with their intent id; they are money movements, not board actions.
create or replace function activity_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if auth.uid() is null or new.stripe_payment_intent_id is not null then
    return new;
  end if;
  select label into v_label from units where id = new.unit_id;
  perform record_activity(new.association_id, 'payment', new.id,
    format('Payment of $%s recorded for %s by %s',
      to_char(new.amount_cents / 100.0, 'FM999,999,990.00'), coalesce(v_label, 'a home'), new.rail),
    jsonb_build_object('rail', new.rail, 'unit_id', new.unit_id));
  return new;
end;
$$;

drop trigger if exists activity_payments on payments;
create trigger activity_payments
  after insert on payments
  for each row execute function activity_payments();
