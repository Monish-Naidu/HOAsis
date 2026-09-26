/**
 * Where an association lives on the web.
 *
 * The canonical address is a path: `/c/<slug>` opens the association and
 * `/c/<slug>/board/settings` opens a page inside it. One host, one session,
 * and a link a neighbour forwards still works for somebody who belongs to
 * two associations.
 *
 * `<slug>.yourhoasis.com` is a vanity alias for the same thing. The proxy
 * turns the host into the path; nothing else in the app knows about it.
 *
 * The slug itself is made by the database (migration 0047) from the name,
 * once, and never changes on a rename. `slugify` here mirrors that rule so a
 * screen can show the address a new association is about to get.
 */

/** Hosts whose first label is an association. Local for testing. */
export const VANITY_ROOTS = ["yourhoasis.com", "localhost"] as const;

/** Labels that name a host or a route, never an association. Mirrors SQL. */
const RESERVED = new Set([
  "www", "app", "api", "mail", "admin", "board", "resident", "signin", "join",
  "start", "auth", "about", "pricing", "library", "dev", "c", "help", "support",
  "status", "demo", "test", "staging",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}

/** Lowercase, hyphenated, trimmed. "Oakview Commons HOA" becomes "oakview-commons-hoa". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The slug a name will get, given the slugs already taken. The same rule as
 * `unique_association_slug` in Postgres: the clean form if free, else a
 * numeric suffix from 2.
 */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let base = slugify(name).slice(0, 48);
  if (!base) base = "community";
  else if (isReservedSlug(base)) base = `${base}-hoa`;
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * The form two names are compared in: case and runs of whitespace do not
 * make a different association. Mirrors `normalize_association_name` in
 * Postgres (migration 0051). Names may legitimately repeat; this is for
 * the quiet "is that yours?" note, never for refusing a name.
 */
export function normalizeAssociationName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when two association names are the same name in different clothes. */
export function sameAssociationName(a: string, b: string): boolean {
  const left = normalizeAssociationName(a);
  return left !== "" && left === normalizeAssociationName(b);
}

/** "Bothell, WA", or "" when neither is known. */
export function placeLabel(city: string | null | undefined, state: string | null | undefined): string {
  return [city, state].map((v) => (v ?? "").trim()).filter(Boolean).join(", ");
}

/** True when the string is a slug the database would accept. */
export function isSlug(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 64;
}

/**
 * The association named by a host, or null when the host is the site itself.
 *
 * `oakview-commons.yourhoasis.com` gives `oakview-commons`; `yourhoasis.com`,
 * `www.yourhoasis.com`, a Vercel preview and anything with two labels in
 * front of the root give null.
 */
export function slugFromHost(
  host: string | null | undefined,
  roots: readonly string[] = VANITY_ROOTS,
): string | null {
  if (!host) return null;
  const bare = host.toLowerCase().replace(/:\d+$/, "");
  for (const root of roots) {
    if (bare === root) return null;
    if (!bare.endsWith(`.${root}`)) continue;
    const label = bare.slice(0, -(root.length + 1));
    if (!label || label.includes(".") || isReservedSlug(label) || !isSlug(label)) return null;
    return label;
  }
  return null;
}

/**
 * The canonical path for a page inside an association. `path` is the route
 * as the app knows it (`/board/settings`); the result is what goes in an
 * email or on a clipboard.
 */
export function communityPath(slug: string, path = ""): string {
  const inner = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `/c/${slug}${inner}`;
}

/** The same, as a full link on the given origin. */
export function communityUrl(origin: string, slug: string, path = ""): string {
  return `${origin.replace(/\/$/, "")}${communityPath(slug, path)}`;
}

/**
 * Splits a canonical path back into the slug and the page. Anything that is
 * not under `/c/` is returned as-is with no slug, so callers can pass any
 * path through.
 */
export function parseCommunityPath(pathname: string): { slug: string | null; path: string } {
  const match = /^\/c\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!match) return { slug: null, path: pathname };
  const slug = match[1];
  if (!isSlug(slug)) return { slug: null, path: pathname };
  return { slug, path: match[2] ?? "" };
}

/**
 * The page a community link should land on once the association is active.
 * Only the two shells are reachable this way; anything else falls back to
 * the shell that fits the person's role.
 */
export function landingFor(path: string, role: string | null | undefined): string {
  if (path.startsWith("/board") || path.startsWith("/resident")) return path;
  return role && role !== "resident" ? "/board" : "/resident";
}
