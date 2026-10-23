import { loadEnv } from "../env.mjs";

/**
 * Where the database checks are allowed to write.
 *
 * Every verify script creates users and associations and deletes them again,
 * and `.env.local` on the main machine points at production. Following it by
 * default puts test associations in the live project, where the dues cron
 * bills any that a failed cleanup leaves behind. So the default target is a
 * local stack only; any other host has to be named on purpose in
 * VERIFY_REMOTE_HOST.
 */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function verifyTarget(env, allowedRemoteHost = process.env.VERIFY_REMOTE_HOST ?? "") {
  const raw = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("Refusing: NEXT_PUBLIC_SUPABASE_URL is not set in the env file.");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Refusing: NEXT_PUBLIC_SUPABASE_URL is not a URL.");
  }
  if (LOCAL_HOSTS.has(url.hostname)) return url.origin;
  if (allowedRemoteHost && allowedRemoteHost === url.hostname) return url.origin;
  throw new Error(
    `Refusing: the database checks write test data and ${url.hostname} is not a local stack. ` +
      `Point ENV_FILE at a local env file, or set VERIFY_REMOTE_HOST=${url.hostname} to write there on purpose.`,
  );
}

/** loadEnv, then stop the script before any client exists if the target is not allowed. */
export function loadVerifyEnv() {
  const env = loadEnv();
  try {
    verifyTarget(env);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  return env;
}
