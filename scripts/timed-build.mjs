import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const startedAt = performance.now();
const result = spawnSync("pnpm", ["exec", "next", "build"], { stdio: "inherit" });
const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
const summary = `Production build completed in ${seconds}s`;

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${summary}\n`);
}

if (result.error) {
  console.error(result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
