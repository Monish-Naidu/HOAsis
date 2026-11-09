# Functional QA setup

The `QA` workflow runs `functional` against an isolated local demo of the checked-out
PR head. Existing check, browser, DAST, review, and deployment workflows are unchanged.
This adds functional investigation, not another lint, unit, or Playwright job.

## Files

| Path                                                                                                 | Purpose                                                                       |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `.factory/skills/qa/SKILL.md`                                                                        | Lightweight diff and evidence orchestrator.                                   |
| `.factory/skills/qa/config.yaml`                                                                     | Runtime target, personas, scope, evidence switches, and credential reference. |
| `.factory/skills/qa/REPORT-TEMPLATE.md`                                                              | Canonical Markdown report layout.                                             |
| `.factory/skills/qa/.install-progress.yaml`                                                          | Answers from the approved plan, without credentials.                          |
| `.factory/skills/qa-web/SKILL.md`                                                                    | Ten-area browser scenario menu and success criteria.                          |
| `.factory/skills/qa-backend/SKILL.md`                                                                | Safe local HTTP cases and blocked service operations.                         |
| `.claude/skills/qa/SKILL.md`, `.claude/skills/qa-web/SKILL.md`, `.claude/skills/qa-backend/SKILL.md` | Required identical skill mirrors.                                             |
| `.factory/settings.json`                                                                             | Official marketplace and project plugin enablement.                           |
| `.github/workflows/qa.yml`                                                                           | Functional PR/manual job and fail-closed gate.                                |
| `.github/workflows/qa-report.yml`                                                                    | Trusted artifact-only sticky PR reporter.                                     |
| `scripts/qa/run.py`                                                                                  | Isolated server, agent lifecycle, and report validation.                      |
| `scripts/qa/test_qa.py`                                                                              | Offline installation contract tests.                                          |
| `scripts/qa/requirements.txt`                                                                        | Pinned YAML parser for the QA tools.                                          |
| `.gitignore`                                                                                         | Ignore run evidence under `/qa-results/`.                                     |
| `docs/qa-setup.md`                                                                                   | Setup, verification, and coverage limits.                                     |

## Enable on GitHub

Repository secret checklist:

You reported an existing setup for all repositories. If the organization secret
already grants this repository access, do not create a duplicate.

- [ ] `FACTORY_API_KEY`: Droid authentication. Create a dedicated key at
      <https://app.factory.ai/settings/api-keys> and add it at
      <https://github.com/Monish-Naidu/HOAsis/settings/secrets/actions>.

No application keys, test accounts, Supabase credentials, Stripe keys, Resend keys,
or evidence-upload PAT are required. `github.token` is GitHub's automatic ephemeral
token, not an additional repository secret. Only the trusted reporter has PR-write
permission. The functional agent does not receive that token.

The repository's `FACTORY_API_KEY` secret metadata was verified after setup.
Plugin verification accepts the older `Active:` list and Droid 1.6's table.
The table must name the exact plugin, enabled at project scope.
The agent drives the `agent-browser` that Droid installs (0.37.1 in the first
hosted run); the workflow logs its path and version. Only when Droid provides none
does it install `agent-browser@0.27.0` from npm, because later npm releases
declare Node 24 and this job uses Node 22. The runner gives each run a short
session name and socket directory, since a full run ID exceeded the Linux socket
path limit, and a failed browser close no longer replaces the agent's report.

After these files reach the default branch through the normal approved PR process,
run QA once so its check is registered. In repository Settings, Rules, Rulesets
(or Branches, branch protection), require the **functional** check from the
**QA** workflow for `main`. Select the GitHub Actions check source. Keep existing
required checks. No rule is changed by this installation.

The separate `qa-report.yml` workflow must be present on the default branch before
its `workflow_run` trigger can post comments. It downloads reports as data and
never checks out or runs PR code. It updates one `<!-- qa-report -->` comment on
the current open PR, including failures and missing artifacts. Old-head runs do
not overwrite new-head evidence. Manual runs retain artifacts but do not comment.
Repository or organization policy must permit GitHub Actions to write PR comments;
if forbidden, reporter fails visibly. No PAT bypass is provided.

Fork PRs receive no Factory credential and report BLOCKED. Never use
`pull_request_target` to execute fork code or enable secrets for fork runs.
A maintainer can review and bring trusted changes onto a repository branch for
credentialed QA. Backend-dependent changes also remain BLOCKED under this setup;
isolated signed-in QA is a separate future addition.

## Run locally

Use Node 22 and the pinned `pnpm@11.9.0` from `package.json`:

```bash
pnpm install --frozen-lockfile
python3 -m venv /tmp/hoasis-qa-tools
/tmp/hoasis-qa-tools/bin/python -m pip install -r scripts/qa/requirements.txt
droid plugin list --scope project
/tmp/hoasis-qa-tools/bin/python -B scripts/qa/test_qa.py -v
/tmp/hoasis-qa-tools/bin/python -B scripts/qa/run.py run --base origin/main
```

Provide `FACTORY_API_KEY` through your secure environment, not a checked-in file.
Alternatively invoke `/qa` with an explicit diff base. Install browser prerequisites
through Droid Control before the run. Managed marketplace policy is authoritative;
stop if it blocks the official plugin.

`qa-results/` must not contain an earlier report. Preserve earlier evidence elsewhere
before a new run; the runner never deletes it. Startup-only installation rehearsal:

```bash
/tmp/hoasis-qa-tools/bin/python -B scripts/qa/run.py smoke --base HEAD
```

This rehearsal checks demo startup and missing-service health behavior. It is not
a functional QA pass. Offline contract tests exercise report failures and sticky
comment logic with stubbed GitHub methods, without publishing anything.

## Isolation and evidence

The runner copies Git-listed source into a temporary project directory, omitting
all `.env*` files, symlinks, and previous build output. It invokes Next's supported
project-directory CLI with a fresh environment allowlist. Next only loads env files
from that isolated project root, as documented in
`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.
This is not a shell-only blanking scheme. `node_modules` is reused read-only by
convention, but source, Next output, HOME, and browser profile are run-owned.

Preferred loopback port is 3101; if busy, an OS-selected free port is used.
Port 3000 and existing servers are never reused. Readiness is bounded to 180 seconds;
the agent has 900 seconds, its workflow step 19 minutes, and the job 25 minutes.
Only QA-owned process groups, browser session, and temporary files are cleaned up.

Config in `.factory/skills/qa/config.yaml` is read each run. Text snapshots and
downloadable screenshots are primary evidence. Recording setup follows
`video_evidence`; Compose loads only when both it and `droid_control.compose` are
enabled. The installed Compose stage owns renderer dependencies, always with literal
`"preset": "factory"`. All media stays in artifacts. No video uploads or ImageMagick.
Artifacts retain reports, snapshots, and screenshots for 14 days, even on failures.
Raw server/agent logs remain local to the QA runner and are not uploaded
automatically, to reduce accidental disclosure.

Agent writes both JSON rows and Markdown. Runner validates both, checks evidence
paths, derives the result from rows, and renders a canonical report. FAIL, BLOCKED,
FLAKY, relevant INCONCLUSIVE, missing/invalid reports, missing evidence, omitted apps,
and agent errors fail the check. Only a no-app diff may pass as INCONCLUSIVE,
not applicable, without launching app flows. Diff selection compares commits;
local temporary source also contains Git-listed working-tree edits, so use a
clean application checkout when testing a commit for release.

Fixture role boundaries are UI checks, not SQL RLS or durable write evidence.
External integrations, cron, webhooks, and signed-in operations are not silently
simulated. Suggested failure learning stays in report blocks with exact proposed
skill edits. It never commits, pushes, or creates a PR.

## Live site boundary

Only an explicit request can authorize separate read-only public-page checks of
`https://www.yourhoasis.com`. No login, form submission, email, payment, private
route, or data change. Use a separate browser run and label its report live-public.
Never use the live site to verify unshipped PR code. The branch runner cannot
select a hosted target.

## Installation verification and remaining notes

The 33 offline contract tests pass. Generated JSON/YAML, skill frontmatter and mirrors are validated by
`scripts/qa/test_qa.py`. Tests include the report status matrix, missing reports
and evidence, omitted apps, backend blocks, fork boundaries, runtime switches,
native Next environment loading, startup failure reporting, and six offline
sticky-comment cases. The plugin is active at project scope.

The installation rehearsal served `/demo` with HTTP 200 and `/api/health` with
HTTP 503, naming the absent Supabase, Stripe, Resend, and cron credentials.
No production calls or GitHub comments were made in that rehearsal.
The first hosted app-diff run installed Droid 1.6 and the plugin, then correctly
failed closed because plugin verification expected the older list format.
Verification now accepts both formats, with regressions against the actual
workflow script. The second hosted run reached the credentialed agent, which
drove the demo and saved evidence, but the runner's browser close failed on the
overlong session name and replaced the agent's report with a BLOCKED setup row.

The full `pnpm check` gate passed in the isolated QA release worktree based on
`origin/main`: 187 test files, 2,530 tests, and a production build with 142 generated
pages. This local gate does not verify hosted functional QA, Ubuntu plugin
provisioning, or actual credential availability.

An existing upload integration test raced its asynchronous file read during the
commit hook. It now waits for the saved filename and exact size before asserting,
without changing application behavior or loosening its expectations.

Review found no P0/P1 issues. Startup failure handling and auth/session scope
gaps were fixed. Runtime config-only changes, including `next.config.ts`, remain
N/A under the requested docs/config-only policy, despite the broader backend
menu containing header/redirect cases for applicable app changes. Raw agent and
server logs are intentionally excluded from uploaded artifacts; failed runs
retain their structured failure report, but detailed process diagnostics need a
local reproduction. These are remaining review notes, not verified coverage.
