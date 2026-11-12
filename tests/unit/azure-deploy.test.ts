import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const revision = "ca-hoasis-web--new";
const previous = "ca-hoasis-web--old";
const image = "registry.azurecr.io/hoasis-web:release-test";
const host = "web.example.com";

type Snapshot = Record<string, unknown>;
interface Scenario {
  previous?: string;
  updated?: string;
  revision?: Snapshot;
  routing?: Snapshot;
  revisionReads?: Snapshot[];
  routingReads?: Snapshot[];
  health?: number[];
  httpStatus?: number;
  azError?: string;
  malformed?: string;
}

// All external commands resolve inside a fresh HOME. No inherited credential
// variables, user CLI configuration or repository env file enters the child.
const mock = `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const fixture = JSON.parse(fs.readFileSync(process.env.FIXTURE, "utf8"));
const executable = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify([executable, ...args]) + "\\n");
const counts = JSON.parse(fs.readFileSync(process.env.COUNTS, "utf8"));
function answer(kind, fallback) {
  const index = counts[kind] ?? 0;
  counts[kind] = index + 1;
  fs.writeFileSync(process.env.COUNTS, JSON.stringify(counts));
  if (fixture.azError === kind) process.exit(1);
  if (fixture.malformed === kind) { console.log("not json"); process.exit(0); }
  const snapshots = fixture[kind + "Reads"];
  const patch = snapshots?.[Math.min(index, snapshots.length - 1)] ?? fixture[kind];
  console.log(JSON.stringify({ ...fallback, ...patch }));
}
if (executable === "sleep") process.exit(0);
if (executable === "curl") {
  const index = counts.health ?? 0;
  counts.health = index + 1;
  fs.writeFileSync(process.env.COUNTS, JSON.stringify(counts));
  const responses = fixture.health ?? [0];
  console.log(fixture.httpStatus ?? 200);
  process.exit(responses[Math.min(index, responses.length - 1)]);
}
const query = args[args.indexOf("--query") + 1];
if (args[0] === "account") { console.log("mock subscription"); process.exit(0); }
if (args[0] === "acr") {
  if (args[1] === "list") console.log("registry");
  process.exit(0);
}
if (args[0] !== "containerapp") process.exit(90);
if (args[1] === "update") {
  if (fixture.azError === "update") process.exit(1);
  console.log(fixture.updated ?? "${revision}");
  process.exit(0);
}
if (args[1] === "revision" && args[2] === "show") {
  if (args[args.indexOf("--revision") + 1] !== "${revision}") process.exit(91);
  answer("revision", {
    name: "${revision}", image: "${image}", active: true, provisioning: "Provisioned",
    running: "Running", health: "Healthy", trafficWeight: 100,
  });
} else if (args[1] === "show") {
  if (query.includes("env[")) process.exit(0);
  if (query === "properties.latestRevisionName") console.log(fixture.previous ?? "${previous}");
  else answer("routing", {
    latest: "${revision}", ready: "${revision}", image: "${image}", fqdn: "${host}",
    traffic: [{latestRevision: true, weight: 100}],
  });
} else process.exit(92);
`;

function deploy(scenario: Scenario = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "azure-deploy-"));
  try {
    const bin = path.join(dir, ".local/bin");
    mkdirSync(bin, { recursive: true });
    for (const command of ["az", "curl", "sleep"]) {
      const file = path.join(bin, command);
      writeFileSync(file, mock);
      chmodSync(file, 0o700);
    }
    symlinkSync(process.execPath, path.join(bin, "node"));
    const fixture = path.join(dir, "fixture.json");
    const calls = path.join(dir, "calls.jsonl");
    const counts = path.join(dir, "counts.json");
    writeFileSync(fixture, JSON.stringify(scenario));
    writeFileSync(calls, "");
    writeFileSync(counts, "{}");
    const result = spawnSync("/bin/bash", ["scripts/azure/deploy.sh", "release-test"], {
      cwd: root,
      env: {
        NODE_ENV: "test",
        HOME: dir,
        PATH: "/usr/bin:/bin",
        FIXTURE: fixture,
        CALLS: calls,
        COUNTS: counts,
      },
      encoding: "utf8",
      timeout: 20_000,
    });
    if (result.error) throw result.error;
    return {
      ...result,
      calls: readFileSync(calls, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]),
      counts: JSON.parse(readFileSync(counts, "utf8")) as Record<string, number>,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("Azure deployment readiness", () => {
  it("requires the intended healthy revision, image and traffic before accepting hostname health", () => {
    const run = deploy();
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain(`healthy: https://${host} (${revision}, ${image}, 100% traffic)`);
    expect(run.counts).toEqual({ revision: 2, routing: 2, health: 1 });
    const healthIndex = run.calls.findIndex(([command]) => command === "curl");
    expect(run.calls[healthIndex - 1]).toContain("containerapp");
    expect(run.calls[healthIndex + 1]).toContain("revision");
    expect(run.calls[healthIndex + 2]).toContain("show");
    expect(run.calls[healthIndex]).toEqual([
      "curl",
      "--fail",
      "--silent",
      "--show-error",
      "--connect-timeout",
      "5",
      "--max-time",
      "10",
      "--output",
      "/dev/null",
      "--write-out",
      "%{http_code}",
      `https://${host}/api/health`,
    ]);
    const update = run.calls.find((args) => args[0] === "az" && args[2] === "update")!;
    expect(update[update.indexOf("--image") + 1]).toBe(image);
  });

  it("does not call the old healthy hostname when the new revision fails", () => {
    const run = deploy({ revision: { health: "Unhealthy" }, health: [0] });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("failed or is unhealthy");
    expect(run.counts.health).toBeUndefined();
    expect(run.stdout).not.toContain("healthy:");
  });

  it.each(["Failed", "Degraded"])("rejects a %s running revision", (running) => {
    const run = deploy({ revision: { running } });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBeUndefined();
  });

  it.each<[string, Snapshot]>([
    ["wrong revision", { name: previous }],
    ["wrong image", { image: "registry.azurecr.io/hoasis-web:old" }],
    ["missing image", { image: null }],
    ["failed provisioning", { provisioning: "Failed" }],
  ])("rejects %s before checking shared health", (_name, status) => {
    const run = deploy({ revision: status });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBeUndefined();
  });

  it.each(["", previous, "None", `${revision}\n${previous}`])(
    "rejects missing, stale or malformed update revision %j",
    (updated) => {
      const run = deploy({ updated });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("did not identify a new revision");
      expect(run.counts.health).toBeUndefined();
      expect(run.counts.revision).toBeUndefined();
    },
  );

  it("rejects a missing previous revision instead of assuming the update is new", () => {
    const run = deploy({ previous: "" });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBeUndefined();
  });

  it.each<[string, Snapshot]>([
    ["provisioning", { provisioning: "Provisioning" }],
    ["inactive", { active: false }],
    ["unknown health", { health: null }],
    ["not running", { running: "Processing" }],
    ["effective traffic not moved", { trafficWeight: 0 }],
  ])("times out while revision is %s", (_name, status) => {
    const run = deploy({ revision: status });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("within 150 seconds");
    expect(run.counts.revision).toBe(30);
    expect(run.counts.health).toBeUndefined();
    expect(run.calls.filter(([command]) => command === "sleep")).toHaveLength(29);
  });

  it.each<[string, Snapshot]>([
    ["old ready revision", { ready: previous }],
    ["superseded latest alias", { latest: "ca-hoasis-web--later" }],
    ["wrong desired image", { image: "registry.azurecr.io/hoasis-web:old" }],
    ["missing host", { fqdn: null }],
    ["malformed host", { fqdn: "user:password@web.example.com/path" }],
    ["missing traffic", { traffic: null }],
    ["empty traffic", { traffic: [] }],
    ["missing weight", { traffic: [{ latestRevision: true }] }],
    ["string weight", { traffic: [{ latestRevision: true, weight: "100" }] }],
    ["missing destination", { traffic: [{ weight: 100 }] }],
    ["invalid alias", { traffic: [{ latestRevision: "true", weight: 100 }] }],
    ["excess weight", { traffic: [{ latestRevision: true, weight: 101 }] }],
    ["negative weight", { traffic: [{ latestRevision: true, weight: -1 }] }],
    ["old traffic", { traffic: [{ revisionName: previous, weight: 100 }] }],
    [
      "conflicting alias",
      { traffic: [{ latestRevision: true, revisionName: previous, weight: 100 }] },
    ],
    [
      "split traffic",
      {
        traffic: [
          { revisionName: revision, weight: 90 },
          { revisionName: previous, weight: 10 },
        ],
      },
    ],
  ])("does not accept shared health with %s", (_name, routing) => {
    const run = deploy({ routing });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBeUndefined();
  });

  it("accepts explicit intended traffic with an old zero-weight revision", () => {
    const run = deploy({
      routing: {
        traffic: [
          { revisionName: revision, weight: 100 },
          { revisionName: previous, weight: 0 },
        ],
      },
    });
    expect(run.status, run.stderr).toBe(0);
  });

  it("waits for readiness and traffic propagation rather than accepting the old ready revision", () => {
    const run = deploy({
      revisionReads: [{ provisioning: "Provisioning", health: null }, {}, {}],
      routingReads: [{ ready: previous }, {}, {}],
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.counts).toEqual({ revision: 3, routing: 3, health: 1 });
  });

  it("rechecks routing after a healthy response and rejects a concurrent rollout", () => {
    const run = deploy({ routingReads: [{}, { latest: "ca-hoasis-web--later" }] });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBe(1);
    expect(run.stdout).not.toContain("healthy:");
  });

  it("rejects an intended revision that becomes unhealthy during the health request", () => {
    const run = deploy({ revisionReads: [{}, { health: "Unhealthy" }] });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBe(1);
    expect(run.stdout).not.toContain("healthy:");
  });

  it("times out if hostname health fails despite correct Azure state", () => {
    const run = deploy({ health: [22] });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBe(30);
    expect(run.stdout).not.toContain("healthy:");
  });

  it("retries a failed health request using fresh Azure snapshots", () => {
    const run = deploy({ health: [22, 0] });
    expect(run.status, run.stderr).toBe(0);
    expect(run.counts).toEqual({ revision: 3, routing: 3, health: 2 });
  });

  it.each([204, 302])("rejects HTTP %s even when curl exits successfully", (httpStatus) => {
    const run = deploy({ httpStatus });
    expect(run.status).toBe(1);
    expect(run.counts.health).toBe(30);
    expect(run.stdout).not.toContain("healthy:");
  });

  it("stops when Azure update fails instead of inspecting the old healthy deployment", () => {
    const run = deploy({ azError: "update" });
    expect(run.status).toBe(1);
    expect(run.counts.revision).toBeUndefined();
    expect(run.counts.health).toBeUndefined();
  });

  it.each(["revision", "routing"])("fails closed when the %s read errors", (azError) => {
    const run = deploy({ azError });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("could not be read");
    expect(run.counts.health).toBeUndefined();
  });

  it.each(["revision", "routing"])("fails closed on malformed %s JSON", (malformed) => {
    const run = deploy({ malformed });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("malformed status");
    expect(run.counts.health).toBeUndefined();
  });
});

describe("DAST permissions", () => {
  it("allows only the ZAP job to write issues without bypassing scan enforcement", () => {
    const workflow = readFileSync(path.join(root, ".github/workflows/dast.yml"), "utf8");
    expect(workflow).toContain("permissions:\n  contents: read\n\njobs:");
    expect(workflow).toContain(
      "  zap:\n    permissions:\n      contents: read\n      issues: write\n",
    );
    expect(workflow).toContain("uses: zaproxy/action-baseline@v0.14.0");
    expect(workflow).not.toMatch(
      /continue-on-error|fail_action|allow_issue_writing|rules_file_name/,
    );
  });
});
