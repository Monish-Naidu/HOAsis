<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Context Engine (CCE)

This project uses Code Context Engine for intelligent code retrieval and
cross-session memory. Its tools come from the `context-engine` MCP server:
where that server is connected, the rules in this section apply. In a tool
without it, read and grep the files directly and skip this section.

### Searching the codebase

**Use `context_search` instead of reading files directly** when exploring
the codebase, answering questions about code, or understanding how things
work. `context_search` returns the most relevant code chunks with
confidence scores instead of whole files.

When to use `context_search`:

- Answering questions about the codebase ("how does X work?", "where is Y?")
- Exploring structure or architecture
- Finding related code, functions, or patterns

Other tools:

- `expand_chunk` for full source of a compressed result
- `related_context` for what calls/imports a function
- `session_recall` to recall past decisions

### Cross-session memory

Call `session_recall("topic phrase")` before answering non-trivial questions.
Call `record_decision(decision="...", reason="...")` after making choices.
Call `record_code_area(file_path="...", description="...")` after meaningful work.

## Project commands

- `pnpm install` installs the locked dependencies.
- `pnpm dev` starts the signed-out demo at `http://localhost:3000`; no secrets or services are needed.
- `pnpm check` runs formatting, lint, types, documentation checks, tests, and a production build.
- `pnpm e2e` exercises browser flows against an already-running server.
- `pnpm db:verify` targets the Supabase project in `.env.local` (or `ENV_FILE`) and performs writes, so it refuses any non-local host unless `VERIFY_REMOTE_HOST` names it.
- Local Supabase setup, the isolated integration stack and its ports are documented in `docs/local-development.md`.

Keep money in integer cents and dates as `YYYY-MM-DD`. Screens import through `@/lib/data`, use semantic color tokens, and test pure logic in `tests/unit`.

### Output style

Two registers.

Findings, code review and routine answers: compressed. Drop articles (a,
an, the) in prose. Use sentence fragments over full sentences. Use short
synonyms (fix not resolve, check not investigate). Pattern: [thing] [action]
[reason]. [next step]. No filler, hedging, pleasantries, trailing summaries,
or restating what the user said. One sentence if one sentence is enough.

Design, plans, and anything written to be pasted or reread later (prompts,
docs, pull request text): plain short sentences, full prose, structure that
carries the meaning.

When suggesting code changes, show only the changed lines with 3 lines of
context. Never rewrite entire files. Multiple changes in one file: show each
change separately. Never echo back unchanged code the user already has.

Code blocks, file paths, commands, error messages: always written in full.
Security warnings and destructive action confirmations: use full clarity.
