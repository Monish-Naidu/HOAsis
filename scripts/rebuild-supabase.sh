#!/usr/bin/env bash
#
# The whole database, from nothing, in one go.
#
# Written 2026-09-19, the day the Supabase project turned out to be gone.
# Runs setup-supabase.sh (create, link, push every migration, write
# .env.local, regenerate types), then the parts that script never did:
# auth URLs for the production site, the seed accounts, the Vercel
# environment, and the verifiers. Needs a fresh personal access token in
# .env.local as SUPABASE_ACCESS_TOKEN, and `vercel` logged in.
#
#   scripts/rebuild-supabase.sh [project-name] [region]
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-expresshoa}"
REGION="${2:-us-west-1}"
SITE_URL="${SITE_URL:-https://expresshoa.com}"
# The seed accounts keep the password everybody already has written down.
export SEED_PASSWORD="${SEED_PASSWORD:-Expresshoa-2026-xfpa8v}"

scripts/setup-supabase.sh "$NAME" "$REGION"

set -a; source .env.local; set +a
REF="$(sed -n 's|^NEXT_PUBLIC_SUPABASE_URL=https://\([a-z0-9]*\)\.supabase\.co$|\1|p' .env.local)"
echo "==> Auth URLs for $SITE_URL on $REF"
curl -sf -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(python3 - "$SITE_URL" <<'PY'
import json, sys
site = sys.argv[1]
print(json.dumps({
    "site_url": site,
    "uri_allow_list": ",".join([
        f"{site}/**",
        "http://localhost:3000/**",
        "https://*-monish-naidus-projects.vercel.app/**",
    ]),
    "mailer_autoconfirm": False,
}))
PY
)" > /dev/null && echo "auth config set"

echo "==> Seeding Oakview Commons and Cedar Hollow"
pnpm db:seed

echo "==> Vercel environment"
for env in production preview development; do
  for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
    vercel env rm "$key" "$env" --yes > /dev/null 2>&1 || true
    printf '%s' "${!key}" | vercel env add "$key" "$env" > /dev/null
  done
done
echo "Vercel has the new keys. Redeploy: vercel --prod, or push to main."

echo "==> Verifying"
pnpm db:verify

echo
echo "Done. Sign in at $SITE_URL/signin with monishnaidu18@gmail.com and the seed password."
