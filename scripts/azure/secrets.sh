#!/usr/bin/env bash
# Puts every secret from .env.azure into Key Vault, under the names
# infra/apps.bicep references. Also composes the three service connection
# strings for the Supabase stack and the source and target strings for the
# migration. Safe to run again; a changed value makes a new version and the
# apps pick it up on their next revision.
set -euo pipefail
source "$(dirname "$0")/config.sh"
require_login
require_env_file

kv="$(kv_name)"
pg="$(pg_host)"
[ -n "$kv" ] && [ -n "$pg" ] || { echo "Run provision.sh first." >&2; exit 1; }

# A role granted a moment ago takes up to a few minutes to apply.
for i in $(seq 1 16); do
  if az keyvault secret list --vault-name "$kv" --only-show-errors -o none 2>/dev/null; then break; fi
  [ "$i" = 16 ] && { echo "No access to $kv after four minutes; is Key Vault Secrets Officer granted?" >&2; exit 1; }
  echo "  waiting for vault access ($i)"; sleep 15
done

put() { # name value
  if [ -z "$2" ]; then
    # The app references every secret by name at start, so an empty one still
    # needs a version to resolve. The placeholder fails any check that uses it
    # (a webhook signature, say), which is the right outcome until it is set.
    if az keyvault secret show --vault-name "$kv" --name "$1" -o none 2>/dev/null; then echo "  keep  $1 (empty here, already in the vault)"; return; fi
    az keyvault secret set --vault-name "$kv" --name "$1" --value "unset" --content-type "placeholder, not yet set" --only-show-errors --query name -o tsv | sed 's/^/  blank /'
    return
  fi
  az keyvault secret set --vault-name "$kv" --name "$1" --value "$2" --only-show-errors --query name -o tsv | sed 's/^/  set   /'
}

# The service roles share one generated password, kept here and nowhere else.
services_password=$(az keyvault secret show --vault-name "$kv" --name pg-services-password --query value -o tsv 2>/dev/null || true)
if [ -z "$services_password" ]; then
  services_password=$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)
  put pg-services-password "$services_password"
fi
admin_password=$(az keyvault secret show --vault-name "$kv" --name pg-admin-password --query value -o tsv)
# The credential the storage service presents to its S3 proxy; internal to one replica.
if ! az keyvault secret show --vault-name "$kv" --name s3proxy-secret -o none 2>/dev/null; then
  put s3proxy-secret "$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)"
fi

put supabase-service-role-key "$(read_env SUPABASE_SERVICE_ROLE_KEY)"
put stripe-secret-key "$(read_env STRIPE_SECRET_KEY)"
put stripe-webhook-secret "$(read_env STRIPE_WEBHOOK_SECRET)"
put stripe-billing-webhook-secret "$(read_env STRIPE_BILLING_WEBHOOK_SECRET)"
put cron-secret "$(read_env CRON_SECRET)"
put resend-api-key "$(read_env RESEND_API_KEY)"
put email-token-secret "$(read_env EMAIL_TOKEN_SECRET)"
put jwt-secret "$(read_env SUPABASE_JWT_SECRET)"

put auth-db-url "postgres://supabase_auth_admin:${services_password}@${pg}:5432/postgres?sslmode=require&search_path=auth"
put rest-db-url "postgres://authenticator:${services_password}@${pg}:5432/postgres?sslmode=require"
put storage-db-url "postgres://supabase_storage_admin:${services_password}@${pg}:5432/postgres?sslmode=require"
put migrate-target-url "postgres://postgres:${admin_password}@${pg}:5432/postgres?sslmode=require"

ref="$(read_env SUPABASE_PROJECT_REF)"; pooler="$(read_env SUPABASE_POOLER_HOST)"; dbpw="$(read_env SUPABASE_DB_PASSWORD)"
if [ -n "$ref" ] && [ -n "$dbpw" ]; then
  # Session mode (5432) on the pooler: the direct host is IPv6 only and
  # Container Apps egress is IPv4.
  put migrate-source-url "postgres://postgres.${ref}:${dbpw}@${pooler}:5432/postgres?sslmode=require"
fi
echo "Key Vault $kv is current."
