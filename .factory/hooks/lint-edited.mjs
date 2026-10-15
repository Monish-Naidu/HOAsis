// PostToolUse: lints the TypeScript file Droid just wrote and hands any
// errors back (exit 2), so they are fixed in the same turn rather than at
// `pnpm check` two minutes later.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = process.env.FACTORY_PROJECT_DIR || payload.cwd || process.cwd();
const target = payload.tool_input?.file_path;
const eslint = path.join(root, "node_modules", ".bin", "eslint");

if (typeof target !== "string" || !/\.tsx?$/.test(target) || !existsSync(eslint)) {
  process.exit(0);
}

try {
  execFileSync(eslint, ["--no-warn-ignored", target], { cwd: root, encoding: "utf8" });
} catch (error) {
  const said = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-20);
  process.stderr.write(`ESLint found problems in ${target}:\n${said.join("\n")}\n`);
  process.exit(2);
}
