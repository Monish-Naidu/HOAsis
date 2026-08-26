/**
 * Supabase configuration, read once and validated.
 *
 * The publishable key is safe in a browser because row level security is what
 * actually protects the data; it identifies the project, it does not grant
 * access. The service role key bypasses every policy, so it is read only in
 * server code and deliberately has no `NEXT_PUBLIC_` prefix, which is what
 * stops the bundler shipping it to a browser.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * True when a project is configured.
 *
 * The prototype has to keep running without one, so every call site checks
 * this rather than throwing at import time and taking the whole app down for
 * anyone who just wants to click through the demo.
 */
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Server only. Throws rather than silently falling back to a weaker key. */
export function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Webhook handlers cannot write payments without it.",
    );
  }
  return key;
}
