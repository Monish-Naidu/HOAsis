#!/bin/sh
# Copies the Supabase project into the Azure Postgres server.
#
#   SOURCE_URL   the hosted project, through its pooler (read only here)
#   TARGET_URL   the Azure server, as postgres
#   SERVICES_PASSWORD  the password the three service roles get
#   RESET=1      empty the target first (a rehearsal run again)
#   DUMP_ONLY=1  stop after the dump and print its size (a dry run)
#
# The storage.objects rows are left out on purpose: scripts/azure/copy-storage.mjs
# uploads every file through the new storage service, which writes those rows
# itself. Everything else, including auth.users and the sessions, comes across
# as it is, so nobody is signed out by the move.
set -eu

: "${SOURCE_URL:?set SOURCE_URL}" "${TARGET_URL:?set TARGET_URL}" "${SERVICES_PASSWORD:?set SERVICES_PASSWORD}"
dump=/tmp/hoasis.pgc

echo "== source version";  psql "$SOURCE_URL" -Atc 'select version()'
echo "== target version";  psql "$TARGET_URL" -Atc 'select version()'

if [ "${RESET:-0}" = "1" ]; then
  echo "== reset target"; psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f /sql/00-reset.sql
fi

echo "== roles and schemas"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -v services_password="$SERVICES_PASSWORD" -f /sql/01-roles.sql

echo "== dump"
pg_dump "$SOURCE_URL" --format=custom --no-owner --no-comments \
  --schema=public --schema=auth --schema=storage --schema=supabase_migrations \
  --exclude-table-data='storage.objects' --exclude-table-data='storage.prefixes' \
  --exclude-table-data='storage.s3_multipart_uploads*' \
  --file="$dump"
ls -l "$dump"
if [ "${DUMP_ONLY:-0}" = "1" ]; then exit 0; fi

echo "== restore (errors listed, then counted)"
set +e
pg_restore --dbname="$TARGET_URL" --no-owner --format=custom "$dump" 2>/tmp/restore.err
status=$?
set -e
grep -v "^pg_restore: warning" /tmp/restore.err | sed -n 1,80p || true
echo "restore exit $status; $(grep -c 'error' /tmp/restore.err || true) error lines (grants to roles that own nothing here are expected)"

echo "== after restore"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -f /sql/02-after-restore.sql

echo "== row counts, source"; psql "$SOURCE_URL" -At -f /sql/03-check.sql | tee /tmp/source.txt
echo "== row counts, target"; psql "$TARGET_URL" -At -f /sql/03-check.sql | tee /tmp/target.txt
echo "== differences (none is the goal)"
cut -d'|' -f1,3 /tmp/source.txt > /tmp/source.rows
cut -d'|' -f1,3 /tmp/target.txt > /tmp/target.rows
diff /tmp/source.rows /tmp/target.rows && echo "row counts match"
