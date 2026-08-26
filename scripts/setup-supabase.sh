#!/usr/bin/env bash
#
# Stands up the Supabase project and pushes the schema.
#
# Run after `npx supabase login`. Everything here is idempotent enough to
# re-run: creating a project that already exists will fail loudly rather than
# make a second one, and `db push` only applies migrations that have not run.
set -euo pipefail

NAME="${1:-hoasis}"
REGION="${2:-us-west-1}"

cd "$(dirname "$0")/.."

if ! npx supabase projects list --output json >/dev/null 2>&1; then
  echo "Not logged in. Run:  npx supabase login" >&2
  exit 1
fi

echo "==> Organizations"
npx supabase orgs list

ORG_ID="$(npx supabase orgs list --output json | python3 -c '
import json,sys
rows = json.load(sys.stdin)
print(rows[0]["id"] if rows else "")
')"

if [ -z "$ORG_ID" ]; then
  echo "No organization found on this account." >&2
  exit 1
fi

# The database password is generated here rather than chosen, so it is strong
# and so nobody has to invent one. It lands in .env.local, which is gitignored.
DB_PASSWORD="$(python3 -c '
import secrets, string
alphabet = string.ascii_letters + string.digits
print("".join(secrets.choice(alphabet) for _ in range(32)))
')"

echo "==> Creating project $NAME in $REGION"
npx supabase projects create "$NAME" \
  --org-id "$ORG_ID" \
  --db-password "$DB_PASSWORD" \
  --region "$REGION" \
  --output json > .supabase-project.json

REF="$(python3 -c '
import json
print(json.load(open(".supabase-project.json"))["id"])
')"

echo "==> Project ref: $REF"
echo "==> Waiting for the database to come up"
for _ in $(seq 1 60); do
  if npx supabase projects api-keys --project-ref "$REF" --output json >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

echo "==> Linking"
npx supabase link --project-ref "$REF" --password "$DB_PASSWORD"

echo "==> Pushing the schema"
npx supabase db push --password "$DB_PASSWORD"

echo "==> Writing .env.local"
KEYS="$(npx supabase projects api-keys --project-ref "$REF" --output json)"
python3 - "$REF" "$DB_PASSWORD" <<'PY'
import json, sys, subprocess, pathlib

ref, db_password = sys.argv[1], sys.argv[2]
keys = json.loads(
    subprocess.run(
        ["npx", "supabase", "projects", "api-keys", "--project-ref", ref, "--output", "json"],
        capture_output=True, text=True, check=True,
    ).stdout
)
by_name = {k.get("name"): k.get("api_key") for k in keys}
anon = by_name.get("anon") or by_name.get("publishable")
service = by_name.get("service_role") or by_name.get("secret")

path = pathlib.Path(".env.local")
existing = path.read_text() if path.exists() else ""
lines = [line for line in existing.splitlines() if not line.startswith((
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_PASSWORD",
))]
lines += [
    f"NEXT_PUBLIC_SUPABASE_URL=https://{ref}.supabase.co",
    f"NEXT_PUBLIC_SUPABASE_ANON_KEY={anon}",
    f"SUPABASE_SERVICE_ROLE_KEY={service}",
    f"SUPABASE_DB_PASSWORD={db_password}",
]
path.write_text("\n".join(lines) + "\n")
print("Wrote .env.local")
PY

echo "==> Generating types"
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts

rm -f .supabase-project.json
echo
echo "Done. Save the database password from .env.local into your password manager."
