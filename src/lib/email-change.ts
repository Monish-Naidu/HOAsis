/**
 * Checking a new sign-in address before it is sent to Supabase Auth.
 *
 * The same shape the database asks of an owner's email (0080), plus the two
 * things only the form can know: it must differ from the current address,
 * and it must fit in an email address (254 characters, the SMTP limit).
 * Supabase does the real verification by mailing a link, so this only
 * saves a round trip on an obvious typo.
 */

export const MAX_EMAIL_LENGTH = 254;

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string };

export function checkNewEmail(raw: string, current: string): EmailCheck {
  const email = raw.trim();
  if (!email) return { ok: false, message: "Enter your new email address." };
  if (email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, message: "That address is too long to be an email." };
  }
  // Exactly one @, something on both sides, and a dot after it with
  // something around the dot.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "That email address does not look right." };
  }
  if (email.toLowerCase() === current.trim().toLowerCase()) {
    return { ok: false, message: "That is already your email." };
  }
  return { ok: true, email };
}

/** What to tell somebody once the confirmation link is on its way. */
export function emailChangeSent(newEmail: string, oldEmail: string): string {
  return `We sent a link to ${newEmail}. Your email changes when you open it. Until then you sign in with ${oldEmail}.`;
}
