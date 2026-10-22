import { LOOPBACK, requestOrigin } from "@/app/auth/callback/next-path";

/**
 * The origin a token-bearing link in an email points at, or null when there
 * is none this server can vouch for.
 *
 * The link carries a sign-in token, so whoever runs the host it names can
 * sign in as the recipient. The request's own headers cannot decide it: a
 * caller sets Host, X-Forwarded-Host and X-Forwarded-Proto to anything they
 * like, and the sign up and resend forms are open to anybody. So:
 *
 *   - a deployment names its site in NEXT_PUBLIC_SITE_HOST and every link is
 *     https on that host, whatever the request said. A value that is not a
 *     plain public host name is a misconfiguration, and nothing is sent;
 *   - a production build without one sends nothing either;
 *   - a development server is only ever reached on this machine, so the
 *     loopback address the browser used, on the same port, is kept (the
 *     callback's own rule, see `requestOrigin`). Always plain http, which is
 *     what `next dev` serves. Any other host is refused.
 */
export function mailOrigin({
  nextUrl,
  host,
  siteHost,
  production,
}: {
  nextUrl: URL;
  host: string | null;
  siteHost: string | undefined;
  production: boolean;
}): string | null {
  const configured = siteHost?.trim();
  if (configured) return siteOrigin(configured);
  if (production) return null;
  let local: URL;
  try {
    local = new URL(requestOrigin(nextUrl, host));
  } catch {
    return null;
  }
  if (!LOOPBACK.test(local.hostname)) return null;
  return `http://${local.host}`;
}

/** Dot-separated DNS labels ending in a letter-only top level, lower case. */
const HOST_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function siteOrigin(configured: string): string | null {
  const name = configured.toLowerCase();
  if (!HOST_NAME.test(name) || name.endsWith(".localhost")) return null;
  return `https://${name}`;
}
