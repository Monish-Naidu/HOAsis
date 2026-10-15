/**
 * Which deployment this process is.
 *
 * Vercel sets VERCEL_ENV; Azure sets nothing, so the Container App is given
 * APP_ENV ("production" or "staging") in its environment. NODE_ENV is not the
 * answer: it is "production" on staging too, because that is a production
 * build. Pure, so it can be tested with a fake environment.
 */
export type DeployEnv = "production" | "staging" | "preview" | "development";

/** process.env, or a fake of it in a test. */
type Env = Record<string, string | undefined>;

export function deployEnv(env: Env = process.env): DeployEnv {
  const named = (env.APP_ENV ?? env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (named === "production" || named === "staging" || named === "preview") return named;
  return env.NODE_ENV === "production" ? "production" : "development";
}

/** True only for the one deployment real people use. */
export function isProduction(env: Env = process.env): boolean {
  return deployEnv(env) === "production";
}
