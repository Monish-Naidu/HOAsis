/**
 * What an email provider's error means, in words a board member can act on.
 *
 * The email log and the toasts used to print the provider's own text
 * ("You can only send testing emails to your own email address..."), which
 * reads like the product is broken rather than not yet set up. The raw text
 * stays available (the log keeps it in a title) so nothing is hidden from
 * whoever has to chase it.
 */

/** The error as the send route and the log write it: "address: message" or just the message. */
export function plainEmailError(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "The email did not go out.";
  if (/only send testing emails|verify a domain|domain is not verified|domain.*not.*verified/i.test(text)) {
    return "Email is not set up to send to owners yet (the sending domain is not verified).";
  }
  if (/invalid.{0,12}`?to`?|invalid (email )?address|is not a valid (email )?address/i.test(text)) {
    return "That address is not valid.";
  }
  if (/could not be reached/i.test(text)) return "The mail service could not be reached.";
  return "The email service could not send it.";
}

/** What the send route answered, read by the screens that tell the board how it went. */
export interface SendOutcome {
  /** False when the route never answered: no network, or the call threw. */
  answered: boolean;
  sent: number;
  failed: number;
  already: number;
  remaining: number;
  /** The first provider or route error seen, raw. */
  reason?: string;
}

/** The sentence after "Email did not go out:", lower case at the start, no full stop. */
function reasonFragment(reason: string | undefined): string {
  const plain = plainEmailError(reason).replace(/\.$/, "");
  return plain.charAt(0).toLowerCase() + plain.slice(1);
}

/** The toast after a meeting notice is sent. The notice itself is always posted in the app. */
export function noticeToast(o: SendOutcome): string {
  if (o.sent > 0) {
    const missed = o.failed + o.remaining;
    return `Notice posted. Emailed ${o.sent} ${o.sent === 1 ? "owner" : "owners"}.${
      missed > 0 ? ` ${missed} ${missed === 1 ? "email" : "emails"} did not go out.` : ""
    }`;
  }
  if (!o.answered || o.failed > 0 || o.remaining > 0 || o.reason) {
    return `Notice posted in the app. Email did not go out: ${reasonFragment(o.reason)}.`;
  }
  if (o.already > 0) return "Notice posted. Every owner already had it by email in the last hour.";
  return "Notice posted. No owner has an email address on file.";
}

/** How a board reply's email went. "none": no email was attempted (the demo, or no household). */
export type ReplyEmail = "sent" | "failed" | "none";

/** The toast after a board reply. */
export function replyToast(email: ReplyEmail, to?: string): string {
  if (email === "sent") return to ? `Reply sent to ${to}` : "Reply sent";
  if (email === "failed") return "Reply posted. The email did not go out.";
  return "Reply posted.";
}

/** Folds a send outcome into the two states a reply toast reports on. */
export function replyEmailState(o: SendOutcome): ReplyEmail {
  return o.answered && o.sent > 0 ? "sent" : "failed";
}
