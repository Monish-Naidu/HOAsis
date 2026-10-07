import { describe, expect, it } from "vitest";
import {
  canRaiseNotice,
  evidenceIsClean,
  photoConcerns,
  queueBuckets,
  redactReporter,
  reportingPatterns,
  unencumberedPhotos,
  unverifiedReports,
  violationSource,
} from "@/lib/violations";
import { violationReports, violations } from "@/lib/data/requests";
import type { Violation, ViolationPhoto, ViolationReport } from "@/lib/types";

/**
 * The one line this part of the product is not allowed to cross.
 *
 * A complaint is an input to an investigation and never a basis for
 * enforcement. Most of these tests are about the gap between those two things
 * staying open, because the change that closes it will look like a
 * convenience: one button that turns a report into a notice.
 */

function report(patch: Partial<ViolationReport> = {}): ViolationReport {
  return {
    id: "rep-1",
    reference: "REP-1",
    reporterId: "own-1",
    reporterName: "A Neighbour",
    reporterUnit: "1",
    subjectUnit: "2",
    what: "Something",
    observedOn: "2026-08-01",
    submittedOn: "2026-08-02",
    status: "new",
    ...patch,
  };
}

function photo(patch: Partial<ViolationPhoto> = {}): ViolationPhoto {
  return {
    id: "p1",
    brief: "Something",
    takenOn: "2026-08-01",
    takenBy: "Arya Mehr, President",
    vantage: "street",
    ...patch,
  };
}

describe("canRaiseNotice", () => {
  it("refuses a report nobody has gone to look at", () => {
    expect(canRaiseNotice(report({ status: "new" }))).toBe(false);
    expect(canRaiseNotice(report({ status: "verifying" }))).toBe(false);
  });

  it("refuses a report marked verified with nothing written down", () => {
    // Ticking a box is not an investigation. The note is the evidence, and
    // without it the notice still rests on the neighbour's account.
    expect(
      canRaiseNotice(
        report({
          status: "verified",
          verification: { by: "Arya Mehr", on: "2026-08-03", note: "   " },
        }),
      ),
    ).toBe(false);
  });

  it("allows one where somebody looked and wrote what they saw", () => {
    expect(
      canRaiseNotice(
        report({
          status: "verified",
          verification: {
            by: "Arya Mehr",
            on: "2026-08-03",
            note: "Walked the street at 6:40am. Truck present.",
          },
        }),
      ),
    ).toBe(true);
  });

  it("refuses a dismissed report even with a note on it", () => {
    expect(
      canRaiseNotice(
        report({
          status: "dismissed",
          verification: { by: "Arya Mehr", on: "2026-08-03", note: "Looked, nothing there." },
        }),
      ),
    ).toBe(false);
  });

  it("holds for every seeded report that became a violation", () => {
    for (const violation of violations) {
      if (!violation.reportId) continue;
      const source = violationReports.find((r) => r.id === violation.reportId)!;
      expect(
        canRaiseNotice(source),
        `${violation.reference} rests on a report nobody verified`,
      ).toBe(true);
    }
  });
});

describe("reportingPatterns", () => {
  it("finds one owner reporting one neighbour more than once", () => {
    const patterns = reportingPatterns([
      report({ id: "a", reporterId: "own-44", subjectUnit: "45" }),
      report({ id: "b", reporterId: "own-44", subjectUnit: "45" }),
      report({ id: "c", reporterId: "own-31", subjectUnit: "29" }),
    ]);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].count).toBe(2);
    expect(patterns[0].subjectUnit).toBe("45");
  });

  it("does not flag one owner reporting several different neighbours", () => {
    // A person who notices things is not the same as a person with a grudge,
    // and treating them the same is how a board stops looking at either.
    const patterns = reportingPatterns([
      report({ id: "a", reporterId: "own-44", subjectUnit: "45" }),
      report({ id: "b", reporterId: "own-44", subjectUnit: "46" }),
      report({ id: "c", reporterId: "own-44", subjectUnit: "47" }),
    ]);
    expect(patterns).toEqual([]);
  });

  it("does not flag several neighbours reporting the same home", () => {
    const patterns = reportingPatterns([
      report({ id: "a", reporterId: "own-1", subjectUnit: "9" }),
      report({ id: "b", reporterId: "own-2", subjectUnit: "9" }),
    ]);
    expect(patterns).toEqual([]);
  });

  it("counts how many of them actually checked out", () => {
    // Ten that all check out is a diligent neighbour. Ten that never do is
    // something else, and the ratio is the only thing that tells them apart.
    const patterns = reportingPatterns([
      report({ id: "a", reporterId: "own-44", subjectUnit: "45", status: "verified" }),
      report({ id: "b", reporterId: "own-44", subjectUnit: "45", status: "new" }),
      report({ id: "c", reporterId: "own-44", subjectUnit: "45", status: "dismissed" }),
    ]);
    expect(patterns[0].count).toBe(3);
    expect(patterns[0].verified).toBe(1);
  });

  it("finds the pattern that is actually in the seeded data", () => {
    const patterns = reportingPatterns(violationReports);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].reporterName).toBe("Hollis Nakamura");
    expect(patterns[0].subjectUnit).toBe("45");
    // Neither has been verified, which is the part worth a board's attention.
    expect(patterns[0].verified).toBe(0);
  });
});

describe("redactReporter", () => {
  it("removes every trace of who reported it", () => {
    const redacted = redactReporter(report()) as Record<string, unknown>;
    expect(redacted.reporterId).toBeUndefined();
    expect(redacted.reporterName).toBeUndefined();
    expect(redacted.reporterUnit).toBeUndefined();
    // And keeps what the accused is entitled to.
    expect(redacted.what).toBe("Something");
  });
});

describe("unverifiedReports", () => {
  it("is what a board still owes somebody a walk down the street for", () => {
    expect(
      unverifiedReports([
        report({ id: "a", status: "new" }),
        report({ id: "b", status: "verifying" }),
        report({ id: "c", status: "verified" }),
        report({ id: "d", status: "dismissed" }),
      ]).map((r) => r.id),
    ).toEqual(["a", "b"]);
  });
});

describe("photoConcerns", () => {
  it("says nothing about a photograph taken from the street", () => {
    expect(photoConcerns([photo({ vantage: "street" })])).toEqual([]);
    expect(photoConcerns([photo({ vantage: "common-area" })])).toEqual([]);
  });

  it("warns about one taken over a fence", () => {
    const [concern] = photoConcerns([photo({ vantage: "over-boundary" })]);
    expect(concern.severity).toBe("warn");
    expect(concern.message).toContain("reasonable expectation of privacy");
  });

  it("warns about one taken from a drone", () => {
    const [concern] = photoConcerns([photo({ vantage: "aerial" })]);
    expect(concern.severity).toBe("warn");
  });

  it("flags a neighbour's photograph as making them a witness", () => {
    const [concern] = photoConcerns([photo({ vantage: "reporter-property" })]);
    expect(concern.severity).toBe("review");
    expect(concern.message).toContain("witness");
  });

  it("flags a photograph nobody recorded a vantage for", () => {
    // It is the first question at a hearing, and the answer should not be a
    // guess made two months later.
    const [concern] = photoConcerns([photo({ vantage: "unknown" })]);
    expect(concern.severity).toBe("review");
  });

  it("catches the one in the seeded hearing file", () => {
    const hearing = violations.find((v) => v.stage === "hearing")!;
    const concerns = photoConcerns(hearing.photos);
    expect(concerns, "the over-the-fence photograph was not flagged").toHaveLength(1);
    expect(concerns[0].severity).toBe("warn");
  });
});

describe("evidenceIsClean", () => {
  const base: Violation = {
    id: "v",
    reference: "VIO-1",
    homeId: "own-1",
    ownerName: "Somebody",
    unit: "1",
    rule: "A rule",
    ruleCitation: "Rules & Regs §1.1",
    stage: "courtesy",
    openedDate: "2026-08-01",
    nextActionDate: "2026-08-15",
    photos: [],
    fineCents: 0,
  };

  it("is false when there is no evidence at all", () => {
    expect(evidenceIsClean(base)).toBe(false);
  });

  it("is false when any photograph is contestable", () => {
    // Four clean photographs and one over a fence is not four fifths fine.
    // The contested one is the one that gets talked about.
    expect(
      evidenceIsClean({
        ...base,
        photos: [photo({ id: "a" }), photo({ id: "b", vantage: "over-boundary" })],
      }),
    ).toBe(false);
  });

  it("is true when every photograph came from somewhere public", () => {
    expect(
      evidenceIsClean({
        ...base,
        photos: [photo({ id: "a" }), photo({ id: "b", vantage: "common-area" })],
      }),
    ).toBe(true);
  });

  it("counts what is left once the contestable ones come out", () => {
    expect(
      unencumberedPhotos([
        photo({ id: "a" }),
        photo({ id: "b", vantage: "over-boundary" }),
        photo({ id: "c", vantage: "common-area" }),
      ]).map((p) => p.id),
    ).toEqual(["a", "c"]);
  });
});

describe("the seeded enforcement file", () => {
  it("gives every violation the evidence behind it", () => {
    for (const violation of violations) {
      expect(violation.photos.length, `${violation.reference} has no evidence`).toBeGreaterThan(0);
      for (const p of violation.photos) {
        // The brief is what the accused owner is entitled to be told, and it
        // is carried whether or not an image exists.
        expect(p.brief.length, `${p.id} does not say what it shows`).toBeGreaterThan(20);
        expect(p.takenBy.length).toBeGreaterThan(0);
      }
    }
  });

  it("points every report that became a notice at a violation that exists", () => {
    const ids = new Set(violations.map((v) => v.id));
    for (const r of violationReports) {
      if (!r.violationId) continue;
      expect(ids.has(r.violationId), `${r.reference} points at nothing`).toBe(true);
    }
  });

  it("never has a violation citing a report that was dismissed", () => {
    for (const violation of violations) {
      if (!violation.reportId) continue;
      const source = violationReports.find((r) => r.id === violation.reportId)!;
      expect(source.status).toBe("verified");
    }
  });
});

describe("queueBuckets", () => {
  // TODAY is pinned to 2026-08-20. The seeded notices are all more than five
  // days out and the county deadline more than fourteen, so the first tab is
  // exactly the reports nobody has looked at.
  const buckets = queueBuckets({ violations, violationReports });

  it("puts every unlooked-at report on the first tab and nothing else", () => {
    expect(buckets.needsYou.map((i) => i.id).sort()).toEqual(
      ["rep-2026-020", "rep-2026-021", "rep-2026-022"].sort(),
    );
  });

  it("does not list a report that became a notice as its own row", () => {
    // It rides inside the violation it became, so the board sees who
    // reported it without the complaint appearing twice.
    const ids = new Set(buckets.open.map((i) => i.id));
    expect(ids.has("rep-2026-018")).toBe(false);
    expect(ids.has("rep-2026-012")).toBe(false);
    expect(ids.has("vio-1")).toBe(true);
  });

  it("keeps the county notice open with its deadline, and not yet asking", () => {
    const city = buckets.open.find((i) => i.id === "vio-5");
    expect(city?.source).toBe("city");
    expect(city?.date).toBe("2026-09-12");
    expect(buckets.needsYou.some((i) => i.id === "vio-5")).toBe(false);
  });

  it("asks once a notice is due this week", () => {
    const soon = queueBuckets({
      violations: violations.map((v) =>
        v.id === "vio-2" ? { ...v, nextActionDate: "2026-08-24" } : v,
      ),
      violationReports,
    });
    expect(soon.needsYou.some((i) => i.id === "vio-2")).toBe(true);
  });

  it("asks for a confirmed report that has no notice yet", () => {
    const confirmed = queueBuckets({
      violations,
      violationReports: violationReports.map((r) =>
        r.id === "rep-2026-022"
          ? {
              ...r,
              status: "verified" as const,
              verification: { by: "Arya Mehr", on: "2026-08-19", note: "Saw it." },
            }
          : r,
      ),
    });
    expect(confirmed.needsYou.some((i) => i.id === "rep-2026-022")).toBe(true);
  });

  it("resolves cured notices and dismissed reports, newest first", () => {
    expect(buckets.resolved.map((i) => i.id)).toEqual(["rep-2026-019", "vio-4"]);
  });

  it("infers a source for notices written before the field existed", () => {
    expect(violationSource(violations.find((v) => v.id === "vio-1")!)).toBe("neighbor");
    expect(violationSource(violations.find((v) => v.id === "vio-2")!)).toBe("board");
    expect(violationSource(violations.find((v) => v.id === "vio-5")!)).toBe("city");
  });
});
