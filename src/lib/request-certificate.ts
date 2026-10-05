import type { HomeRequest } from "@/lib/types";
import { addDays, formatDate } from "@/lib/utils";

/**
 * The approval certificate on an approved request.
 *
 * The card showed "Valid through February 8, 2027" as a literal and two
 * buttons that did nothing. The date is the decision plus 180 days, which is
 * what the literal was for the one request that carried it, so it is derived
 * here and every certificate gets its own.
 */

/** How long an approval stands before the work has to be re-approved. */
export const CERTIFICATE_VALID_DAYS = 180;

/** The last day the approval is good for, or undefined with no decision on record. */
export function certificateValidThrough(
  request: Pick<HomeRequest, "decisionDate">,
): string | undefined {
  return request.decisionDate ? addDays(request.decisionDate, CERTIFICATE_VALID_DAYS) : undefined;
}

/**
 * A `mailto:` link that opens the owner's own mail with the certificate
 * written out, ready to address to a contractor or the permit office. No
 * recipient: only the owner knows who it is for.
 */
export function certificateMailto(
  request: Pick<
    HomeRequest,
    "reference" | "title" | "certificateId" | "decisionDate" | "decidedBy"
  >,
): string {
  const validThrough = certificateValidThrough(request);
  const lines = [
    request.title,
    "",
    `Certificate: ${request.certificateId ?? ""}`,
    request.decisionDate ? `Approved: ${formatDate(request.decisionDate, "long")}` : "",
    request.decidedBy ? `Decided by: ${request.decidedBy}` : "",
    validThrough ? `Valid through: ${formatDate(validThrough, "long")}` : "",
    `Request: ${request.reference}`,
  ].filter((line, i) => line !== "" || i === 1);
  const subject = `Approval certificate ${request.certificateId ?? request.reference}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
