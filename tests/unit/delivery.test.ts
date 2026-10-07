import { describe, expect, it } from "vitest";
import {
  NOTICE_RULES,
  audienceFor,
  electronicIsEnough,
  hasConsent,
  noticeRule,
  reachability,
  smsReadiness,
  withinSendingHours,
  type ContactConsent,
} from "@/lib/delivery";
import type { Home } from "@/lib/types";

/**
 * Which notices may go which way.
 *
 * The failure being tested for is the quiet one. Sending a lien warning by
 * email works: the message goes, the board believes it gave notice, and the
 * defect only appears at the point somebody is losing a house over it. So the
 * rule that mail is sometimes the notice rather than the slow version of it
 * has to hold in the layer rather than in a paragraph on a screen.
 */

function home(patch: Partial<Home> = {}): Home {
  return {
    id: "own-1",
    displayName: "A Household",
    members: ["A Household"],
    email: "a@example.com",
    phone: "2065550100",
    unit: "1",
    address: "1 Any Street",
    moveInDate: "2020-01-01",
    balanceCents: 0,
    autopay: false,
    standing: "current",
    daysPastDue: 0,
    ...patch,
  };
}

const REGISTERED = { registered: true, missing: [] };
const NOT_REGISTERED = { registered: false, missing: ["A registered brand"] };
const CONSENTED: ContactConsent = {
  sms: { grantedOn: "2026-01-10", how: "Asked in the portal" },
};

describe("what mail is for", () => {
  it("keeps paper as the notice for anything that can end in a lien", () => {
    expect(electronicIsEnough("lien-warning")).toBe(false);
    expect(electronicIsEnough("hearing-notice")).toBe(false);
    expect(electronicIsEnough("violation-notice")).toBe(false);
  });

  it("does not put paper in the way of an announcement", () => {
    expect(electronicIsEnough("general")).toBe(true);
    expect(electronicIsEnough("dues-reminder")).toBe(true);
  });

  it("never lets a lien warning go by text", () => {
    // The one that has to hold. A texted preforeclosure warning is not a
    // cheaper notice, it is not notice.
    const rows = reachability(home(), "lien-warning", CONSENTED, REGISTERED);
    const sms = rows.find((r) => r.channel === "sms")!;
    expect(sms.usable).toBe(false);
    expect(sms.blocker).toContain("cannot go by text");
  });

  it("says why on every rule, so a board can argue with it", () => {
    for (const rule of NOTICE_RULES) {
      expect(rule.why.length, `${rule.kind} does not say why`).toBeGreaterThan(30);
    }
  });

  it("falls back to the harmless rule rather than throwing on an unknown kind", () => {
    // @ts-expect-error deliberately outside the union, which is what a stored
    // value from an older build looks like.
    expect(noticeRule("something-new").kind).toBe("general");
  });
});

describe("consent to be texted", () => {
  it("is not implied by having somebody's phone number", () => {
    const rows = reachability(home(), "dues-reminder", undefined, REGISTERED);
    const sms = rows.find((r) => r.channel === "sms")!;
    expect(sms.usable).toBe(false);
    expect(sms.blocker).toContain("not agreed");
  });

  it("counts once it has been given, with a date", () => {
    expect(hasConsent({ grantedOn: "2026-01-10" })).toBe(true);
    expect(hasConsent({})).toBe(false);
    expect(hasConsent(undefined)).toBe(false);
  });

  it("stops the moment they say stop", () => {
    // There is no override anywhere in this product, and there should not be.
    expect(hasConsent({ grantedOn: "2026-01-10", revokedOn: "2026-05-01" })).toBe(false);
  });

  it("comes back on if they opt in again afterwards", () => {
    expect(hasConsent({ revokedOn: "2026-05-01", grantedOn: "2026-06-01" })).toBe(true);
  });
});

describe("being allowed to text at all", () => {
  it("refuses until the carriers know who the association is", () => {
    // Unregistered traffic is filtered silently, so a button that appears to
    // work and does nothing is the worst of the options.
    const rows = reachability(home(), "dues-reminder", CONSENTED, NOT_REGISTERED);
    const sms = rows.find((r) => r.channel === "sms")!;
    expect(sms.usable).toBe(false);
    expect(sms.blocker).toContain("not registered");
  });

  it("names everything that is still missing", () => {
    const readiness = smsReadiness({});
    expect(readiness.registered).toBe(false);
    expect(readiness.missing).toHaveLength(3);
    expect(readiness.missing.join(" ")).toContain("EIN");
  });

  it("is ready only when all three are done", () => {
    expect(
      smsReadiness({ ein: "12-3456789", brandRegistered: true, campaignApproved: true })
        .registered,
    ).toBe(true);
    expect(
      smsReadiness({ ein: "12-3456789", brandRegistered: true }).registered,
    ).toBe(false);
  });

  it("sends inside the hours the TCPA allows and not outside them", () => {
    // Not waivable by consent, and a reminder at 6am is a complaint whether
    // or not it was legal.
    expect(withinSendingHours(8)).toBe(true);
    expect(withinSendingHours(20)).toBe(true);
    expect(withinSendingHours(7)).toBe(false);
    expect(withinSendingHours(21)).toBe(false);
  });
});

describe("reachability", () => {
  it("returns a verdict for every channel rather than a shorter list", () => {
    // "We could not text them" is information. A silently shorter list is not.
    const rows = reachability(home(), "general", CONSENTED, REGISTERED);
    expect(rows.map((r) => r.channel)).toEqual(["email", "sms", "portal", "mail"]);
    expect(rows.every((r) => r.usable || r.blocker)).toBe(true);
  });

  it("says no email on file rather than failing quietly", () => {
    const rows = reachability(home({ email: "  " }), "general", CONSENTED, REGISTERED);
    expect(rows.find((r) => r.channel === "email")!.blocker).toBe("No email on file");
  });

  it("keeps the portal open for anything it may carry", () => {
    const rows = reachability(home({ email: "" }), "general", undefined, NOT_REGISTERED);
    expect(rows.find((r) => r.channel === "portal")!.usable).toBe(true);
  });

  it("cannot reach a household with no email, no consent and no address", () => {
    const rows = reachability(
      home({ email: "", phone: "", address: "" }),
      "lien-warning",
      undefined,
      NOT_REGISTERED,
    );
    expect(rows.every((r) => !r.usable)).toBe(true);
  });
});

describe("audienceFor", () => {
  const roster = [
    home({ id: "a" }),
    home({ id: "b", email: "" }),
    home({ id: "c", phone: "" }),
  ];
  const consent = { a: CONSENTED, b: CONSENTED, c: CONSENTED };

  it("counts each channel across the whole roster", () => {
    const audience = audienceFor(roster, "general", consent, REGISTERED);
    expect(audience.total).toBe(3);
    expect(audience.byChannel.email).toBe(2);
    // b has no email but does have a consented number; c has neither.
    expect(audience.byChannel.sms).toBe(2);
    expect(audience.byChannel.portal).toBe(3);
  });

  it("says plainly when the whole roster has to get paper", () => {
    const audience = audienceFor(roster, "lien-warning", consent, REGISTERED);
    expect(audience.mailIsTheNotice).toBe(true);
    expect(audience.mailOnly).toBe(3);
  });

  it("counts households nothing can reach", () => {
    const audience = audienceFor(
      [home({ id: "z", email: "", phone: "", address: "" })],
      "lien-warning",
      {},
      NOT_REGISTERED,
    );
    expect(audience.unreachable).toBe(1);
  });
});
