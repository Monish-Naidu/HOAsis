import type {
  PhotoVantage,
  Violation,
  ViolationPhoto,
  ViolationReport,
} from "@/lib/types";

/**
 * Enforcement, and the rules about how it is allowed to start.
 *
 * Everything in this file exists to keep one line from being crossed. Every
 * management company and enforcement attorney that publishes guidance on this
 * converges on the same rule, and one puts it bluntly: a board cannot act on a
 * complaint unless somebody signs it. The softer and more useful version is
 * that **a complaint is an input to an investigation and never a basis for
 * enforcement**. Evidence gets gathered first, by the association, before any
 * notice exists.
 *
 * So a report is a separate record from a violation, it cannot be promoted
 * into one without a board member's own observation attached, and the reporter
 * is never named to the accused. The one thing the board is shown that the
 * reporter would not expect is the pattern of who reports whom, because that
 * pattern is a fair housing problem well before it is an enforcement one.
 */

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Whether a notice may be raised from this report yet.
 *
 * The gate is not "has an officer read it". It is "has somebody from the
 * association gone and looked, and written down what they saw". A notice that
 * rests on a neighbour's account is one the neighbour has to attend a hearing
 * to defend, which is exactly the position no volunteer board wants a
 * complainant in.
 */
export function canRaiseNotice(report: ViolationReport): boolean {
  return report.status === "verified" && Boolean(report.verification?.note.trim());
}

/** Reports still waiting on somebody going to look. */
export function unverifiedReports(reports: ViolationReport[]): ViolationReport[] {
  return reports.filter((r) => r.status === "new" || r.status === "verifying");
}

export interface ReportingPattern {
  reporterId: string;
  reporterName: string;
  subjectUnit: string;
  count: number;
  /** How many of those the board went out and confirmed. */
  verified: number;
  reports: ViolationReport[];
}

/**
 * One owner repeatedly reporting one neighbour.
 *
 * Surfaced to the board and to nobody else. Two reports about the same home
 * from the same person is where this starts being worth a look, because the
 * shape it can take is a dispute between two households that the association
 * is being used as an instrument in. It is also, when the households differ in
 * a way the Fair Housing Act cares about, the beginning of a complaint against
 * the association rather than against either of them.
 *
 * The ratio is the tell. Ten reports that all check out is a diligent
 * neighbour. Ten that never check out is something else, and a board that
 * cannot see the difference will treat both the same way.
 */
export function reportingPatterns(
  reports: ViolationReport[],
  minimum = 2,
): ReportingPattern[] {
  const groups = new Map<string, ViolationReport[]>();

  for (const report of reports) {
    const key = `${report.reporterId}|${report.subjectUnit}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }

  return [...groups.values()]
    .filter((group) => group.length >= minimum)
    .map((group) => ({
      reporterId: group[0].reporterId,
      reporterName: group[0].reporterName,
      subjectUnit: group[0].subjectUnit,
      count: group.length,
      verified: group.filter((r) => r.status === "verified").length,
      reports: [...group].sort((a, b) => b.submittedOn.localeCompare(a.submittedOn)),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * A report as the accused household is allowed to see it.
 *
 * Which is to say: not at all, in this product. There is no screen that shows
 * an owner who reported them, and this function exists so that the intent is
 * written down in code rather than only in a comment on a component that
 * somebody later copies. What an owner sees is the notice and the evidence
 * behind it, and both of those come from the association.
 */
export function redactReporter(report: ViolationReport): Omit<
  ViolationReport,
  "reporterId" | "reporterName" | "reporterUnit"
> {
  // The discard is the whole function.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { reporterId, reporterName, reporterUnit, ...rest } = report;
  return rest;
}

/* -------------------------------------------------------------------------- */
/* Photographs                                                                 */
/* -------------------------------------------------------------------------- */

export const VANTAGE_LABEL: Record<PhotoVantage, string> = {
  street: "From the street or sidewalk",
  "common-area": "From common property",
  "reporter-property": "From a neighbour's own property",
  "over-boundary": "Over a fence or boundary",
  aerial: "From a drone or above",
  unknown: "Vantage not recorded",
};

export interface PhotoConcern {
  photoId: string;
  severity: "review" | "warn";
  message: string;
}

/**
 * Photographs worth a second look before a notice goes out.
 *
 * Not a legal opinion, and deliberately not a block. The association may have
 * every right to the photograph; what it should not do is find out at the
 * hearing that the one piece of evidence it relied on was taken over a fence.
 * Naming it beforehand is cheap. Discovering it afterwards is not.
 */
export function photoConcerns(photos: ViolationPhoto[]): PhotoConcern[] {
  const concerns: PhotoConcern[] = [];

  for (const photo of photos) {
    if (photo.vantage === "over-boundary") {
      concerns.push({
        photoId: photo.id,
        severity: "warn",
        message:
          "Taken over a boundary rather than from the street or common property. Where an owner had a reasonable expectation of privacy, this is the photograph an appeal is built on. Rely on one taken from the public way if you have it.",
      });
    }
    if (photo.vantage === "aerial") {
      concerns.push({
        photoId: photo.id,
        severity: "warn",
        message:
          "Taken from above. Several states restrict drone photography of a residence without consent, and a rear yard visible only from the air is not visible from anywhere an owner expected to be seen from.",
      });
    }
    if (photo.vantage === "reporter-property") {
      concerns.push({
        photoId: photo.id,
        severity: "review",
        message:
          "Taken by or from a neighbour rather than by the association. Usable, but it makes the reporter a witness, and the association cannot then keep them out of the hearing.",
      });
    }
    if (photo.vantage === "unknown") {
      concerns.push({
        photoId: photo.id,
        severity: "review",
        message:
          "Nobody recorded where this was taken from. It is the first question at a hearing and the answer should not be a guess.",
      });
    }
  }

  return concerns;
}

/** Photographs the association can rely on without a conversation first. */
export function unencumberedPhotos(photos: ViolationPhoto[]): ViolationPhoto[] {
  return photos.filter((p) => p.vantage === "street" || p.vantage === "common-area");
}

/**
 * Whether the notice can stand on evidence nobody will argue about.
 *
 * A violation with five photographs and every one of them taken over a fence
 * has one photograph, for practical purposes, and that one is contested.
 */
export function evidenceIsClean(violation: Violation): boolean {
  return (
    violation.photos.length > 0 &&
    unencumberedPhotos(violation.photos).length === violation.photos.length
  );
}

/** Open matters, which is what a board is actually managing. */
export function openViolations(violations: Violation[]): Violation[] {
  return violations.filter((v) => v.stage !== "cured");
}
