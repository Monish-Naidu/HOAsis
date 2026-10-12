#!/bin/sh
# One statement against the Azure server, for the runbook's one-off fixes.
# The statement travels base64-encoded, because a job's environment value
# with spaces and commas does not survive the command line intact:
#   az containerapp job start -g rg-hoasis -n caj-hoasis-migrate --image <tools image> --command sql \
#     --env-vars "SQL_B64=$(printf %s "notify pgrst, 'reload schema'" | base64 | tr -d '\n')"
# TARGET_URL comes from the job's Key Vault reference.
set -eu
: "${TARGET_URL:?set TARGET_URL}" "${SQL_B64:?set SQL_B64}"
sql=$(printf %s "$SQL_B64" | base64 -d)
echo "running: $sql"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c "$sql"
echo "done"
