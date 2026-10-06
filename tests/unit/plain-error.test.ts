import { describe, expect, it } from "vitest";
import { noticeToast, plainEmailError, replyEmailState, replyToast } from "@/lib/email/plain-error";

const none = { answered: true, sent: 0, failed: 0, already: 0, remaining: 0 };

describe("plainEmailError", () => {
  it("names the unverified sending domain", () => {
    const raw = "x@y.com: You can only send testing emails to your own email address (me@mail.com). To send emails to other recipients, please verify a domain at resend.com/domains";
    expect(plainEmailError(raw)).toBe(
      "Email is not set up to send to owners yet (the sending domain is not verified).",
    );
  });

  it("names an address that is not valid", () => {
    expect(plainEmailError("Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.")).toBe(
      "That address is not valid.",
    );
  });

  it("falls back to a plain sentence, never the provider's own words", () => {
    expect(plainEmailError("rate_limit_exceeded: 429")).toBe("The email service could not send it.");
    expect(plainEmailError("")).toBe("The email did not go out.");
    expect(plainEmailError(undefined)).toBe("The email did not go out.");
  });
});

describe("noticeToast", () => {
  it("counts the owners emailed", () => {
    expect(noticeToast({ ...none, sent: 38 })).toBe("Notice posted. Emailed 38 owners.");
    expect(noticeToast({ ...none, sent: 1 })).toBe("Notice posted. Emailed 1 owner.");
  });

  it("says how many fell short when some did", () => {
    expect(noticeToast({ ...none, sent: 38, failed: 2 })).toBe(
      "Notice posted. Emailed 38 owners. 2 emails did not go out.",
    );
  });

  it("says the email did not go out, and why, when none did", () => {
    expect(noticeToast({ ...none, failed: 40, reason: "only send testing emails" })).toBe(
      "Notice posted in the app. Email did not go out: email is not set up to send to owners yet (the sending domain is not verified).",
    );
    expect(noticeToast({ ...none, answered: false, reason: "The mail service could not be reached" })).toBe(
      "Notice posted in the app. Email did not go out: the mail service could not be reached.",
    );
  });

  it("does not call a notice that nobody needed a failure", () => {
    expect(noticeToast({ ...none, already: 5 })).toBe("Notice posted. Every owner already had it by email in the last hour.");
    expect(noticeToast(none)).toBe("Notice posted. No owner has an email address on file.");
  });
});

describe("replies", () => {
  it("is sent only when an email went", () => {
    expect(replyEmailState({ ...none, sent: 1 })).toBe("sent");
    expect(replyEmailState({ ...none, failed: 1 })).toBe("failed");
    expect(replyEmailState({ ...none, answered: false })).toBe("failed");
  });

  it("tells the truth in the toast", () => {
    expect(replyToast("sent", "Nina")).toBe("Reply sent to Nina");
    expect(replyToast("failed", "Nina")).toBe("Reply posted. The email did not go out.");
    expect(replyToast("none", "Nina")).toBe("Reply posted.");
  });
});
