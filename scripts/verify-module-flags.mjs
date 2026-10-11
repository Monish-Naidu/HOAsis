import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleFile = path.join(root, "src/lib/modules.ts");
const sourceRoot = path.join(root, "src");
const sourceFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath);
    else if (/\.(ts|tsx)$/.test(entry.name) && absolutePath !== moduleFile)
      sourceFiles.push(absolutePath);
  }
}

walk(sourceRoot);
const moduleSource = readFileSync(moduleFile, "utf8");
const moduleBlock = moduleSource.match(/export const MODULES:[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
if (!moduleBlock) {
  console.error("Could not find the MODULES definition.");
  process.exit(1);
}

const keys = [...moduleBlock[1].matchAll(/^\s*(?:"([^"]+)"|([a-z][\w-]*)):\s*\{/gm)].map(
  (match) => match[1] ?? match[2],
);
const unused = keys.filter((key) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reference = new RegExp(`["']${escaped}["']`);
  return !sourceFiles.some((filePath) => reference.test(readFileSync(filePath, "utf8")));
});

if (unused.length) {
  console.error(`Module flags with no source references: ${unused.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${keys.length} module flags; each has a source reference.`);
}
