"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAppState } from "@/lib/app-state";
import { useRemote, preferRemoteSlug, setRemoteAssociationBySlug } from "@/lib/data/remote-store";
import { communityPath, isSlug, landingFor } from "@/lib/community-links";
import { hasSupabase } from "@/lib/supabase/env";
import { HummingbirdLoader } from "@/components/app/hummingbird";

/**
 * Whether an association answers to this address. A lookup that fails or is
 * turned away counts as yes: a hiccup must not tell somebody their real
 * association does not exist.
 */
async function slugExists(slug: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/join/lookup?community=${encodeURIComponent(slug)}`);
    if (!response.ok) return true;
    const body = (await response.json()) as { found?: unknown };
    return body.found !== null;
  } catch {
    return true;
  }
}

/**
 * Turns a community link into an active association, then leaves.
 *
 * Runs in an effect because it navigates. Waits for auth and the
 * association list to settle before deciding, since deciding early is how a
 * signed in person gets bounced to the front door.
 */
export function CommunityEntry({
  slug,
  path,
  search = "",
}: {
  slug: string;
  path: string;
  /** The link's query string, kept through the hand-off ("?home=..."). */
  search?: string;
}) {
  const router = useRouter();
  const auth = useAuth();
  const remote = useRemote();
  const { communities, setCommunity } = useAppState();

  useEffect(() => {
    const missing = `/signin?missing=${encodeURIComponent(slug)}`;
    if (!isSlug(slug)) {
      router.replace(missing);
      return;
    }

    // The demo: ids are slugs already, and picking one is picking a seat.
    if (!hasSupabase) {
      if (!communities.some((c) => c.id === slug)) {
        router.replace(missing);
        return;
      }
      setCommunity(slug);
      router.replace("/signin");
      return;
    }

    if (auth.loading || remote.status === "loading") return;

    let cancelled = false;
    if (!auth.user) {
      void (async () => {
        // An address nobody holds says so now, instead of after a sign in
        // that ends on a join page for nothing.
        if (!(await slugExists(slug))) {
          if (!cancelled) router.replace(missing);
          return;
        }
        if (cancelled) return;
        // Remember the ask across the sign-in, and keep the link whole,
        // home or thread query included.
        preferRemoteSlug(slug);
        const next = `${communityPath(slug, path)}${search}`;
        router.replace(`/signin?next=${encodeURIComponent(next)}`);
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const outcome = await setRemoteAssociationBySlug(slug);
      if (cancelled) return;
      if (outcome === "not-a-member") {
        router.replace(`/join?community=${encodeURIComponent(slug)}`);
        return;
      }
      if (outcome === "not-ready") return;
      const role = remote.associations.find((a) => a.slug === slug)?.role ?? null;
      router.replace(`${landingFor(path, role)}${search}`);
    })();
    return () => {
      cancelled = true;
    };
    // `remote.associations` changes identity on every load; keying on status
    // and the slug is what stops this running twice for one arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, path, search, auth.loading, auth.user?.id, remote.status, router]);

  return <HummingbirdLoader className="min-h-dvh" label="Opening your association" />;
}
