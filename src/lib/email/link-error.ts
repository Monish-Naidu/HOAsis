/**
 * What the sign-in page says when an emailed link did not work.
 *
 * The auth callback sends a failed link back to /signin with Supabase's own
 * error and with `next`, where the link was going. A reset link is bound for
 * /auth/reset, and that is how it is told apart: the person behind it cannot
 * sign in, which is why they asked, so "sign in below" is the one piece of
 * advice that is no use to them. They are told how to get another link.
 *
 * Reset links used to work only in the browser that asked for them, so one
 * opened from a mail app or on a phone failed every time. The emailed link
 * is now verified on the server (scripts/setup-resend.mjs sets the
 * template), but a link can still be old, or already spent by a mail scanner
 * that opened it first.
 *
 * Pure, and safe to import from a client component: nothing here touches the
 * mail provider or the database.
 */
export function readableLinkError(raw: string, next?: string | null): string {
  const text = raw.toLowerCase();
  if ((next ?? "").split(/[?#]/)[0] === "/auth/reset") {
    return "That reset link did not work. A link works once and does not last long. Type your email below and press Forgot your password for a new one.";
  }
  if (text.includes("expired")) {
    return "That confirmation link has expired. Sign in below, or create the account again to get a fresh one.";
  }
  if (text.includes("already") || text.includes("used")) {
    return "That link has already been used. Your email is confirmed, so just sign in.";
  }
  return "That link did not work. Sign in below and we will sort it out.";
}
