---
name: qa
description: Run diff-selected functional QA for Your HOAsis against an isolated local branch demo. Capture text and screenshots, report blocked real integrations, and produce a fail-closed QA report.
---

# QA orchestrator

Functional QA only. Do not run lint, types, unit tests, static analysis, or
Playwright suites. Existing workflows own those checks. Do not edit application
code, commit, push, open a PR, deploy, post comments, or change GitHub settings.

## Start and scope

Read `.factory/skills/qa/config.yaml` on every run. From the repository root,
start with `python3 scripts/qa/run.py run --base <explicit-ref>`.
Use the default branch merge base, or the PR base SHA supplied by CI, never an
implicit `HEAD~1`. The runner compares the supplied base and head, copies current
checked-out source without `.env*`, starts Next.js with an allowlisted environment,
and launches this skill in an agent. Do not recursively invoke the runner when
`QA_BASE_URL` is already supplied.

Inside that agent, read `QA_RESULTS_DIR/scope.json` and the actual diff between
`QA_DIFF_BASE` and `QA_DIFF_HEAD`. The scope paths select apps; the diff selects
flows from each affected app's menu. Include adjacent negative cases and new
targeted tests for behavior the menu does not cover. Load only affected modules:
`.factory/skills/qa-web/SKILL.md` and/or `.factory/skills/qa-backend/SKILL.md`.
Never silently skip a relevant flow. Report BLOCKED with what was tried and the
needed fix. Docs/config-only changes are INCONCLUSIVE, not applicable, with no
app flows. Backend-dependent coverage must include BLOCKED, even if demo UI passes.

## Target and evidence

Use only the runner's `QA_BASE_URL`, `QA_RUN_ID`, and `QA_BROWSER_PROFILE`.
One run-scoped browser session/profile for every persona and flow. Close only
that session in a finally step. Never attach to an existing browser or dev server.
No global browser close, database reset, live credentials, or production writes.
Do not inspect `.env*` or print secrets. Do not add mocked services or change
fixtures to make behavior pass.

Invoke `droid-control` before browser interaction. Read its browser target,
Capture and Verify atoms. Consult the installed driver's bundled core reference
for version-appropriate snapshots; do not assume newer driver commands exist.
Read `video_evidence` and `droid_control.compose`
from config at runtime. Record only if video evidence is enabled. Load Compose
only if both switches are enabled; otherwise do not install rendering tools or
invoke Compose. If enabled, let the installed Compose atom resolve prerequisites
and renderer, using literal `"preset": "factory"` for every render. Ignore any
preset supplied in YAML. Keep all media downloadable as artifacts, never upload
videos or install ImageMagick.

Save meaningful before/after accessibility snapshots as `.txt` and screenshots
as `.png` under `QA_RESULTS_DIR`. Read evidence back and compare observations to
success criteria; file existence alone is not proof. Visual changes need both
themes; resident screens need phone width. Do not turn fixture role switching
into claims about database permissions or hosted integrations.

`https://www.yourhoasis.com` is allowed only on an explicit user request for
read-only public pages, outside PR verification. No login, form submissions,
email, payments, or data changes. Use a separate run/profile and label its report
live-public, not branch verification. The branch runner never targets this site.

## Report contract

Write both `QA_RESULTS_DIR/report.md` (use `REPORT-TEMPLATE.md`) and
`QA_RESULTS_DIR/report.json` before finishing:

```json
{
  "tests": [
    {
      "id": "unique-flow-id",
      "app": "web",
      "persona": "resident",
      "result": "PASS",
      "summary": "Describe the observed result, not the intended result.",
      "evidence": ["flow-after.txt", "flow-after.png"]
    }
  ],
  "actions": [],
  "suggested_updates": []
}
```

Results: PASS, FAIL, BLOCKED, FLAKY, INCONCLUSIVE. Every PASS needs actual evidence
and every affected app needs rows. Missing evidence or either report fails.
FAIL, BLOCKED, FLAKY, relevant INCONCLUSIVE, agent errors and missing reports fail
the gate. Only a runner-detected no-app diff may pass as INCONCLUSIVE.
Runner computes the outcome from rows, validates evidence paths and renders the
canonical Markdown report. Never downgrade a failed row after a retry; add a row.

For new environment failure patterns, add an exact proposed Markdown edit in
`suggested_updates`: `{"file": ".factory/skills/qa-web/SKILL.md", "section":
"Known Failure Modes", "markdown": "Exact text to insert."}`. Suggestions appear
in collapsed report blocks. No automatic edits, commits, or PR creation.
