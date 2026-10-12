#!/usr/bin/env bash
# Names shared by every script in this folder. Sourced, not run.
# Globally unique names (registry, vault, server) are derived in Bicep and
# looked up here by tag, so nothing has to be copied between files.
export AZ_RG="${AZ_RG:-rg-hoasis}"
export AZ_LOCATION="${AZ_LOCATION:-westus}"
export AZ_BASE="hoasis"
export AZ_WEB_APP="ca-${AZ_BASE}-web"
export AZ_SUPABASE_APP="ca-${AZ_BASE}-supabase"
export AZ_ENV="cae-${AZ_BASE}"
export AZ_MIGRATE_JOB="caj-${AZ_BASE}-migrate"
export PATH="$HOME/.local/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ROOT
export ENV_FILE="${ENV_FILE:-$ROOT/.env.azure}"

# Reads KEY=value lines; quotes optional. Never printed.
read_env() {
  local key="$1" line
  line=$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}

require_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE. Copy .env.azure.example and fill it in." >&2
    exit 1
  fi
}

require_login() {
  if ! az account show >/dev/null 2>&1; then
    echo "Not signed in. Run: az login --use-device-code" >&2
    exit 1
  fi
  echo "Subscription: $(az account show --query '[name, id]' -o tsv | paste -sd' ' -)"
}

acr_name()  { az acr list -g "$AZ_RG" --query "[?tags.product=='$AZ_BASE'].name | [0]" -o tsv; }
kv_name()   { az keyvault list -g "$AZ_RG" --query "[?tags.product=='$AZ_BASE'].name | [0]" -o tsv; }
pg_host()   { az postgres flexible-server list -g "$AZ_RG" --query "[0].fullyQualifiedDomainName" -o tsv; }
web_fqdn()  { az containerapp show -g "$AZ_RG" -n "$AZ_WEB_APP" --query properties.configuration.ingress.fqdn -o tsv; }
supabase_fqdn() { az containerapp show -g "$AZ_RG" -n "$AZ_SUPABASE_APP" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || true; }
