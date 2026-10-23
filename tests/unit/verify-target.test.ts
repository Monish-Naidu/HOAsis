import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { verifyTarget } from "../../scripts/lib/verify-target.mjs";

const local = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
const remote = { NEXT_PUBLIC_SUPABASE_URL: "https://db.example.com" };

describe("verifyTarget", () => {
  it("accepts a local stack by any loopback name", () => {
    expect(verifyTarget(local, "")).toBe("http://127.0.0.1:54321");
    expect(verifyTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" }, "")).toBe(
      "http://localhost:54321",
    );
    expect(verifyTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://[::1]:54321" }, "")).toBe(
      "http://[::1]:54321",
    );
  });

  it("refuses a remote host unless it is named exactly", () => {
    expect(() => verifyTarget(remote, "")).toThrow(/Refusing.*db\.example\.com/);
    expect(() => verifyTarget(remote, "example.com")).toThrow(/Refusing/);
    expect(verifyTarget(remote, "db.example.com")).toBe("https://db.example.com");
  });

  it("refuses a lookalike host that only starts with a loopback name", () => {
    expect(() =>
      verifyTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1.example.com" }, ""),
    ).toThrow(/Refusing/);
    expect(() =>
      verifyTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost@db.example.com" }, ""),
    ).toThrow(/Refusing/);
  });

  it("refuses a missing or malformed URL", () => {
    expect(() => verifyTarget({}, "")).toThrow(/not set/);
    expect(() => verifyTarget({ NEXT_PUBLIC_SUPABASE_URL: "not a url" }, "")).toThrow(/not a URL/);
  });
});

describe("pnpm db:verify", () => {
  const runAll = (url: string, ...suites: string[]) => {
    const dir = mkdtempSync(path.join(tmpdir(), "verify-target-"));
    const file = path.join(dir, "env");
    writeFileSync(file, `NEXT_PUBLIC_SUPABASE_URL=${url}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env, ENV_FILE: file };
    delete env.VERIFY_REMOTE_HOST;
    return spawnSync(process.execPath, ["scripts/verify-all.mjs", ...suites], {
      env,
      encoding: "utf8",
    });
  };

  it("stops before any suite when the env file points at a remote project", () => {
    const run = runAll("https://db.example.com");
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Refusing/);
    expect(run.stdout).not.toMatch(/=== verify-/);
  });

  it("accepts a local stack and rejects a suite name that does not exist", () => {
    const run = runAll("http://127.0.0.1:54321", "no-such-suite");
    expect(run.stdout).toContain("Database checks write to http://127.0.0.1:54321");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("No such suite: no-such-suite");
  });
});
