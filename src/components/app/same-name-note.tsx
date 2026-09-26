"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { normalizeAssociationName } from "@/lib/community-links";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * "There is already a Maple Ridge in Bothell, WA. Is that yours?"
 *
 * Names are labels and may repeat, so this never blocks. It tells the
 * person typing a name that an association by that name already exists,
 * with its town, and in the wizard offers the join page instead. The
 * lookup goes through /api/join/lookup?name=, which is rate limited and
 * answers as anon: name, town and slug, nothing else.
 */

interface Match {
  name: string;
  place: string;
  slug: string;
}

const matches = new Map<string, Match[]>();
const listeners = new Set<() => void>();
const EMPTY: Match[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(key: string) {
  if (matches.has(key)) return;
  matches.set(key, EMPTY);
  void fetch(`/api/join/lookup?name=${encodeURIComponent(key)}`)
    .then((r) => (r.ok ? r.json() : { matches: [] }))
    .then((body: { matches?: Match[] }) => {
      matches.set(key, body.matches ?? []);
      for (const l of listeners) l();
    })
    .catch(() => matches.set(key, EMPTY));
}

/** Associations already called `name`, minus the one at `excludeSlug`. */
export function useSameNameMatches(name: string, excludeSlug?: string | null): Match[] {
  const key = normalizeAssociationName(name);
  const found = useSyncExternalStore(
    subscribe,
    () => (key ? (matches.get(key) ?? EMPTY) : EMPTY),
    () => EMPTY,
  );

  // Waits for the typing to pause before asking. A cached answer shows at
  // once; the effect only fires the fetch.
  useEffect(() => {
    if (!hasSupabase || key.length < 3 || matches.has(key)) return;
    const timer = window.setTimeout(() => lookup(key), 500);
    return () => window.clearTimeout(timer);
  }, [key]);

  return excludeSlug ? found.filter((m) => m.slug !== excludeSlug) : found;
}

export function SameNameNote({
  name,
  excludeSlug,
  variant = "wizard",
  className,
}: {
  name: string;
  /** The association being renamed, so it does not warn about itself. */
  excludeSlug?: string | null;
  /** The wizard offers the join page; Settings only says so. */
  variant?: "wizard" | "plain";
  className?: string;
}) {
  const found = useSameNameMatches(name, excludeSlug);
  if (!found.length) return null;
  const first = found[0];
  const where = first.place ? ` in ${first.place}` : "";
  const others = found.length > 1 ? ` and ${found.length - 1} more` : "";
  return (
    <p className={className ?? "mt-2 text-footnote leading-snug text-fg-muted"} role="status">
      There is already a {first.name}{where}{others} on Your HOAsis.{" "}
      {variant === "wizard" ? (
        <>
          If that is yours,{" "}
          <Link
            href={`/join?community=${encodeURIComponent(first.slug)}`}
            className="font-medium text-fg underline decoration-border-2 underline-offset-2 hover:decoration-fg"
          >
            join it instead
          </Link>
          . A second association with the same name is fine too.
        </>
      ) : (
        <>Two associations can share a name; members who belong to both will see the town next to it.</>
      )}
    </p>
  );
}
