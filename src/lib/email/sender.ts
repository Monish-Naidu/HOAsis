/**
 * Who the mail comes from, decided in one place.
 *
 * Every sender used to read `process.env.EMAIL_FROM ?? fallback` on its own.
 * Production had the variable set to an empty string, which `??` treats as a
 * value, so every message went to Resend with `from: ""` and was refused.
 * An empty or blank setting is no setting.
 *
 * The fallback is Resend's shared testing sender, which only delivers to the
 * address that owns the Resend account. It is the right thing on a laptop
 * and the wrong thing on yourhoasis.com, so production says so in the log
 * once rather than failing silently for every resident.
 */

export const SHARED_SENDER = "Your HOAsis <onboarding@resend.dev>";

let warned = false;

export function emailSender(): string {
  const configured = (process.env.EMAIL_FROM ?? "").trim();
  const from = configured || SHARED_SENDER;
  if (isSharedSender(from) && process.env.VERCEL_ENV === "production" && !warned) {
    warned = true;
    console.error(
      "[hoasis] EMAIL_FROM is the shared resend.dev sender in production. " +
        "It only delivers to the Resend account owner. Verify yourhoasis.com and set EMAIL_FROM.",
    );
  }
  return from;
}

/** True for the shared sender, which reaches nobody but the account owner. */
export function isSharedSender(from: string): boolean {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  return address.trim().toLowerCase().endsWith("@resend.dev");
}

/** The Resend key, or a clear reason there is none. */
export function resendKey(): string | null {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  return key || null;
}
