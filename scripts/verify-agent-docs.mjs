import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = ["AGENTS.md", "CLAUDE.md", "README.md"];
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = new Set(Object.keys(packageJson.scripts));
const packageManagerCommands = new Set([
  "add",
  "approve-builds",
  "dlx",
  "exec",
  "install",
  "remove",
  "run",
  "update",
  "why",
]);
const errors = [];

for (const relativePath of docs) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`${relativePath} is missing`);
    continue;
  }

  const content = readFileSync(absolutePath, "utf8");
  for (const match of content.matchAll(/\bpnpm\s+([a-z][\w:-]*)/g)) {
    const command = match[1];
    if (!packageManagerCommands.has(command) && !scripts.has(command)) {
      errors.push(`${relativePath} references missing pnpm script "${command}"`);
    }
  }

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split("#", 1)[0];
    if (!target || /^[a-z]+:/i.test(target) || target.startsWith("#")) continue;
    if (!existsSync(path.resolve(path.dirname(absolutePath), target))) {
      errors.push(`${relativePath} links to missing path "${target}"`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${docs.join(", ")}: script references and local links are valid.`);
}
