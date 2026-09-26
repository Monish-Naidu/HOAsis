import { describe, expect, it } from "vitest";
import {
  announcementEmail,
  ballotOpenEmail,
  boardMessageEmail,
  meetingNoticeEmail,
  requestUpdateEmail,
} from "@/lib/email/templates";

/**
 * The board notices. Two rules hold for all of them: one link, and the
 * footer tells the truth about whether the person can turn them off.
 */

const person = {
  associationName: "Maple Court HOA",
  ownerName: "Gwen Okafor",
  url: "https://yourhoasis.com/auth/callback?token=abc",
  unsubscribeUrl: "https://yourhoasis.com/unsubscribe?p=1&c=community&t=x" as string | null,
};

/** Every href in the HTML, so "one link" is a count and not a feeling. */
function links(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

describe("announcementEmail", () => {
  it("carries the title in the subject, the body as typed, and one link plus the opt out", () => {
    const built = announcementEmail({
      ...person,
      title: "Pool closes Friday",
      body: "The pool closes Friday for resurfacing.\n\nIt reopens in two weeks.",
    });
    expect(built.subject).toBe("Pool closes Friday · Maple Court HOA");
    expect(built.html).toContain("The pool closes Friday for resurfacing.");
    expect(built.html).toContain("It reopens in two weeks.");
    expect(links(built.html)).toEqual([person.url, person.unsubscribeUrl]);
    expect(built.text).toContain("Unsubscribe: ");
  });

  it("escapes what the board typed rather than rendering it", () => {
    const built = announcementEmail({
      ...person,
      title: "<script>alert(1)</script>",
      body: "Rates go up 5% & fees <b>too</b>",
    });
    expect(built.html).not.toContain("<script>");
    expect(built.html).toContain("&lt;script&gt;");
    expect(built.html).toContain("5% &amp; fees &lt;b&gt;too&lt;/b&gt;");
  });
});

describe("meetingNoticeEmail", () => {
  const meeting = {
    ...person,
    unsubscribeUrl: null,
    title: "Annual meeting",
    date: "2026-10-14",
    time: "7:00 PM",
    location: "Clubhouse",
    dialIn: "https://meet.example/abc",
    passcode: "1234",
    agenda: ["Budget", "Elect two directors"],
  };

  it("puts the date in the subject and the agenda in the body", () => {
    const built = meetingNoticeEmail(meeting);
    expect(built.subject).toBe("Notice of meeting: Annual meeting, October 14, 2026 at 7:00 PM · Maple Court HOA");
    expect(built.html).toContain("<li>Budget</li>");
    expect(built.html).toContain("<li>Elect two directors</li>");
    expect(built.html).toContain("passcode 1234");
    expect(built.text).toContain("1. Budget");
  });

  it("is statutory: no unsubscribe link, and the footer says so", () => {
    const built = meetingNoticeEmail(meeting);
    expect(links(built.html)).toEqual([person.url]);
    expect(built.html).toContain("cannot be turned off");
    expect(built.text).not.toContain("Unsubscribe");
  });
});

describe("ballotOpenEmail", () => {
  it("names the closing date in the subject and offers one link to vote", () => {
    const built = ballotOpenEmail({
      ...person,
      unsubscribeUrl: null,
      title: "Adopt the 2027 budget",
      body: ["The board proposes a 3% increase.", "Details are attached in the portal."],
      closesDate: "2026-11-01",
    });
    expect(built.subject).toBe("Vote by November 1, 2026: Adopt the 2027 budget · Maple Court HOA");
    expect(built.html).toContain("Voting is open until November 1, 2026. One vote per home.");
    expect(built.html).toContain("Cast my vote");
    expect(links(built.html)).toEqual([person.url]);
  });
});

describe("boardMessageEmail", () => {
  it("sends a note under the board's own subject with a way out", () => {
    const built = boardMessageEmail({
      ...person,
      subject: "About your fence",
      body: "Thanks for the photos. The committee meets Tuesday.",
      senderName: "Arya Mehr",
      statutory: false,
    });
    expect(built.subject).toBe("About your fence · Maple Court HOA");
    expect(built.html).toContain("Arya Mehr, for the board");
    expect(built.html).toContain("Reply");
    expect(links(built.html)).toEqual([person.url, person.unsubscribeUrl]);
  });

  it("sends a dues letter as a notice about the account, with no opt out", () => {
    const built = boardMessageEmail({
      ...person,
      unsubscribeUrl: null,
      subject: "Your account is 30 days past due",
      body: "Gwen,\n\nYour account carries $285.00.",
      senderName: "Dana Whitfield",
      statutory: true,
    });
    expect(built.html).toContain("See my account");
    expect(built.html).toContain("This is a notice about your account.");
    expect(links(built.html)).toEqual([person.url]);
    expect(built.text).not.toContain("Unsubscribe");
  });
});

describe("requestUpdateEmail", () => {
  it("leads with the new status and the board's note", () => {
    const built = requestUpdateEmail({
      ...person,
      reference: "REQ-2026-014",
      title: "Replace the front door",
      status: "Approved",
      note: "Approved by the board. Use the colour on file.",
    });
    expect(built.subject).toBe("Approved: Replace the front door · REQ-2026-014");
    expect(built.html).toContain("Replace the front door is approved");
    expect(built.html).toContain("Gwen, the board updated request REQ-2026-014.");
    expect(built.html).toContain("Use the colour on file.");
    expect(links(built.html)).toEqual([person.url, person.unsubscribeUrl]);
  });
});
