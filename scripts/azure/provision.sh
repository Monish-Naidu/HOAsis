#!/usr/bin/env bash
# Creates or updates everything on Azure, in order:
#   1. the resource group and the platform (registry, vault, Postgres, files, environment, identities, budget)
#   2. the secrets (secrets.sh)
#   3. the two images, built in the registry
#   4. the apps and jobs
# Safe to run again; Bicep only changes what differs. Needs: az login first.
#
#   WITH_SUPABASE_STACK=false scripts/azure/provision.sh   # phase 1: app only, database stays hosted
#   scripts/azure/provision.sh                              # phase 2: adds the Supabase services; web app still on the hosted database
#   WEB_ON_AZURE_DB=true scripts/azure/provision.sh         # after the data has moved: web app on the Azure stack
#   APPS_ONLY=true scripts/azure/provision.sh               # a settings or gateway change: apps and jobs only, same image
set -euo pipefail
source "$(dirname "$0")/config.sh"
require_login
require_env_file

# Writes an ARM parameters file from key=value pairs. A file, not --parameters
# on the command line, because the CLI would parse the test logins (JSON) into
# an object and the template wants a string. Booleans are the word true or
# false; only the custom domains list is JSON, by name.
params() {
  local out="$1"; shift
  python3 - "$out" "$@" <<'PY'
import json, sys
out, pairs = sys.argv[1], sys.argv[2:]
values = {}
for pair in pairs:
    key, _, value = pair.partition("=")
    if key in ("webCustomDomains",):
        values[key] = {"value": json.loads(value or "[]")}
    else:
        values[key] = {"value": {"true": True, "false": False}.get(value, value)}
json.dump({"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
           "contentVersion": "1.0.0.0", "parameters": values}, open(out, "w"))
PY
}

# One output of a deployment, from the file its outputs were written to.
out() { python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))[sys.argv[2]]["value"])' "$1" "$2"; }

with_stack="${WITH_SUPABASE_STACK:-true}"
budget_email="$(read_env BUDGET_EMAIL)"
[ -n "$budget_email" ] || { echo "BUDGET_EMAIL is empty in $ENV_FILE" >&2; exit 1; }

# The addresses, once the environment's domain is known (both paths below).
urls() {
  # The stack's own address is known before it exists: app name plus the
  # environment's domain. The web app keeps talking to the hosted project
  # until WEB_ON_AZURE_DB=true, the switch flipped after the data has moved.
  stack_url="https://$AZ_SUPABASE_APP.$env_domain"
  web_url="https://$AZ_WEB_APP.$env_domain"
  # Where the auth service may send a person after a magic link or a reset:
  # the product's domain, this deployment's own address, the site host if
  # one is set, and a laptop.
  site_host="$(read_env NEXT_PUBLIC_SITE_HOST)"
  allow_list="https://yourhoasis.com/**,https://www.yourhoasis.com/**,$web_url/**,http://localhost:3000/**"
  [ -n "$site_host" ] && allow_list="https://$site_host/**,$allow_list"
  supabase_url="$(read_env NEXT_PUBLIC_SUPABASE_URL)"
  if [ "$with_stack" = "true" ] && [ "${WEB_ON_AZURE_DB:-false}" = "true" ]; then
    supabase_url="$stack_url"
  fi
}

# APPS_ONLY=true redeploys the apps and jobs from the templates with the
# image already running: for a change to a setting, the gateway's config or
# a service version, without the platform pass, the secrets or a build.
if [ "${APPS_ONLY:-false}" = "true" ]; then
  work=$(mktemp -d)
  az deployment group show -g "$AZ_RG" -n platform --query "properties.outputs" -o json > "$work/platform-out.json"
  acr=$(out "$work/platform-out.json" acrName)
  kv=$(out "$work/platform-out.json" keyVaultName)
  env_domain=$(out "$work/platform-out.json" environmentDomain)
  github_client=$(out "$work/platform-out.json" githubClientId)
  storage_account=$(out "$work/platform-out.json" storageAccountName)
  web_image=$(az containerapp show -g "$AZ_RG" -n "$AZ_WEB_APP" --query "properties.template.containers[0].image" -o tsv)
  urls
  echo "== apps and jobs only, web image $web_image"
fi

if [ "${APPS_ONLY:-false}" != "true" ]; then
echo "== 1. platform in $AZ_RG ($AZ_LOCATION)"
az group create -n "$AZ_RG" -l "$AZ_LOCATION" --tags product=$AZ_BASE --only-show-errors -o none
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.KeyVault \
          Microsoft.DBforPostgreSQL Microsoft.Storage Microsoft.ManagedIdentity Microsoft.Consumption; do
  az provider register -n "$ns" --only-show-errors -o none || true
done

# The administrator password is minted once and then read back from the vault.
existing_kv="$(kv_name || true)"
pg_password=""
if [ -n "$existing_kv" ]; then
  pg_password=$(az keyvault secret show --vault-name "$existing_kv" --name pg-admin-password --query value -o tsv 2>/dev/null || true)
fi
[ -n "$pg_password" ] || pg_password=$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)
client_ip=$(curl -fsS --max-time 5 https://api.ipify.org || true)

work=$(mktemp -d)
params "$work/platform.json" postgresAdminPassword="$pg_password" clientIp="$client_ip" budgetEmail="$budget_email"
az deployment group create -g "$AZ_RG" -n platform --template-file "$ROOT/infra/platform.bicep" \
  --parameters "@$work/platform.json" --only-show-errors --query "properties.outputs" -o json > "$work/platform-out.json"
acr=$(out "$work/platform-out.json" acrName)
kv=$(out "$work/platform-out.json" keyVaultName)
env_domain=$(out "$work/platform-out.json" environmentDomain)
github_client=$(out "$work/platform-out.json" githubClientId)
storage_account=$(out "$work/platform-out.json" storageAccountName)
echo "   registry $acr, vault $kv, environment domain $env_domain"
urls

# The vault is in RBAC mode, which means even the subscription owner needs a
# data-plane role to write a secret. Grant it to whoever is running this.
me=$(az ad signed-in-user show --query id -o tsv 2>/dev/null || az account show --query user.name -o tsv)
kv_id=$(az keyvault show -n "$kv" -g "$AZ_RG" --query id -o tsv)
az role assignment create --assignee "$me" --role "Key Vault Secrets Officer" --scope "$kv_id" --only-show-errors -o none 2>/dev/null || true

echo "== 2. secrets"
"$ROOT/scripts/azure/secrets.sh"

echo "== 3. images"
tag=$(git -C "$ROOT" rev-parse --short HEAD)
az acr build --registry "$acr" --image "hoasis-dbtools:$tag" --image "hoasis-dbtools:latest" --file "$ROOT/infra/dbtools/Dockerfile" "$ROOT/infra" --only-show-errors -o none
build_args=(
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=$supabase_url"
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(read_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  --build-arg "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$(read_env NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)"
  --build-arg "NEXT_PUBLIC_SENTRY_DSN=$(read_env NEXT_PUBLIC_SENTRY_DSN)"
  --build-arg "NEXT_PUBLIC_SITE_HOST=$(read_env NEXT_PUBLIC_SITE_HOST)"
  --build-arg "NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=$(read_env NEXT_PUBLIC_AUTH_COOKIE_DOMAIN)"
  --build-arg "NEXT_PUBLIC_TEST_LOGINS_B64=$(read_env NEXT_PUBLIC_TEST_LOGINS | base64 | tr -d '\n')"
  --build-arg "NEXT_PUBLIC_APP_ENV=$(read_env APP_ENV)"
)
az acr build --registry "$acr" --image "hoasis-web:$tag" --file "$ROOT/Dockerfile" "${build_args[@]}" "$ROOT" --only-show-errors -o none
web_image="$acr.azurecr.io/hoasis-web:$tag"
fi


# A domain bound by hand (az containerapp hostname bind) lives only in the
# app's ingress; a deploy from the template would drop it. Read it back and
# pass it through.
custom_domains=$(az containerapp show -g "$AZ_RG" -n "$AZ_WEB_APP" --query "properties.configuration.ingress.customDomains" -o json 2>/dev/null || echo '[]')
[ "$custom_domains" = "null" ] && custom_domains='[]'

# The hosts a cron continuation may fetch (src/lib/cron.ts): the app's own
# address, where the five jobs point their calls, and any domain bound by
# hand, which is how a person reaches a cron route. vercel.app is always
# allowed by the code itself.
cron_hosts=$(python3 - "$AZ_WEB_APP.$env_domain" "$custom_domains" <<'PY'
import json, sys
bound = [d.get("name") for d in json.loads(sys.argv[2])]
hosts = [sys.argv[1]] + [h for h in bound if h]
print(",".join(dict.fromkeys(hosts)))
PY
)

echo "== 4. apps and jobs"
params "$work/apps.json" environmentName="$AZ_ENV" keyVaultName="$kv" appIdentityName="id-$AZ_BASE-app" \
  acrLoginServer="$acr.azurecr.io" storageAccountName="$storage_account" webImage="$web_image" \
  deploySupabaseStack="$with_stack" appEnv="$(read_env APP_ENV)" \
  supabaseUrl="$supabase_url" stackUrl="$stack_url" gotrueUriAllowList="$allow_list" supabaseAnonKey="$(read_env NEXT_PUBLIC_SUPABASE_ANON_KEY)" \
  stripePublishableKey="$(read_env NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)" sentryDsn="$(read_env NEXT_PUBLIC_SENTRY_DSN)" \
  siteHost="$(read_env NEXT_PUBLIC_SITE_HOST)" authCookieDomain="$(read_env NEXT_PUBLIC_AUTH_COOKIE_DOMAIN)" \
  emailFrom="$(read_env EMAIL_FROM)" platformOwnerEmails="$(read_env PLATFORM_OWNER_EMAILS)" \
  testLogins="$(read_env NEXT_PUBLIC_TEST_LOGINS)" webCustomDomains="$custom_domains" \
  cronAllowedHosts="$cron_hosts"
az deployment group create -g "$AZ_RG" -n apps --template-file "$ROOT/infra/apps.bicep" \
  --parameters "@$work/apps.json" --only-show-errors --query "properties.outputs" -o json > "$work/apps-out.json"
web=$(out "$work/apps-out.json" webFqdn)

rm -rf "$work"
cat <<DONE

Done.
  web        https://$web
  web's db   $supabase_url
  stack      $stack_url
  registry   $acr
  vault      $kv

GitHub Actions variables (Settings, Secrets and variables, Actions, Variables):
  AZURE_CLIENT_ID        $github_client
  AZURE_TENANT_ID        $(az account show --query tenantId -o tsv)
  AZURE_SUBSCRIPTION_ID  $(az account show --query id -o tsv)

Next: scripts/azure/db-migrate.sh  (copies the database; see docs/azure-migration-plan.md)
DONE
