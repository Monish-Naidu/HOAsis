-- Where a violation started, and when it ended.
--
-- The Violations screen has filtered by source (a neighbour's report, the
-- board's own observation, a city or county notice) since 0018, and a city
-- notice carries an agency and a case number. None of that had a column, so
-- a logged city notice came back from the database as a board notice with
-- no agency, and a resolved one lost the day it was resolved.

alter table violations
  add column if not exists source      text not null default 'board'
    check (source in ('neighbor', 'board', 'city')),
  add column if not exists agency      text,
  add column if not exists case_number text,
  add column if not exists resolved_on date;

-- Notices raised from a report before this migration started with a neighbour.
update violations set source = 'neighbor' where report_id is not null and source = 'board';
