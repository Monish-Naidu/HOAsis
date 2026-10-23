import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dueSlot, EXPECTED_JOBS, jobHealth, type JobRun } from "@/lib/job-health";

/**
 * Daily-job health on a fixed clock: Tuesday 2026-10-06, 15:00 UTC, the
 * minute the digest runs. Every other job's slot (13:00 to 14:30) is at
 * least thirty minutes old, so each must have a success from today.
 */
const NOW = "2026-10-06T15:00:00.000Z";

function run(job: string, startedAt: string, ok = true, error: string | null = null): JobRun {
  return {
    job,
    started_at: startedAt,
    finished_at: startedAt.replace(/:00Z$/, ":09Z"),
    ok,
    error,
    request_id: "K7QM2X4P",
  };
}

/** Each job's run at its scheduled minute on a day. */
function day(date: string): JobRun[] {
  return EXPECTED_JOBS.map((j) =>
    run(
      j.job,
      `${date}T${String(j.hourUtc).padStart(2, "0")}:${String(j.minuteUtc).padStart(2, "0")}:00Z`,
    ),
  );
}

/** Today's runs for every job but the digest (still running), and yesterday's digest. */
const timely = [
  ...day("2026-10-06").filter((r) => r.job !== "ops-digest"),
  run("ops-digest", "2026-10-05T15:00:00Z"),
];

const state = (rows: JobRun[], successes: JobRun[] = [], running?: "ops-digest") =>
  Object.fromEntries(jobHealth(rows, successes, NOW, { running }).map((j) => [j.job, j.state]));

describe("expected daily jobs", () => {
  it("match the scheduled jobs in infra/apps.bicep, path and minute", () => {
    const bicep = readFileSync(path.resolve(process.cwd(), "infra/apps.bicep"), "utf8");
    const scheduled = [...bicep.matchAll(/path: '([^']+)', schedule: '(\d+) (\d+) \* \* \*'/g)].map(
      (m) => ({ path: m[1], minuteUtc: Number(m[2]), hourUtc: Number(m[3]) }),
    );
    expect(scheduled).toEqual(
      EXPECTED_JOBS.map(({ path: p, hourUtc, minuteUtc }) => ({ path: p, minuteUtc, hourUtc })),
    );
  });
});

describe("job health", () => {
  it("calls a timely successful run of every job healthy", () => {
    const health = jobHealth(timely, [], NOW, { running: "ops-digest" });
    expect(health.map((j) => [j.job, j.state])).toEqual([
      ["assessments", "ok"],
      ["email-bills", "ok"],
      ["billing-sweep", "ok"],
      ["autopay", "ok"],
      ["ops-digest", "ok"],
    ]);
    expect(health[3].detail).toBe("ran 2026-10-06 14:30 UTC");
  });

  it("names a failed job with its error, even when every other job succeeded", () => {
    const rows = [
      ...timely.filter((r) => r.job !== "autopay"),
      run("autopay", "2026-10-06T14:30:00Z", false, "Stripe timed out"),
    ];
    const health = jobHealth(rows, [run("autopay", "2026-10-05T14:30:00Z")], NOW);
    const autopay = health.find((j) => j.job === "autopay")!;
    expect(autopay.state).toBe("failed");
    expect(autopay.detail).toBe("failed at 2026-10-06 14:30 UTC: Stripe timed out");
    expect(autopay.lastSuccessAt).toBe("2026-10-05T14:30:00Z");
    expect(health.filter((j) => j.state !== "ok").map((j) => j.job)).toEqual(["autopay"]);
  });

  it("calls a job with no run at all missing, whatever the others did", () => {
    const rows = timely.filter((r) => r.job !== "billing-sweep");
    expect(state(rows, [], "ops-digest")).toMatchObject({
      "billing-sweep": "missing",
      autopay: "ok",
    });
    const sweep = jobHealth(rows, [], NOW).find((j) => j.job === "billing-sweep")!;
    expect(sweep.detail).toBe("no run recorded yet");
  });

  it("calls a job stale when its newest success is from before its latest slot", () => {
    // Autopay's 14:30 slot is thirty minutes old; yesterday's run does not cover it.
    const rows = [
      ...timely.filter((r) => r.job !== "autopay"),
      run("autopay", "2026-10-05T14:30:00Z"),
    ];
    const autopay = jobHealth(rows, [], NOW).find((j) => j.job === "autopay")!;
    expect(autopay.state).toBe("stale");
    expect(autopay.detail).toBe(
      "last succeeded 2026-10-05 14:30 UTC; a run was due at 2026-10-06 14:30 UTC",
    );
  });

  it("gives a job its grace period before its slot is due", () => {
    // At 14:59 autopay's 14:30 run is not yet expected; yesterday's still counts.
    const at = "2026-10-06T14:59:00.000Z";
    const rows = [run("autopay", "2026-10-05T14:30:00Z")];
    expect(jobHealth(rows, [], at).find((j) => j.job === "autopay")!.state).toBe("ok");
    expect(new Date(dueSlot(EXPECTED_JOBS[3], Date.parse(at))).toISOString()).toBe(
      "2026-10-05T14:30:00.000Z",
    );
    expect(
      jobHealth(rows, [], "2026-10-06T15:00:00.000Z").find((j) => j.job === "autopay")!.state,
    ).toBe("stale");
  });

  it("counts a success passed separately from the recent rows", () => {
    const rows = timely.filter((r) => r.job !== "assessments");
    const successes = [run("assessments", "2026-10-06T13:00:00Z")];
    expect(state(rows, successes, "ops-digest").assessments).toBe("ok");
  });

  it("does not let a run at UTC midnight or a run of another job stand in for the slot", () => {
    const rows = [
      ...timely.filter((r) => r.job !== "email-bills"),
      run("email-bills", "2026-10-06T00:00:00Z"),
    ];
    expect(state(rows, [], "ops-digest")["email-bills"]).toBe("stale");
  });
});

describe("the digest judging itself", () => {
  it("is healthy on its very first run, with no row of its own yet", () => {
    const rows = timely.filter((r) => r.job !== "ops-digest");
    const digest = jobHealth(rows, [], NOW, { running: "ops-digest" }).find(
      (j) => j.job === "ops-digest",
    )!;
    expect(digest.state).toBe("ok");
    expect(digest.detail).toBe("first recorded run is this one");
  });

  it("is healthy when yesterday's run is there, even when it starts late today", () => {
    expect(state(timely, [], "ops-digest")["ops-digest"]).toBe("ok");
    const late = jobHealth(timely, [], "2026-10-06T16:10:00.000Z", { running: "ops-digest" });
    expect(late.find((j) => j.job === "ops-digest")!.state).toBe("ok");
  });

  it("reports a lost heartbeat: the run before this one is missing", () => {
    const rows = [
      ...timely.filter((r) => r.job !== "ops-digest"),
      run("ops-digest", "2026-10-03T15:00:00Z"),
    ];
    const digest = jobHealth(rows, [], NOW, { running: "ops-digest" }).find(
      (j) => j.job === "ops-digest",
    )!;
    expect(digest.state).toBe("stale");
    expect(digest.detail).toBe(
      "last succeeded 2026-10-03 15:00 UTC; a run was due at 2026-10-05 15:00 UTC",
    );
  });

  it("shows on /admin as missing when it has never recorded a run", () => {
    const rows = timely.filter((r) => r.job !== "ops-digest");
    expect(state(rows)["ops-digest"]).toBe("missing");
  });
});
