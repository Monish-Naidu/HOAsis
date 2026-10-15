-- Row counts per table, the same query against source and target; the
-- migrate job prints both and the diff is the proof the data arrived.
select n.nspname || '.' || c.relname as "table", c.reltuples::bigint as estimate,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint as rows
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public', 'auth', 'storage', 'supabase_migrations')
  and c.relname not in ('objects', 'prefixes')
order by 1;
