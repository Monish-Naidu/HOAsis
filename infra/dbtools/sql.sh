#!/bin/sh
# One statement against the Azure server, for the runbook's one-off fixes:
#   az containerapp job start -g rg-hoasis -n caj-hoasis-migrate --command sql --env-vars "SQL=notify pgrst, 'reload schema'"
# TARGET_URL comes from the job's Key Vault reference; SQL from --env-vars.
set -eu
: "${TARGET_URL:?set TARGET_URL}" "${SQL:?set SQL}"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c "$SQL"
echo "done: $SQL"
