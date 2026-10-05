import type { supabaseAdmin } from "@/lib/supabase/server";

/**
 * The locks on the test tools, in one place so both routes share them.
 *
 * These routes delete with the service role and ask for no sign-in, so the
 * only thing between them and somebody's real association is what is checked
 * here. Four locks, and all four have to open:
 *
 *   1. Never on a production deployment, whatever the flags say. A flag
 *      copied into the wrong environment must not be enough.
 *   2. ALLOW_TEST_RESET=true on the server.
 *   3. TEST_RESET_PROJECT_REF names the Supabase project in
 *      NEXT_PUBLIC_SUPABASE_URL. Local development talks to whatever
 *      .env.local points at, and for a long time that was the only project
 *      there is. Naming the project is a person saying "this one is safe to
 *      empty", and it stops being true the moment the URL changes.
 *   4. No association in the project looks live: none has a subscription
 *      with us, none can accept charges through Stripe. A Stripe test-mode
 *      account cannot be told from a real one here, so it counts as live.
 *
 * scripts/seed-demo.mjs repeats the same four in plain JavaScript, because a
 * script cannot import this file. Change one, change the other.
 */

type Admin = ReturnType<typeof supabaseAdmin>;
type Env = Record<string, string | undefined>;

/**
 * The project a Supabase URL points at: "abcd" for https://abcd.supabase.co.
 * For anything else (a local stack on 127.0.0.1) it is the host name, so a
 * local project can still be named.
 */
export function projectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host) return null;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : host;
  } catch {
    return null;
  }
}

/** Why the environment refuses the test tools, or null when it allows them. */
export function environmentBlocks(env: Env = process.env): string | null {
  if (env.VERCEL_ENV === "production" || env.NODE_ENV === "production") {
    return "Test tools do not exist in production.";
  }
  if (env.ALLOW_TEST_RESET !== "true") {
    return "Test tools are switched off. Set ALLOW_TEST_RESET=true on the server to enable them, and never in production.";
  }
  const named = (env.TEST_RESET_PROJECT_REF ?? "").trim().toLowerCase();
  if (!named) {
    return "Test tools need TEST_RESET_PROJECT_REF set to the Supabase project they may empty. It is not set, so nothing will be touched.";
  }
  const actual = projectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!actual || named !== actual) {
    return "TEST_RESET_PROJECT_REF does not name the Supabase project this server is connected to, so nothing will be touched.";
  }
  return null;
}

/**
 * Why the data refuses the test tools, or null. One association with a
 * subscription or with online payments switched on is enough: these tools
 * are for a project with nothing to lose. A check that cannot be made is a
 * refusal, not a pass.
 */
export async function liveDataBlocks(admin: Admin): Promise<string | null> {
  const { data, error } = await admin
    .from("associations")
    .select("name")
    .or("billing_subscription_id.not.is.null,stripe_charges_enabled.eq.true")
    .limit(1);
  if (error) {
    return `Could not check for live associations (${error.message}), so nothing will be touched.`;
  }
  if (data && data.length > 0) {
    return `This project holds an association with a subscription or online payments switched on (${data[0].name}). Test tools do not run next to one.`;
  }
  return null;
}

/** Every lock, in order. The data is only asked once the environment agrees. */
export async function testToolsBlocked(
  admin: () => Admin,
  env: Env = process.env,
): Promise<string | null> {
  return environmentBlocks(env) ?? (await liveDataBlocks(admin()));
}
