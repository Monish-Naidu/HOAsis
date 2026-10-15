# Moving Your HOAsis to Azure

Written 2026-10-06 as a plan; rewritten 2026-10-11 as the plan and the
runbook, when Monish said to use the $150 a month of Azure credit from
work for hosting, the database and everything else. **Phase 1 ran on the
night of 2026-10-11 to 12, phase 2 the same night, and the cut-over on
2026-10-15 at one in the morning: `yourhoasis.com` is served from Azure,
database and all.** What the runs found is under "What the first run
taught".

## The short version

- The app moves to **Azure Container Apps**, built from the `Dockerfile`
  into **Azure Container Registry**, deployed by GitHub Actions on every
  merge to `main` with no stored credential (OIDC to a managed identity).
- The five daily jobs become **Container Apps jobs** on the same UTC
  schedule, calling the same routes with the same `CRON_SECRET`.
- Secrets live in **Key Vault** and reach the containers as references; no
  secret value is in Bicep, a parameter, a workflow or a log.
- The database moves to **Azure Database for PostgreSQL Flexible Server**
  (Postgres 17, the version Supabase runs). The three Supabase services the
  code depends on (auth, the data API, file storage) are the open-source
  images Supabase itself ships, run beside the app in one Container App.
  **Every migration, policy and SQL function stays as it is.** The JWT
  secret is reused, so the anon and service keys do not change and nobody
  is signed out.
- Stripe, Resend, Sentry and Cloudflare stay. Stripe gets new webhook
  endpoints for the new host; Resend gets nothing new.
- Two phases, each reversible: the app first (database still hosted by
  Supabase), the database second. Azure is staging until the cut-over
  night; Vercel keeps serving `yourhoasis.com` until DNS is flipped.

## What runs where

| Piece      | Today                               | On Azure                                                                                    | In the repo                                 |
| ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| The site   | Vercel                              | Container App `ca-hoasis-web`, 0.5 vCPU, 1 GiB, one to three replicas                       | `Dockerfile`, `infra/apps.bicep`            |
| Daily jobs | Vercel cron (`vercel.json`)         | Five Container Apps jobs `caj-hoasis-*`, a curl each                                        | `infra/apps.bicep`                          |
| Images     | Vercel builds                       | Container Registry `crhoasis…`, built in the registry (`az acr build`, no Docker needed)    | `scripts/azure/deploy.sh`                   |
| Deploys    | Vercel git integration              | GitHub Actions `deploy to azure`, after `check` passes on `main`                            | `.github/workflows/deploy-azure.yml`        |
| Secrets    | Vercel env                          | Key Vault `kv-hoasis-…`, read by the app identity                                           | `scripts/azure/secrets.sh`                  |
| Postgres   | Supabase (us-west-2)                | Flexible Server `psql-hoasis-…`, PG 17, B1ms, 32 GiB, 7 day backups, westus                 | `infra/platform.bicep`                      |
| Sign-in    | Supabase Auth                       | GoTrue `v2.196.0`, the same server Supabase runs, with the hosted project's settings copied | `infra/apps.bicep`, container `auth`        |
| Data API   | Supabase PostgREST                  | PostgREST `v14.17`                                                                          | container `rest`                            |
| Files      | Supabase Storage (3 buckets)        | storage-api `v1.74.0`, files on an Azure Files share                                        | container `storage`, `infra/platform.bicep` |
| Front door | Supabase's Kong                     | Caddy, routing `/auth/v1`, `/rest/v1`, `/storage/v1` to the three above                     | `infra/supabase/Caddyfile`                  |
| Logs       | Vercel logs (1 hour), Supabase logs | Log Analytics `log-hoasis`, 30 days, every container and job                                | `infra/platform.bicep`                      |
| Spend      | nothing                             | A budget with emails at 50%, 80% and a forecast past 100% of $120                           | `infra/platform.bicep`                      |
| DNS        | Cloudflare                          | Cloudflare, records changed by hand on the night                                            | below                                       |

Not moved because not used: Supabase Realtime, Edge Functions, the
dashboard. Not moved because it is not ours: Stripe, Resend, Sentry.

## Why these choices

**Container Apps over App Service or Static Web Apps.** Static Web Apps
runs Next's server parts as Functions with limits that bite (run time, no
scheduler of its own) and trails Next versions; we are on 16. App Service
is fine but never idles and has no job runner. Container Apps runs the
standalone Next server as it is, bills idle replicas at a reduced rate,
has scheduled jobs, HTTPS and custom domains built in, and shares one
environment with the Supabase services.

**Self-hosted Supabase services over rewriting sign-in.** The migrations
use `auth.uid()` 125 times and `auth.role()` 36 times; the app calls 75
SQL functions through the Supabase client and Supabase Storage for photos,
documents and attachments. Replacing Supabase Auth with Entra External ID
and PostgREST with our own routes is a month of work and a second proof of
every policy. Running Supabase's own images keeps all of it, at the cost
of operating three small services. This is what Supabase documents as
self-hosting; the pieces not needed (Realtime, Studio, Kong, imgproxy,
edge runtime) are left out.

**One Container App for the services.** Gateway, auth, data API, storage
and the storage proxy share `localhost`, scale as one, and cost one
replica. A hosted Supabase project is one instance too.

**Flexible Server with a public endpoint behind the firewall.** This is
how Supabase exposes Postgres today. A private network (VNet integration
for the environment and the server) is the next hardening step; it adds
no cost but does add a subnet plan and a private DNS zone, and it would
make the migration job the only way to reach the database. Do it after
the move, not during.

**Postgres 17.** It matches the source, and on Flexible Server a
non-superuser administrator can create a role with `BYPASSRLS` from
Postgres 16 on, which `service_role` needs. On 15 it cannot, and the
server-side key would stop working.

**The administrator is named `postgres`.** The dump's grants and default
privileges name that role; restoring under the same name means they apply
as written.

**Build in the registry.** `az acr build` builds the image in Azure from
the repo checkout, so neither the laptop nor the GitHub runner needs
Docker, and the image never crosses the network.

**OIDC for GitHub.** The workflow signs in as a user-assigned identity
through a federated credential for `refs/heads/main`; there is no client
secret to rotate or leak. Its rights are Contributor on the resource group
and push on the registry. It cannot read a secret value.

## What it costs

List prices for westus, October 2026, for the month. The two Container
Apps run one replica each all the time; Container Apps bills a replica
that is not serving requests at a lower idle rate, and a pre-revenue
product is idle most of the time. The subscription's free grant (180,000
vCPU-seconds, 360,000 GiB-seconds a month) is taken off first.

| Item                                                      | Idle month | Busy month |
| --------------------------------------------------------- | ---------- | ---------- |
| Web app, 0.5 vCPU, 1 GiB, one replica                     | $8         | $34        |
| Supabase services, 1 vCPU, 2 GiB, one replica             | $16        | $66        |
| Five jobs, a few seconds a day                            | $0         | $0         |
| Postgres Flexible Server B1ms, 32 GiB, 7 day backups      | $17        | $17        |
| Container Registry Basic                                  | $5         | $5         |
| Log Analytics (first 5 GB a month free), Key Vault, Files | $2         | $5         |
| **Total**                                                 | **$48**    | **$127**   |

Both fit under $150. The budget alerts at $60, $96 and a forecast over
$120 so an unusual month is noticed before the credit runs out. Supabase
Pro, which the go-live list had as the next step, is $25 a month and stays
unpaid.

**About the credit.** $150 a month is the Visual Studio Enterprise
subscriber benefit. Two things to know before relying on it: Microsoft's
terms say it is for individual development and test, not production, and
the subscription has a spending limit that **stops every resource for the
rest of the month** when the credit is spent, rather than charging a card.
The budget emails are the warning; the spending limit is the backstop.
When the first association pays, move the resource group to a
pay-as-you-go subscription (`az resource move`, the same templates) and
take the limit question away. Until then it is a staging and soft-launch
environment that happens to be free.

## The order

### Phase 0: in the repo (done 2026-10-11, this pull request)

- `output: "standalone"` when `BUILD_STANDALONE=1`; `Dockerfile` and
  `.dockerignore`. The standalone server was started locally and served
  `/`, `/pricing`, the CSS and `/api/health`.
- `src/lib/deploy-env.ts`: `APP_ENV` beside `VERCEL_ENV`, so the shared
  sender warning and the test tools' refusal work on Azure. Unit tested.
- Apple Pay domains skip `*.azurecontainerapps.io` as they skip
  `*.vercel.app`.
- `infra/platform.bicep`, `infra/apps.bicep` (both compile with
  `az bicep build`), the Caddyfile, the migration SQL and the `dbtools`
  job image, five scripts under `scripts/azure/`, the deploy workflow
  (inert until three repository variables exist), `.env.azure.example`.

### Phase 1: the app on Azure, database still on Supabase (done 2026-10-12)

What exists: resource group `rg-hoasis` in `westus`; the web app at
`https://ca-hoasis-web.yellowwater-f911a709.westus.azurecontainerapps.io`
(one replica, healthy, `/api/health` all green against the hosted
database); the five jobs; Postgres 17 `psql-hoasis-lnitot` (empty);
registry `crhoasislnitot`; vault `kv-hoasis-lnitot` with every secret; the
budget. Stripe has webhook endpoints for the Azure host. The browser suite
ran against it: 144 passed, 10 skipped, none failed. GitHub's three
variables are set, so a merge to `main` deploys to Azure as well as Vercel.

The commands, for the record or for a second environment:

```bash
az login --use-device-code                 # the work account, once
cp .env.azure.example .env.azure           # fill it in; see the notes in the file
WITH_SUPABASE_STACK=false scripts/azure/provision.sh
```

The script creates the resource group `rg-hoasis` in `westus` (the
Visual Studio subscription is barred from Postgres Flexible Server in
`westus2`, `eastus`, `eastus2` and `southcentralus`; the first attempt found
that out), the
platform, the secrets, both images, the web app and the five jobs, and
prints the web app's address and the three values for GitHub. Then:

1. Open `https://<web>.azurecontainerapps.io/api/health`: every check `ok`.
2. Sign in with a test login; it talks to the hosted Supabase as before.
3. `pnpm stripe:setup https://<web host>` registers webhook endpoints for
   the new host; put the two new secrets in `.env.azure` and run
   `scripts/azure/secrets.sh`, then `scripts/azure/deploy.sh` so the app
   picks them up.
4. `E2E_BASE=https://<web host> pnpm e2e`.
5. GitHub: Settings, Secrets and variables, Actions, Variables:
   `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` from the
   script's output. From then on every merge to `main` deploys to Azure
   as well as Vercel.
6. Cloudflare: `staging` CNAME to the web app's address, DNS only (grey
   cloud); then
   `az containerapp hostname add -g rg-hoasis -n ca-hoasis-web --hostname staging.yourhoasis.com`
   and `az containerapp hostname bind ... --environment cae-hoasis --validation-method CNAME`
   for the managed certificate. Set `NEXT_PUBLIC_SITE_HOST=staging.yourhoasis.com`
   in `.env.azure` and run `provision.sh` again (it only changes what differs).

### Phase 2: the database on Azure (rehearsed 2026-10-12; the night is still to come)

What exists: the Supabase services app at
`https://ca-hoasis-supabase.yellowwater-f911a709.westus.azurecontainerapps.io`
(GoTrue 2.196.0, PostgREST 14.17, storage-api 1.80.2 with s3proxy to the
blob container, Caddy in front); the Azure Postgres filled three times by
the migrate job, row counts matching on every table (7,278 payments, 84
profiles, 155 units, 124 documents); 117 files copied into the blob
container, one downloaded through both stacks byte for byte; every
database suite green against the stack (the one red check is the Resend
domain, go-live item 1, which is not Azure's); a real sign-in through the
Azure auth service with the treasurer test login, after which row level
security showed only that person's rows; the Azure web app pointed at
the stack, `/api/health` green, the stack address in the browser bundle
and the hosted one gone; the browser suite green against it (144 passed,
10 skipped); and a sign-in in a real browser with the treasurer test login
landing on the Mehr Meadows dashboard with its real numbers.

The Azure copy is a snapshot from the rehearsal. Writes on
`yourhoasis.com` still go to the hosted project; the night below takes a
fresh copy.

The commands, for the record:

```bash
scripts/azure/provision.sh              # adds the Supabase services app; the web app stays on the hosted database
DUMP_ONLY=1 scripts/azure/db-migrate.sh # proves the dump through the pooler
scripts/azure/db-migrate.sh             # rehearsal: fills the Azure server
node scripts/azure/copy-storage.mjs https://lhplcojgoysfnltqlgfx.supabase.co https://<supabase app>.azurecontainerapps.io
ENV_FILE=../.env.azure node scripts/verify-all.mjs   # every database suite against Azure
```

The migrate job runs inside Azure from the `dbtools` image: it creates
the roles and schemas Supabase's image creates at birth
(`infra/supabase/sql/01-roles.sql`), dumps `public`, `auth`, `storage` and
`supabase_migrations` from the hosted project through its pooler (session
mode; the direct host is IPv6 only), restores with `--no-owner`, hands the
`auth` and `storage` schemas to the two services that own them
(`02-after-restore.sql`), and prints row counts from both sides
(`03-check.sql`). The storage files are copied separately through the two
storage APIs, which is what writes the `storage.objects` rows on the new
side. `RESET=1` empties the Azure server for a second rehearsal.

Then point the web app at the new stack: `WEB_ON_AZURE_DB=true
scripts/azure/provision.sh`. Sign in, pay with a test card, upload a
document, change an email: the four flows that cross all three services.

### The cut-over night (done 2026-10-15, 01:13 to 02:05 Pacific)

What happened, in order: production settings (`APP_ENV=production`,
`NEXT_PUBLIC_SITE_HOST`) and the real domain's Stripe webhook secrets (the
endpoints already existed for `yourhoasis.com`, so the Azure app took the
same secrets) into the vault and a rebuild; the two `asuid` TXT records
and the hostnames on the app; a fresh copy of the database (row counts
matching) and the 117 files with the services offline for two minutes;
then the apex A record to the environment's address `52.225.55.197` and
`www` CNAME to the app, both DNS-only; managed certificates bound (the
apex by HTTP validation, `www` by CNAME). `https://yourhoasis.com` answered
from Azure with a DigiCert certificate, health green, the webhook route
answering, within minutes of the record change.

One trap on the night: the production redeploy dropped the two hostnames,
because the template did not know them. `provision.sh` now reads the bound
domains back and passes them through (`webCustomDomains`).

Vercel and the hosted Supabase project are untouched and stay for thirty
days. Rolling back is the two records back to `76.76.21.21` and
`cname.vercel-dns.com`; anything written on Azure in between would need
copying the other way.

The plan as it was written, for the record:

1. Announce a window. Set the app to read-only or show the maintenance
   notice (the billing gate can say "back in an hour").
2. `RESET=1 scripts/azure/db-migrate.sh` and `copy-storage.mjs` again, so
   the copy is of that minute. Row counts match, or stop.
3. Supabase dashboard, Authentication, URL configuration: nothing to do;
   the allow list is in GoTrue's env already.
4. Stripe: switch the webhook endpoints to `yourhoasis.com` (they exist
   for the staging host from phase 1; `pnpm stripe:setup https://yourhoasis.com`
   again, new secrets into the vault, redeploy).
5. Cloudflare: apex `A 76.76.21.21` and `www CNAME cname.vercel-dns.com`
   become `CNAME` to the web app's address (Cloudflare flattens the apex),
   DNS only. Bind `yourhoasis.com` and `www.yourhoasis.com` to the app
   as in phase 1 step 6. Set `APP_ENV=production`,
   `NEXT_PUBLIC_SITE_HOST=yourhoasis.com` and run `provision.sh`.
6. `/api/health` on `yourhoasis.com`, a sign-in, a test payment, the
   `/admin` page. Done.
7. Leave Vercel and Supabase as they are for thirty days. Rolling back is
   the two DNS records and the Stripe endpoints; the data written on
   Azure in between would need the same copy the other way.

Pause the Supabase project (dashboard) once the thirty days are up;
delete the Vercel project after that.

## What the first run taught

Ten provisioning runs on the night of 2026-10-11, each fixing one thing;
all of it is in the scripts now.

- **Regions.** The Visual Studio subscription may not create Flexible
  Server in `westus2`, `eastus`, `eastus2` or `southcentralus` ("subscriptions
  are restricted from provisioning in this region"). `westus`, `westus3`
  and `centralus` allow Postgres 17 on B1ms. A Container Apps environment
  in `westus2` failed too and then took half an hour to delete, which is
  why the group is `rg-hoasis` and not the first name.
- **The vault.** RBAC mode means the subscription owner has no data-plane
  rights by default; `provision.sh` grants Key Vault Secrets Officer to
  whoever runs it and `secrets.sh` waits for the role to apply. An empty
  secret still needs a version or the app's reference fails, so an empty
  value becomes the placeholder `unset`.
- **The registry's build runner** splits a build argument on spaces, so
  the test logins (JSON) travel base64-encoded and the Dockerfile decodes
  them.
- **pnpm** decides which dependencies may run build scripts in
  `pnpm-workspace.yaml`; the Dockerfile has to copy it or the install fails.
- **Bicep.** `utcNow()` without a format is the compact form; the budget
  wants `yyyy-MM-01T00:00:00Z`.
- **Service versions must not trail the hosted project's.** The restored
  `storage` schema carries the hosted service's migrations (1.80.2, whose
  last step drops an index), and storage-api 1.74.0 still upserted on that
  index: every upload failed with Postgres error 42P10. Pin each service at
  or above the hosted version (`/storage/v1/version`, `/auth/v1/health`)
  before the copy.
- **Files cannot live on an Azure Files share.** The storage service's
  file backend keeps each object's metadata in extended attributes, and
  SMB has none: every upload failed with "options has an unsupported bit
  set". The files are in a blob container instead, reached through
  s3proxy (an S3 front for Azure Blob) running beside the service. Blob is
  the right home anyway: soft delete, lifecycle rules, cheaper.
- **CORS is the gateway's job.** A browser on the web app's host calls
  the stack's host, and Kong answered every preflight on a hosted project.
  Of the three services, auth answers a preflight without an allow-origin
  and storage with a 404, so the sign-in form said "Failed to fetch" while
  curl worked. The Caddyfile answers preflights and stamps the headers for
  all three routes now.
- **A changed secret volume needs a revision restart** (`az containerapp
revision restart`); the running replica keeps the old file. `APPS_ONLY=true
scripts/azure/provision.sh` is the clean way: a new revision from the
  templates with the image already running.
- **The standalone trace** under pnpm misses the ESM half of
  `@swc/helpers`; `outputFileTracingIncludes` carries the whole package.

## Operating it

- **Logs.** `az containerapp logs show -g rg-hoasis -n ca-hoasis-web --tail 200`
  for the app; `-n ca-hoasis-supabase --container auth` (or `rest`,
  `storage`, `gateway`) for the services. Everything is in Log Analytics
  for 30 days; the request id on an error screen is a `grep`.
- **A migration.** `supabase db push --db-url "$(az keyvault secret show --vault-name <kv> --name migrate-target-url --query value -o tsv)"`
  applies new files in `supabase/migrations/` and records them in
  `supabase_migrations`, as before. Then tell the data API, because the
  hosted project's "reload on DDL" trigger needs superuser and does not
  exist here:

  ```bash
  az containerapp job start -g rg-hoasis -n caj-hoasis-migrate --command sql \
    --image crhoasislnitot.azurecr.io/hoasis-dbtools:latest \
    --env-vars TARGET_URL=secretref:target "SQL_B64=$(printf %s "notify pgrst, 'reload schema'" | base64 | tr -d '\n')"
  ```

  The same recipe runs any one statement against the Azure server from
  inside Azure (`infra/dbtools/sql.sh`); there is no `psql` on the laptop
  and the server's firewall does not need to know it.

- **Deploy.** Merge to `main`; or `scripts/azure/deploy.sh`.
- **A secret.** Change it in `.env.azure`, run `scripts/azure/secrets.sh`,
  then `scripts/azure/deploy.sh` (a new revision reads the new version).
- **A setting.** Change `.env.azure`, run `scripts/azure/provision.sh`.
- **Backups.** Automatic, 7 days, point-in-time restore from the portal or
  `az postgres flexible-server restore`. Test one restore in the first
  month.
- **Service versions.** Pinned in `infra/apps.bicep`. Move GoTrue,
  PostgREST and storage-api together to the versions in Supabase's own
  `docker/docker-compose.yml`, on staging first; GoTrue and storage run
  their schema migrations at start.
- **Auth emails.** Sent by GoTrue over Resend's SMTP, as the hosted
  project does today, from the shared `onboarding@resend.dev` until the
  domain is verified (go-live item 1). Templates are GoTrue's defaults,
  which are what the hosted project uses.

## Risks, plainly

- **A Supabase-only thing hidden in 110 migrations.** The dump carries
  everything in `public`, `auth` and `storage`; what it cannot carry is a
  `supabase_admin`-owned default privilege or an extension outside the
  allow list. The rehearsal plus `pnpm db:verify` is the net. Expect a
  handful of restore errors about grants to roles that own nothing here;
  the job prints and counts them.
- **`service_role` and row level security.** If Flexible Server refuses
  `BYPASSRLS` after all, the webhook and the crons would be denied by
  every policy. The role creation is the first statement of the migrate
  job, so this fails in the first minute of the rehearsal, not on the
  night.
- **Sign-in.** Same JWT secret, same keys, same `auth` tables, so sessions
  survive. Still: rehearse a magic link, a password reset and an email
  change on staging with a real inbox before the night.
- **Two clouds for a while.** Phase 1 leaves the app on Azure and the data
  on Supabase; it works (HTTPS as now) and it is two dashboards.
- **The credit.** Dev/test terms and a hard stop at $150. Written above.
- **Cold starts.** Both apps keep one replica; nothing scales to zero.
- **The `/api/health` probe.** Container Apps uses a TCP probe by default,
  on purpose: an HTTP probe on `/api/health` would restart the app when
  Supabase was the thing that was down.

## What Monish does

1. `az login --use-device-code` with the work account, then
   `az account set --subscription <the one with the credit>`. Nothing
   below runs without it.
2. Read `.env.azure.example`, create `.env.azure`. The JWT secret is in
   the Supabase dashboard under Settings, API; everything else is in
   `.env.local` already.
3. Phase 1, as above. Half a day including the browser suite.
4. Say when to rehearse phase 2 and when the night is.
5. Decide what to do about the credit's terms before the first paying
   association.
