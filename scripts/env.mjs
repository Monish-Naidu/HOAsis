import { readFileSync } from "node:fs";

/**
 * Reads .env.local the way a shell and Next.js both would.
 *
 * The hand rolled split on "=" that these scripts used kept surrounding quotes
 * as part of the value, so EMAIL_FROM="HOAsis <x@y.com>" arrived with literal
 * quote characters and every send was rejected as a malformed address. Quoting
 * that line is not optional either: an unquoted < and > are redirections when
 * the file is sourced by a shell.
 *
 * So the value is unquoted here, once, rather than at each call site.
 */
export function loadEnv(url = new URL("../.env.local", import.meta.url)) {
  const out = {};
  for (const line of readFileSync(url, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    out[name] = value;
  }
  return out;
}
