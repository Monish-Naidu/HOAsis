#!/usr/bin/env bash
# Builds the web image in Azure Container Registry (no Docker needed here)
# and moves the Container App to it. Run by GitHub Actions on every merge to
# main, or by hand: scripts/azure/deploy.sh [tag]
#
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are read
# from the running app and passed as build arguments; the app is the one
# place they are set.
set -euo pipefail
source "$(dirname "$0")/config.sh"
require_login

tag="${1:-$(git -C "$ROOT" rev-parse --short HEAD)}"
acr="$(acr_name)"
image="$acr.azurecr.io/hoasis-web:$tag"

args=()
for name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
            NEXT_PUBLIC_SITE_HOST NEXT_PUBLIC_AUTH_COOKIE_DOMAIN NEXT_PUBLIC_TEST_LOGINS NEXT_PUBLIC_APP_ENV; do
  value=$(az containerapp show -g "$AZ_RG" -n "$AZ_WEB_APP" \
    --query "properties.template.containers[0].env[?name=='$name'].value | [0]" -o tsv)
  if [ "$name" = NEXT_PUBLIC_TEST_LOGINS ]; then
    # JSON with spaces; the Dockerfile decodes it.
    args+=(--build-arg "NEXT_PUBLIC_TEST_LOGINS_B64=$(printf %s "$value" | base64 | tr -d '\n')")
  else
    args+=(--build-arg "$name=$value")
  fi
done

echo "Building $image"
az acr build --registry "$acr" --image "hoasis-web:$tag" --file "$ROOT/Dockerfile" "${args[@]}" "$ROOT" --only-show-errors

previous_revision=$(az containerapp show -g "$AZ_RG" -n "$AZ_WEB_APP" \
  --query "properties.latestRevisionName" -o tsv --only-show-errors)
echo "Rolling $AZ_WEB_APP to $tag"
revision=$(az containerapp update -g "$AZ_RG" -n "$AZ_WEB_APP" --image "$image" --only-show-errors \
  --query "properties.latestRevisionName" -o tsv)

# A shared hostname can still serve the old revision while its replacement fails.
node "$ROOT/scripts/azure/wait-for-rollout.mjs" \
  "$AZ_RG" "$AZ_WEB_APP" "$revision" "$image" "$previous_revision"
