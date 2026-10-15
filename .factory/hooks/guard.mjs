// PreToolUse guard for Droid sessions in this repository. Reads the hook
// payload on stdin and either lets the call through (exit 0, no output),
// blocks it (exit 2, reason on stderr), or asks the person at the keyboard
// (a JSON "ask" decision on stdout).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
const tool = payload.tool_name ?? "";
const input = payload.tool_input ?? {};
const root = process.env.FACTORY_PROJECT_DIR || payload.cwd || process.cwd();

function block(reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

// Create and Edit carry one path; ApplyPatch carries a patch whose file
// headers name every path it touches.
function pathsOf() {
  if (typeof input.file_path === "string") return [input.file_path];
  const patch = Object.values(input).find((value) => typeof value === "string") ?? "";
  return [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map((m) => m[1].trim());
}

function isTracked(relativePath) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", relativePath], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

if (/^(Create|Edit|ApplyPatch)$/.test(tool)) {
  for (const target of pathsOf()) {
    const relative = path.relative(root, path.resolve(root, target));
    const name = path.basename(relative);
    if (name.startsWith(".env") && name !== ".env.example") {
      block(`${relative} holds keys and is never written by an agent. Ask Monish to change it.`);
    }
    // A committed migration has been applied somewhere; editing it would
    // make that database disagree with the file. New, untracked ones are fine.
    if (/^supabase\/migrations\/\d{4}_.+\.sql$/.test(relative) && isTracked(relative)) {
      block(
        `${relative} is committed, so it has been applied. Redefine the function by copying it whole into a new numbered migration instead.`,
      );
    }
  }
}

if (tool === "Execute") {
  const command = String(input.command ?? "");
  // The database suites write to whichever project .env.local points at,
  // which today is production. The two verify scripts below only read files.
  const writesDatabase =
    /\bdb:verify\b|\bverify-all\.mjs\b|\bsupabase\s+db\s+push\b|\bseed-[a-z-]+\.mjs\b|\bdb:seed\b/.test(
      command,
    ) || /\bverify-(?!agent-docs\b|module-flags\b)[a-z0-9-]+\.mjs\b/.test(command);
  if (writesDatabase) {
    ask(
      "This writes to the Supabase project in .env.local, which is production today. Confirm the target first.",
    );
  }
}
