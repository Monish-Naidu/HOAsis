-- Two officers approving the same vendor payment no longer lose one approval.
--
-- The browser read the payment, added its own name to the list of approvals,
-- and wrote the whole list back. Two officers on two computers each read an
-- empty list and each wrote a list of one: the second write replaced the
-- first, the payment sat at "1 of 2" and somebody had to approve again. The
-- list also knew its signers only by name, so two board members called Pat
-- were one approval.
--
-- approve_payout takes the row lock, adds the caller once (by account, with
-- the name the register has for them), and moves the payment to scheduled
-- when it has the approvals it asked for. It returns the list as it now
-- stands. Approvals written before this carry no account id and are matched
-- by name, as they always were.

create or replace function approve_payout(p_payout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_payout    payouts%rowtype;
  v_name      text;
  v_approvals jsonb;
begin
  if v_caller is null then
    raise exception 'Sign in to approve a payment' using errcode = '42501';
  end if;

  select * into v_payout from payouts where id = p_payout_id for update;
  if not found then
    raise exception 'No such payment' using errcode = '23503';
  end if;
  if not has_capability(v_payout.association_id, 'finances') then
    raise exception 'You cannot approve payments for this association' using errcode = '42501';
  end if;

  select m.full_name into v_name
    from memberships m
   where m.association_id = v_payout.association_id
     and m.profile_id = v_caller
     and m.ends_on is null
   order by m.starts_on
   limit 1;
  if v_name is null then
    raise exception 'You do not hold a seat in this association' using errcode = '42501';
  end if;

  -- Already signed: nothing changes and the list is handed back, so a
  -- second press is quiet rather than an error.
  if exists (
    select 1 from jsonb_array_elements(v_payout.approvals) a
     where a ->> 'profileId' = v_caller::text
        or (a ->> 'profileId' is null and a ->> 'name' = v_name)
  ) then
    return v_payout.approvals;
  end if;

  v_approvals := v_payout.approvals || jsonb_build_array(jsonb_build_object(
    'name', v_name,
    'at', to_char(current_date, 'YYYY-MM-DD'),
    'profileId', v_caller
  ));

  update payouts
     set approvals = v_approvals,
         status = case
           when status = 'needs-approval' and jsonb_array_length(v_approvals) >= approvals_required
             then 'scheduled'
           else status
         end
   where id = v_payout.id;

  return v_approvals;
end;
$$;

revoke all on function approve_payout(uuid) from public;
revoke execute on function approve_payout(uuid) from anon;
grant execute on function approve_payout(uuid) to authenticated;
grant execute on function approve_payout(uuid) to service_role;
