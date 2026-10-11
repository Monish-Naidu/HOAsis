import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "src/app/api");
const outputRoot = path.join(root, "docs/api");
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const routes = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath);
      continue;
    }
    if (entry.name !== "route.ts") continue;

    const source = readFileSync(absolutePath, "utf8");
    const handlers = [
      ...source.matchAll(
        /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g,
      ),
    ]
      .map((match) => match[1])
      .filter((method, index, list) => list.indexOf(method) === index)
      .sort((left, right) => methods.indexOf(left) - methods.indexOf(right));
    const routePath = `/${path
      .relative(apiRoot, path.dirname(absolutePath))
      .split(path.sep)
      .map((part) => part.replace(/^\[\[?\.\.\.(.+?)\]\]?$/, "{$1}").replace(/^\[(.+)\]$/, "{$1}"))
      .join("/")}`;
    routes.push({ routePath, handlers, sourcePath: path.relative(root, absolutePath) });
  }
}

walk(apiRoot);
routes.sort((left, right) => left.routePath.localeCompare(right.routePath));

const openApi = {
  openapi: "3.1.0",
  info: {
    title: "Your HOAsis API route inventory",
    version: "1.0.0",
    description:
      "Generated from exported Next.js route handlers. Payload contracts and authorization rules remain defined in each route source file.",
  },
  paths: Object.fromEntries(
    routes.map(({ routePath, handlers, sourcePath }) => [
      routePath,
      Object.fromEntries(
        handlers.map((method) => [
          method.toLowerCase(),
          {
            operationId: `${method.toLowerCase()}_${routePath.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
            summary: `${method} ${routePath}`,
            description: `Handler source: ${sourcePath}. See source for request, response, authorization, and side-effect details.`,
            responses: {
              default: {
                description: "The status and response body are defined by the route handler.",
              },
            },
          },
        ]),
      ),
    ]),
  ),
};

const markdown = [
  "# API route inventory",
  "",
  "Generated from exported Next.js route handlers. Request and response details, authorization, and side effects remain documented in each handler.",
  "",
  "| Path | Methods | Source |",
  "| --- | --- | --- |",
  ...routes.map(
    ({ routePath, handlers, sourcePath }) =>
      `| \`${routePath}\` | ${handlers.map((method) => `\`${method}\``).join(", ")} | \`${sourcePath}\` |`,
  ),
  "",
];

const outputs = new Map([
  [path.join(outputRoot, "openapi.json"), `${JSON.stringify(openApi, null, 2)}\n`],
  [path.join(outputRoot, "routes.md"), markdown.join("\n")],
]);
const check = process.argv.includes("--check");
const stale = [];

for (const [filePath, content] of outputs) {
  if (check) {
    let current = "";
    try {
      current = readFileSync(filePath, "utf8");
    } catch {
      // A missing generated file is reported as stale below.
    }
    if (current !== content) stale.push(path.relative(root, filePath));
  } else {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
}

if (stale.length) {
  console.error(`Generated API docs are stale: ${stale.join(", ")}. Run pnpm api:generate.`);
  process.exitCode = 1;
} else if (check) {
  console.log(`API docs match ${routes.length} route files.`);
} else {
  console.log(`Generated OpenAPI inventory for ${routes.length} route files.`);
}
