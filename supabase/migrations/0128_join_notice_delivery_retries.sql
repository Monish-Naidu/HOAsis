-- 0128: a join notice that stopped halfway is finished, not lost.
--
-- 0116 claimed a join request with board_notified_at before the first send,
-- so the once-per-request rule held, but the claim was also the record of
-- having sent: a crash after it, or one officer's send failing while the
-- others went, left the board partly or wholly untold with no way back.
--
-- Now each officer is a row here, made when the notice is first attempted
-- with the exact subject and link it carries (the payload is stable, so a
-- retry sends the same message under the same provider idempotency key and
-- a repeat inside the provider's window is folded, not doubled). A send
-- claims its row with a lease: pending and failed rows claim at once, a
-- claimed row only after ten minutes, which is how a worker that died
-- between reserving and sending is recovered without a second live worker
-- mailing the same officer. board_notified_at is stamped by
-- finish_join_notice only when every row is sent, so it keeps its meaning
-- from 0116: the board has been told, all of it.
--
-- The route alone uses this table, through the service role, like email_log.

create table join_notice_deliveries (
  request_id  uuid not null references join_requests (id) on delete cascade,
  email       text not null,
  profile_id  uuid,
  -- The message as first built: a retry sends these, not a fresh minting.
  subject     text not null,
  url         text not null,
  status      text not null default 'pending'
              check (status in ('pending', 'claimed', 'sent', 'failed')),
  attempts    integer not null default 0,
  claimed_at  timestamptz,
  sent_at     timestamptz,
  provider_id text,
  last_error  text,
  created_at  timestamptz not null default now(),
  primary key (request_id, email)
);

alter table join_notice_deliveries enable row level security;

-- No policies: the route works through the service role, and nobody else
-- reads or writes a delivery.
revoke all on join_notice_deliveries from public, anon, authenticated;
grant select, insert, update, delete on join_notice_deliveries to service_role;

-- Claims one delivery for the caller. Answers the row's stable payload when
-- the claim landed, nothing when it did not: already sent, or claimed by a
-- worker whose lease has not run out. The row lock makes two claims for the
-- same officer sequential, so only the first lands. `interrupted_at` names
-- the previous claim when this one recovered an interrupted send, so the
-- caller can reconcile against email_log before writing to the officer again.
-- A request the board has decided in the meantime is not announced as
-- waiting, as 0116's claim already kept.
create or replace function claim_join_notice(p_request_id uuid, p_email text)
returns table (subject text, url text, attempts integer, interrupted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  d join_notice_deliveries%rowtype;
begin
  select * into d
    from join_notice_deliveries
   where request_id = p_request_id and email = p_email
     for update;
  if not found or d.status = 'sent' then
    return;
  end if;
  if d.status = 'claimed' and d.claimed_at >= now() - interval '10 minutes' then
    return;
  end if;
  if not exists (
    select 1 from join_requests r
     where r.id = p_request_id and r.status = 'pending'
  ) then
    return;
  end if;
  update join_notice_deliveries
     set status = 'claimed', claimed_at = now(), attempts = d.attempts + 1
   where request_id = p_request_id and email = p_email;
  return query
  select d.subject,
         d.url,
         d.attempts + 1,
         case when d.status = 'claimed' then d.claimed_at else null end;
end;
$$;

-- Records how a claimed send ended. A success also stamps the request itself
-- once it was the last one outstanding, which is the "already told" the route
-- and 0116 read. A failure leaves the row claimable, so a later ask for the
-- same request reaches the officers the first run missed and no others.
create or replace function finish_join_notice(
  p_request_id uuid,
  p_email text,
  p_ok boolean,
  p_provider_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update join_notice_deliveries
     set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else sent_at end,
         provider_id = coalesce(p_provider_id, provider_id),
         last_error = p_error
   where request_id = p_request_id
     and email = p_email
     and status = 'claimed';
  if p_ok and not exists (
    select 1 from join_notice_deliveries
     where request_id = p_request_id and status <> 'sent'
  ) then
    update join_requests
       set board_notified_at = now()
     where id = p_request_id and board_notified_at is null;
  end if;
end;
$$;

-- Supabase's default privileges hand new functions to anon and
-- authenticated by name, so each is revoked by name: this table's callers
-- are the route alone, through the service role.
revoke all on function claim_join_notice(uuid, text) from public, anon, authenticated;
grant execute on function claim_join_notice(uuid, text) to service_role;
revoke all on function finish_join_notice(uuid, text, boolean, text, text) from public, anon, authenticated;
grant execute on function finish_join_notice(uuid, text, boolean, text, text) to service_role;
