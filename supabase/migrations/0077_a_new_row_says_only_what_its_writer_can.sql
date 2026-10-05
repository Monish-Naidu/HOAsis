-- What 0068 left a new request and a new post free to claim.
--
-- 0068 made a new row start at the beginning: submitted, undecided,
-- pending. It did not look at what else a request carried in from the
-- browser, or at the name on a post:
--
--   a request's thread could arrive with the board already speaking in it
--     ("Approved by the President"), on the page both sides read;
--   submitted_on could be any day, so a request could arrive sixty days
--     old with a decision deadline that had already run out;
--   a post could carry any neighbour's name and home.
--
-- The app sends every one of these columns, so none can simply be closed.
-- Each is held to what the app really sends (src/lib/app-state.tsx,
-- addRequest and addPost, and the two forms that call addRequest):
--
--   the thread a request arrives with holds the owner's note and the
--     system's line, never the board's voice. Refused otherwise; no screen
--     sends one;
--   submitted_on within a day of today is kept. Anything else becomes
--     today, and due_on moves by the same number of days so the clock
--     keeps its length. This one is corrected and not refused, because a
--     tab left open since last week sends last week's date in good faith,
--     and the person filing should not be turned away for it;
--   a post is signed with the name and home of a seat its author holds.
--     What was sent is kept when it is one of theirs; otherwise the row
--     takes their seat's. Also corrected and not refused, for the same
--     reason: a name the board changed an hour ago is not a forgery.
--
-- The two corrections only apply when somebody is signed in. The server
-- and the seed scripts have no signed-in person and write what they mean.
--
-- Still the browser's word, on purpose: how long the decision clock runs
-- (due_on, counted from the day of filing) and the sentence that explains
-- it (due_reason). The stock forms and their days ship in the app, not in
-- a table, so the database has nothing to hold them to yet. It is held to
-- one thing: a deadline, when there is one, falls after the day of filing.
-- Without that a request could still arrive with its clock already run
-- out, by sending today's date and a deadline in the past. The app sends
-- no deadline, or the day of filing plus the form's days (fill-form.tsx),
-- and the correction above moves both dates together, so nothing it sends
-- is refused.
--
-- requests_file is copied whole from 0068, the latest, with the thread
-- condition and the deadline condition added. posts_write and violation_reports_file are not touched:
-- the trigger does the work for posts.

-- ----------------------------------------------------------------- requests

create or replace function requests_arrive_today()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_today date := current_date;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- A day either side is the same day somewhere: current_date is UTC, and
  -- the browser's date is whatever it was when the page loaded.
  if new.submitted_on is null
     or new.submitted_on < v_today - 1
     or new.submitted_on > v_today + 1 then
    if new.due_on is not null and new.submitted_on is not null then
      new.due_on := new.due_on + (v_today - new.submitted_on);
    end if;
    new.submitted_on := v_today;
  end if;

  return new;
end;
$$;

-- Named to run before requests_free_reference (triggers fire in name
-- order), which reads submitted_on for the year in a request's number.
drop trigger if exists requests_arrive_today on requests;
create trigger requests_arrive_today
  before insert on requests
  for each row execute function requests_arrive_today();

drop policy if exists requests_file on requests;
create policy requests_file on requests
  for insert with check (
    unit_id in (select my_unit_ids())
    and association_id = (select u.association_id from units u where u.id = unit_id)
    and filed_by = auth.uid()
    and status = 'submitted'
    and decided_on is null
    and decided_by is null
    and decided_note is null
    and certificate_id is null
    and work_order is null
    and (due_on is null or due_on > submitted_on)
    and jsonb_typeof(thread) = 'array'
    and not exists (
      select 1
        from jsonb_array_elements(
               case when jsonb_typeof(thread) = 'array' then thread else '[]'::jsonb end
             ) as said
       where coalesce(said ->> 'actorRole', '') not in ('resident', 'system')
    )
  );

-- -------------------------------------------------------------------- posts

-- Security definer: it reads the author's own seat, and must find it
-- whatever the policies on memberships and units come to say.
create or replace function posts_sign_as_seat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_label text;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- The seat that matches what was sent, if there is one, so somebody with
  -- two homes posts from the one they chose. Otherwise their first.
  select m.full_name, u.label
    into v_name, v_label
    from memberships m
    join units u on u.id = m.unit_id
   where m.association_id = new.association_id
     and m.profile_id = auth.uid()
     and m.ends_on is null
   order by coalesce(m.full_name = new.author_name and u.label = new.unit_label, false) desc,
            m.starts_on, m.id
   limit 1;

  -- No seat here at all: posts_write refuses the row.
  if not found then
    return new;
  end if;

  new.author_name := v_name;
  new.unit_label := v_label;
  return new;
end;
$$;

drop trigger if exists posts_sign_as_seat on posts;
create trigger posts_sign_as_seat
  before insert on posts
  for each row execute function posts_sign_as_seat();
