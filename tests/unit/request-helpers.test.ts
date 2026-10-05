import { describe, expect, it } from "vitest";
import { requests } from "@/lib/data/requests";
import {
  CERTIFICATE_VALID_DAYS,
  certificateMailto,
  certificateValidThrough,
} from "@/lib/request-certificate";
import { confirmedReference } from "@/lib/request-reference";

/**
 * The number on the "Request submitted" screen. For a real association the
 * form can only guess it, and the database renumbers a guess that is taken.
 */
describe("confirmedReference", () => {
  it("never shows a real association the form's guess", () => {
    // Owner B has no requests, so the form says 200. A neighbour already
    // holds 200 and the database stored this one as 201.
    expect(confirmedReference({ isRemote: true, guessed: "REQ-2026-200" })).toBeNull();
    expect(confirmedReference({ isRemote: true, guessed: "REQ-2026-200", stored: true })).toBeNull();
  });

  it("shows what the database stored once the write answers with it", () => {
    expect(
      confirmedReference({ isRemote: true, guessed: "REQ-2026-200", stored: "REQ-2026-201" }),
    ).toBe("REQ-2026-201");
  });

  it("shows the demo its own number, which nothing renumbers", () => {
    expect(confirmedReference({ isRemote: false, guessed: "REQ-2026-205" })).toBe("REQ-2026-205");
  });
});

describe("the approval certificate", () => {
  const fence = requests.find((r) => r.reference === "REQ-2026-118")!;

  it("is valid for 180 days from the decision on the record", () => {
    expect(CERTIFICATE_VALID_DAYS).toBe(180);
    // The date the screen used to carry as a literal.
    expect(certificateValidThrough(fence)).toBe("2027-02-08");
    expect(certificateValidThrough({ decisionDate: "2026-10-04" })).toBe("2027-04-02");
    expect(certificateValidThrough({})).toBeUndefined();
  });

  it("writes the certificate into an email the owner addresses", () => {
    const href = certificateMailto(fence);
    expect(href.startsWith("mailto:?subject=")).toBe(true);
    const params = new URLSearchParams(href.slice("mailto:?".length));
    expect(params.get("subject")).toBe("Approval certificate ARC-2026-118-A7F3");
    expect(params.get("body")).toBe(
      [
        "Replace rear fence with 6' vinyl privacy fence",
        "",
        "Certificate: ARC-2026-118-A7F3",
        "Approved: August 12, 2026",
        "Decided by: Architectural Review Committee",
        "Valid through: February 8, 2027",
        "Request: REQ-2026-118",
      ].join("\n"),
    );
    // Spaces are %20, not "+", which a mail app would print as a plus.
    expect(href).not.toContain("+");
  });
});
