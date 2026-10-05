import { describe, expect, it } from "vitest";
import {
  announcementEmail,
  assessmentDueEmail,
  autopayEmail,
  ballotOpenEmail,
  boardMessageEmail,
  confirmSignupEmail,
  inviteEmail,
  meetingNoticeEmail,
  pastDueEmail,
  requestUpdateEmail,
  trialEmail,
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
    // The first line of the body is also the hidden preheader, which used to
    // go out exactly as typed.
    expect(built.html).not.toContain("<b>");
  });
});

/**
 * Nothing a board or an owner typed may arrive as markup, in any template.
 * Every field a person can fill carries a tag here; the only tags allowed in
 * the result are the ones the template wrote itself. Subjects and the plain
 * text part stay as typed, because they are not HTML.
 */
describe("what people typed, in every template", () => {
  const TAG = `<a href="https://evil.example">Verify your bank details</a>`;
  const typed = (label: string) => `${label} & Sons ${TAG}`;
  const hostile = {
    associationName: typed("Smith"),
    ownerName: typed("Gwen"),
    url: "https://yourhoasis.com/auth/callback?token_hash=abc",
    unsubscribeUrl: null as string | null,
  };
  const dues = {
    associationName: hostile.associationName,
    ownerName: hostile.ownerName,
    unitLabel: typed("12B"),
    balanceCents: 28500,
    dueDate: "2026-10-01",
    payUrl: hostile.url,
    unsubscribeUrl: null,
  };

  const built: Record<string, { subject: string; html: string; text: string }> = {
    assessment: assessmentDueEmail(dues),
    pastDue: pastDueEmail({ ...dues, daysPastDue: 12 }),
    trial: trialEmail("3-days", {
      associationName: hostile.associationName,
      presidentName: typed("Dana"),
      trialEndsOn: "2026-10-20",
      homes: 20,
      monthlyCents: 4000,
      billingUrl: hostile.url,
    }),
    autopayCharged: autopayEmail("charged", {
      associationName: hostile.associationName,
      ownerName: hostile.ownerName,
      amountCents: 28500,
      method: typed("BECU checking"),
      payUrl: hostile.url,
    }),
    autopayFailed: autopayEmail("failed", {
      associationName: hostile.associationName,
      ownerName: hostile.ownerName,
      amountCents: 28500,
      method: typed("Visa"),
      problem: typed("Your card was declined"),
      payUrl: hostile.url,
    }),
    invite: inviteEmail({
      kind: "invite",
      associationName: hostile.associationName,
      associationPlace: typed("Bothell"),
      ownerName: hostile.ownerName,
      unitLabel: typed("12B"),
      url: hostile.url,
      hasAccount: false,
    }),
    welcome: inviteEmail({
      kind: "welcome",
      associationName: hostile.associationName,
      ownerName: hostile.ownerName,
      unitLabel: typed("12B"),
      url: hostile.url,
      hasAccount: true,
    }),
    announcement: announcementEmail({ ...hostile, title: typed("Pool"), body: `${typed("First line")}\n\nSecond.` }),
    meeting: meetingNoticeEmail({
      ...hostile,
      title: typed("Annual meeting"),
      date: "2026-10-14",
      time: "7:00 PM",
      location: typed("Clubhouse"),
      dialIn: typed("555-0100"),
      passcode: typed("1234"),
      agenda: [typed("Budget")],
    }),
    ballot: ballotOpenEmail({ ...hostile, title: typed("Budget"), body: [typed("Details")], closesDate: "2026-11-01" }),
    message: boardMessageEmail({
      ...hostile,
      subject: typed("About your fence"),
      body: typed("Thanks"),
      senderName: typed("Arya"),
      statutory: false,
    }),
    request: requestUpdateEmail({
      ...hostile,
      reference: "REQ-2026-014",
      title: typed("Front door"),
      status: "Approved",
      note: typed("Use the colour on file"),
    }),
  };

  it.each(Object.keys(built))("%s: no typed tag survives, and the one link is ours", (name) => {
    const { html } = built[name];
    expect(html).not.toContain("evil.example\">");
    expect(html).not.toContain("<a href=\"https://evil.example");
    expect(html).not.toContain("& Sons");
    expect(html).toContain("&amp; Sons");
    expect(links(html)).toEqual([hostile.url]);
  });

  it("escapes the header block every message shares: association name, preheader, button", () => {
    const { html } = built.assessment;
    const header = html.slice(html.indexOf("text-transform:uppercase"), html.indexOf("</p>", html.indexOf("text-transform:uppercase")));
    expect(header).toContain("Smith &amp; Sons &lt;a href=");
    const preheader = html.slice(html.indexOf("display:none"), html.indexOf("</div>"));
    expect(preheader).toContain("12B &amp; Sons &lt;a href=");
  });

  it("leaves subjects as typed, since a subject is not HTML", () => {
    expect(built.assessment.subject).toContain("Smith & Sons <a href=");
    expect(built.assessment.subject).not.toContain("&amp;");
    expect(built.autopayFailed.subject).not.toContain("&amp;");
    expect(built.trial.subject).not.toContain("&amp;");
  });

  it("does not escape twice", () => {
    for (const { html } of Object.values(built)) {
      expect(html).not.toContain("&amp;amp;");
      expect(html).not.toContain("&amp;lt;");
    }
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

/**
 * An owner the board only has an address for has no account, so no
 * preferences and no unsubscribe link. The footer must not tell them an
 * optional message "cannot be turned off", and the line under the button
 * must not promise a sign-in the join page does not do.
 */
describe("a notice to somebody with no account yet", () => {
  const seatless = { ...person, unsubscribeUrl: null, hasAccount: false };

  it("does not call an announcement something that cannot be turned off", () => {
    const built = announcementEmail({ ...seatless, title: "Pool party Saturday", body: "Bring a towel." });
    expect(built.html).not.toContain("cannot be turned off");
    expect(built.html).toContain("the board has this address on file");
    expect(built.html).toContain("Create your account to choose which emails you get.");
    expect(links(built.html)).toEqual([person.url]);
  });

  it("says the same on a note from the board and on a request update", () => {
    const note = boardMessageEmail({ ...seatless, subject: "About your fence", body: "Thanks.", senderName: "Arya Mehr", statutory: false });
    const update = requestUpdateEmail({ ...seatless, reference: "REQ-1", title: "Front door", status: "Approved", note: "Go ahead." });
    for (const built of [note, update]) {
      expect(built.html).not.toContain("cannot be turned off");
      expect(built.html).toContain("Create your account to choose which emails you get.");
    }
  });

  it("still says a statutory notice cannot be turned off, with the reason", () => {
    const built = boardMessageEmail({ ...seatless, subject: "Past due", body: "You owe $285.00.", senderName: "Dana Whitfield", statutory: true });
    expect(built.html).toContain("This is a notice about your account. It is sent to every owner and cannot be turned off.");
  });

  it("does not promise a sign-in the join page does not do", () => {
    const built = announcementEmail({ ...seatless, title: "Pool party Saturday", body: "Bring a towel." });
    expect(built.html).not.toContain("This link signs you in");
    // Somebody with an account does get a link that signs them in.
    const member = announcementEmail({ ...person, title: "Pool party Saturday", body: "Bring a towel." });
    expect(member.html).toContain("This link signs you in, so there is no password to remember.");
  });
});

describe("the line that says the link signs you in", () => {
  it("is left off the email that confirms a password just chosen", () => {
    const built = confirmSignupEmail({ name: "Gwen Okafor", confirmUrl: "https://yourhoasis.com/auth/callback?token_hash=x" });
    expect(built.html).not.toContain("no password to remember");
  });

  it("is left off an invitation that asks the person to create an account", () => {
    const invite = { kind: "invite" as const, associationName: "Maple Court HOA", ownerName: "Gwen Okafor", unitLabel: "12", url: person.url };
    expect(inviteEmail({ ...invite, hasAccount: false }).html).not.toContain("no password to remember");
    expect(inviteEmail({ ...invite, hasAccount: true }).html).toContain("no password to remember");
  });

  it("is left off the notices whose link is a plain address", () => {
    const trial = trialEmail("3-days", {
      associationName: "Maple Court HOA",
      presidentName: "Dana Whitfield",
      trialEndsOn: "2026-11-01",
      homes: 24,
      monthlyCents: 4800,
      billingUrl: "https://yourhoasis.com/board/settings",
    });
    const autopay = autopayEmail("charged", {
      associationName: "Maple Court HOA",
      ownerName: "Gwen Okafor",
      amountCents: 28500,
      method: "BECU checking ••1234",
      payUrl: "https://yourhoasis.com/resident/account",
    });
    expect(trial.html).not.toContain("This link signs you in");
    expect(autopay.html).not.toContain("This link signs you in");
  });

  it("stays on a dues notice, whose link does sign the owner in", () => {
    const built = assessmentDueEmail({
      associationName: "Maple Court HOA",
      ownerName: "Gwen Okafor",
      unitLabel: "12",
      balanceCents: 28500,
      dueDate: "2026-11-01",
      payUrl: person.url,
      unsubscribeUrl: null,
    });
    expect(built.html).toContain("This link signs you in, so there is no password to remember.");
  });
});
