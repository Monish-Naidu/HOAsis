#!/usr/bin/env bash
# Copies the hosted Supabase database into the Azure server, from inside
# Azure, as a Container Apps job built from infra/dbtools. Reads nothing from
# the hosted project but the data; writes nothing to it.
#
#   scripts/azure/db-migrate.sh            # rehearsal: fill the Azure server, keep the app where it is
#   RESET=1 scripts/azure/db-migrate.sh    # empty the Azure server first (a rehearsal run again)
#   DUMP_ONLY=1 scripts/azure/db-migrate.sh  # just prove the dump works
#
# The real cut-over is this same command after the app has been put into
# maintenance (docs/azure-migration-plan.md, "The cut-over night").
set -euo pipefail
source "$(dirname "$0")/config.sh"
require_login

acr="$(acr_name)"; kv="$(kv_name)"
vault_uri=$(az keyvault show -n "$kv" --query properties.vaultUri -o tsv)
identity_id=$(az identity show -g "$AZ_RG" -n "id-$AZ_BASE-app" --query id -o tsv)
image="$acr.azurecr.io/hoasis-dbtools:latest"

# The auth and storage services run their own schema migrations when they
# start, which would collide with the restore. Stop the app for the duration.
stack_was_running=false
if az containerapp show -g "$AZ_RG" -n "$AZ_SUPABASE_APP" -o none 2>/dev/null; then
  echo "== stopping $AZ_SUPABASE_APP for the copy"
  az containerapp stop -g "$AZ_RG" -n "$AZ_SUPABASE_APP" --only-show-errors -o none
  stack_was_running=true
fi
restart_stack() {
  if [ "$stack_was_running" = true ]; then
    echo "== starting $AZ_SUPABASE_APP"
    az containerapp start -g "$AZ_RG" -n "$AZ_SUPABASE_APP" --only-show-errors -o none
  fi
}
trap restart_stack EXIT

echo "== job $AZ_MIGRATE_JOB"
if ! az containerapp job show -g "$AZ_RG" -n "$AZ_MIGRATE_JOB" -o none 2>/dev/null; then
  az containerapp job create -g "$AZ_RG" -n "$AZ_MIGRATE_JOB" --environment "$AZ_ENV" \
    --trigger-type Manual --replica-timeout 3600 --replica-retry-limit 0 --parallelism 1 --replica-completion-count 1 \
    --image "$image" --cpu 0.5 --memory 1Gi \
    --mi-user-assigned "$identity_id" --registry-identity "$identity_id" --registry-server "$acr.azurecr.io" \
    --secrets "source=keyvaultref:${vault_uri}secrets/migrate-source-url,identityref:$identity_id" \
              "target=keyvaultref:${vault_uri}secrets/migrate-target-url,identityref:$identity_id" \
              "services=keyvaultref:${vault_uri}secrets/pg-services-password,identityref:$identity_id" \
    --env-vars SOURCE_URL=secretref:source TARGET_URL=secretref:target SERVICES_PASSWORD=secretref:services \
               "RESET=${RESET:-0}" "DUMP_ONLY=${DUMP_ONLY:-0}" \
    --only-show-errors -o none
else
  az containerapp job update -g "$AZ_RG" -n "$AZ_MIGRATE_JOB" --image "$image" \
    --set-env-vars "RESET=${RESET:-0}" "DUMP_ONLY=${DUMP_ONLY:-0}" --only-show-errors -o none
fi

echo "== start"
execution=$(az containerapp job start -g "$AZ_RG" -n "$AZ_MIGRATE_JOB" --query name -o tsv)
echo "   execution $execution"
for _ in $(seq 1 120); do
  status=$(az containerapp job execution show -g "$AZ_RG" -n "$AZ_MIGRATE_JOB" --job-execution-name "$execution" --query properties.status -o tsv)
  case "$status" in
    Succeeded|Failed|Stopped) break ;;
  esac
  sleep 15
done
echo "   $status"
echo "== output"
az containerapp job logs show -g "$AZ_RG" -n "$AZ_MIGRATE_JOB" --execution "$execution" --container "$AZ_MIGRATE_JOB" --format text --tail 300 2>/dev/null \
  || echo "Logs reach Log Analytics a minute or two later: az containerapp job logs show -g $AZ_RG -n $AZ_MIGRATE_JOB --execution $execution --format text"
[ "$status" = "Succeeded" ]
