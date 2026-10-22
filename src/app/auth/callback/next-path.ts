/**
 * The `next` a link may carry, made safe to follow.
 *
 * Only a path on this site. The test has to be on what the URL parser makes
 * of the string, not on how the string starts: the parser reads a backslash
 * as a slash and drops tabs and newlines, so "/\evil.example" begins with one
 * slash and still resolves to another host. Resolve first, compare origins,
 * and hand back the path as the parser understood it.
 *
 * Then check what is handed back, because the caller resolves it again. Dot
 * segments collapse on the first parse, so "/.//evil.example" stays on this
 * origin with the pathname "//evil.example", and that string read a second
 * time is another host. Anything that does not survive a second reading as
 * the same place is dropped.
 *
 * Its own file because a route file may only export handlers, and because
 * the emailed sign-in links (src/lib/email/sign-in-link.ts) depend on this
 * holding.
 */
export function sameOriginPath(next: string | null | undefined, origin: string): string | null {
  if (!next || !next.startsWith("/")) return null;
  let target: URL;
  try {
    target = new URL(next, origin);
  } catch {
    return null;
  }
  const here = new URL(origin).origin;
  if (target.origin !== here) return null;
  const path = `${target.pathname}${target.search}${target.hash}`;
  if (path.startsWith("//")) return null;
  try {
    const again = new URL(path, origin);
    if (again.origin !== here || again.href !== target.href) return null;
  } catch {
    return null;
  }
  return path;
}

/** Every loopback name Next.js folds into "localhost" when it parses a request URL. */
export const LOOPBACK = /^(?:localhost|127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}|\[::1\])$/;

/**
 * The origin to send somebody back to, as the browser addressed this server.
 *
 * Next.js rewrites a request for 127.0.0.1 or [::1] to "localhost" in
 * `nextUrl`. A callback opened on http://127.0.0.1:3100 therefore redirected
 * to http://localhost:3100, a different site to the browser, where the
 * session cookie just set does not exist. Only that rewrite is undone: the
 * Host header is believed only when it names a loopback address on the same
 * port, so a real deployment keeps the origin the server parsed, and a
 * forwarded host is never read at all.
 */
export function requestOrigin(nextUrl: URL, host: string | null): string {
  const parsed = nextUrl.origin;
  if (nextUrl.hostname !== "localhost" || !host) return parsed;
  let asked: URL;
  try {
    asked = new URL(`${nextUrl.protocol}//${host}`);
  } catch {
    return parsed;
  }
  if (!LOOPBACK.test(asked.hostname) || asked.port !== nextUrl.port) return parsed;
  if (asked.username || asked.password || asked.pathname !== "/" || asked.search) return parsed;
  return asked.origin;
}
