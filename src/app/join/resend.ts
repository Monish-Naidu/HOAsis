/**
 * The browser side of "send the confirmation email again".
 *
 * Kept apart from the join panel so the sign-in and join screens share one call
 * and one set of failure words.
 */

import { supabaseBrowser } from "@/lib/supabase/client";

export type ResendResult = { ok: true } | { ok: false; message: string };

/**
 * Asks for the confirmation email again.
 *
 * Goes through our own route, which sends it the way sign up does and is
 * limited by the same limiter. A 503 means no mail key is set on this
 * deployment, and Supabase's own mailer is the fallback, as it is for sign up.
 * A refusal is returned in the route's own words.
 */
export async function resendConfirmation(email: string): Promise<ResendResult> {
  try {
    const response = await fetch("/api/auth/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (response.ok) return { ok: true };
    if (response.status !== 503) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      return { ok: false, message: body.error ?? body.message ?? "Could not send it again. Try in a minute." };
    }
  } catch {
    // Network trouble reaching our own route. Supabase's path is still there.
  }
  const { error } = await supabaseBrowser().auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  return error ? { ok: false, message: "Could not send it again. Try in a minute." } : { ok: true };
}
