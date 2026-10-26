-- 0129: a delivery event lands whole, or the provider is told to come back.
--
-- The webhook used to read the message's row, ignore the read's error, and
-- answer Resend "received" whether or not the write that followed had a
-- database behind it. A failed read looked exactly like a message nobody
-- logged, so a database fault was acknowledged as success and the event was
-- gone. And the rung check ran in the route, a read apart from its write:
-- two events for one message arriving together each read the old status,
-- each passed, and the later writer won regardless of its rung.
--
-- The whole decision is one call now. The row lock serializes simultaneous
-- events for a message, the ladder is applied under that lock, and the
-- route answers 500 on any error from this function so the provider
-- retries instead of moving on. The ladder itself is the one the route
-- documented from the start: a higher rung never gives way to a lower one,
-- and rungs shared by peers (sent/delayed, opened/clicked, the three
-- failures) may replace each other.
--
-- Returns:
--   applied        the row now carries this event's status
--   kept           the row is already further along; the event is history
--   unknown-email  no logged message carries this provider id
create or replace function public.apply_email_delivery(
  p_provider_id text,
  p_status text,
  p_status_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.email_log%rowtype;
  v_new int;
  v_current int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Delivery events are applied by the server only' using errcode = '42501';
  end if;

  v_new := case p_status
    when 'sent' then 1
    when 'delayed' then 1
    when 'delivered' then 2
    when 'opened' then 3
    when 'clicked' then 3
    when 'bounced' then 4
    when 'failed' then 4
    when 'complained' then 4
    else null end;
  if v_new is null then
    raise exception 'Unknown delivery status: %', p_status using errcode = '22000';
  end if;

  select * into v_row from public.email_log
   where provider_id = p_provider_id
   for update;
  if not found then
    return 'unknown-email';
  end if;

  v_current := case v_row.status
    when 'sent' then 1
    when 'delayed' then 1
    when 'delivered' then 2
    when 'opened' then 3
    when 'clicked' then 3
    when 'bounced' then 4
    when 'failed' then 4
    when 'complained' then 4
    else 0 end;

  if v_current > v_new then
    return 'kept';
  end if;

  update public.email_log
     set status = p_status,
         status_at = p_status_at
   where id = v_row.id;
  return 'applied';
end;
$$;

-- Supabase's default privileges hand new functions to anon and
-- authenticated by name, so each is revoked by name: this function's caller
-- is the webhook route alone, through the service role.
revoke all on function public.apply_email_delivery(text, text, timestamptz) from public;
revoke execute on function public.apply_email_delivery(text, text, timestamptz) from anon;
revoke execute on function public.apply_email_delivery(text, text, timestamptz) from authenticated;
grant execute on function public.apply_email_delivery(text, text, timestamptz) to service_role;
