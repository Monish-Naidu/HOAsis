/**
 * The scaffolding every scripts/verify-*.mjs repeated: env, clients, a run's
 * throwaway users, check/report, and the cleanup that must not leave an
 * association behind.
 *
 * Why one copy: the cleanup rule (a delete that fails fails the run) and the
 * env parsing were fixed in some scripts and not others more than once. A
 * script keeps only what is specific to it: its own helpers and its checks.
 *
 * The options exist so that each script's output and behaviour stay exactly
 * what they were; they are not a menu to grow.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../env.mjs";

export { loadEnv };

/** A date n days from today (UTC) as YYYY-MM-DD. Negative is the past. */
export const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const lineOf = (r) => `${r.passed ? "  ok  " : "FAIL  "}${r.name}${r.detail ? `  (${r.detail})` : ""}`;

/**
 * @param {object} opts
 * @param {string} opts.passwordPrefix  e.g. "access-"; a random tail and "A1" are added
 *   (the tail satisfies the project's password rules).
 * @param {string} [opts.emailTag]  makeUser's default address is `who-tag-stamp@example.com`,
 *   or `who-stamp@example.com` without a tag.
 * @param {boolean} [opts.claimSeats]  call claim_my_seats after sign in, as the app does.
 * @param {boolean} [opts.strictSignIn]  throw when sign in fails (default). Some scripts
 *   never checked and must keep not checking.
 * @param {boolean} [opts.demotePresident]  before deleting an association, demote its
 *   president, for the rule that a President cannot be removed by cascade.
 * @param {boolean} [opts.swallowUserDeleteErrors]  default true; false lets a thrown
 *   deleteUser escape the finally, as verify-isolation always did.
 */
export function createHarness({
  passwordPrefix,
  emailTag,
  claimSeats = false,
  strictSignIn = true,
  demotePresident = false,
  swallowUserDeleteErrors = true,
}) {
  const env = loadEnv();
  const authOptions = { auth: { persistSession: false } };
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, authOptions);
  const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, authOptions);

  const stamp = Date.now();
  const PASSWORD = passwordPrefix + Math.random().toString(36).slice(2) + "A1";
  const results = [];
  let failures = 0;

  const check = (name, passed, detail = "") => {
    results.push({ name, passed, detail });
    if (!passed) failures++;
  };

  /** Ids to remove at the end. A script may add its own lists (verify-community-life adds files). */
  const cleanup = { users: [], associations: [] };

  async function makeUser(who, email = `${who}-${emailTag ? `${emailTag}-` : ""}${stamp}@example.com`) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: who },
    });
    if (error) throw new Error(`${who}: ${error.message}`);
    cleanup.users.push(data.user.id);
    const client = anon();
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError && strictSignIn) throw new Error(`sign in ${who}: ${signInError.message}`);
    const claimed = claimSeats ? (await client.rpc("claim_my_seats")).data : undefined;
    return { client, id: data.user.id, email, name: who, claimed };
  }

  /** The finally block. Call it once, last, after any cleanup specific to the script. */
  async function cleanupAll() {
    for (const id of cleanup.associations) {
      if (demotePresident) {
        await admin.from("memberships").update({ role: "resident" })
          .eq("association_id", id).eq("role", "president");
      }
      // A cleanup that fails leaves this association in the live project,
      // where the dues cron goes on billing it. So it fails the run.
      const { error } = await admin.from("associations").delete().eq("id", id);
      if (error) check("cleanup removed the association", false, error.message);
    }
    for (const id of cleanup.users) {
      if (swallowUserDeleteErrors) await admin.auth.admin.deleteUser(id).catch(() => {});
      else await admin.auth.admin.deleteUser(id);
    }
  }

  /**
   * Prints and exits. `line(result)` returns the text for one result or null to
   * skip it; `summary({ passed, total, failures })` returns the closing line.
   */
  function report({
    line = lineOf,
    summary = ({ passed, total }) => `\n${passed}/${total} passed`,
  } = {}) {
    for (const r of results) {
      const text = line(r);
      if (text !== null) console.log(text);
    }
    console.log(summary({ passed: results.length - failures, total: results.length, failures }));
    process.exit(failures ? 1 : 0);
  }

  return { env, admin, anon, stamp, PASSWORD, check, results, cleanup, makeUser, cleanupAll, report };
}
