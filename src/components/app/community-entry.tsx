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
 * Turns a community link into an active association, then leaves.
 *
 * Runs in an effect because it navigates. Waits for auth and the
 * association list to settle before deciding, since deciding early is how a
 * signed in person gets bounced to the front door.
 */
export function CommunityEntry({ slug, path }: { slug: string; path: string }) {
  const router = useRouter();
  const auth = useAuth();
  const remote = useRemote();
  const { communities, setCommunity } = useAppState();

  useEffect(() => {
    if (!isSlug(slug)) {
      router.replace("/signin");
      return;
    }

    // The demo: ids are slugs already, and picking one is picking a seat.
    if (!hasSupabase) {
      if (communities.some((c) => c.id === slug)) setCommunity(slug);
      router.replace("/signin");
      return;
    }

    if (auth.loading || remote.status === "loading") return;

    if (!auth.user) {
      // Remember the ask across the sign-in, and keep the link whole.
      preferRemoteSlug(slug);
      const next = communityPath(slug, path);
      router.replace(`/signin?next=${encodeURIComponent(next)}`);
      return;
    }

    let cancelled = false;
    void (async () => {
      const outcome = await setRemoteAssociationBySlug(slug);
      if (cancelled) return;
      if (outcome === "not-a-member") {
        router.replace(`/join?community=${encodeURIComponent(slug)}`);
        return;
      }
      if (outcome === "not-ready") return;
      const role = remote.associations.find((a) => a.slug === slug)?.role ?? null;
      router.replace(landingFor(path, role));
    })();
    return () => {
      cancelled = true;
    };
    // `remote.associations` changes identity on every load; keying on status
    // and the slug is what stops this running twice for one arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, path, auth.loading, auth.user?.id, remote.status, router]);

  return <HummingbirdLoader className="min-h-dvh" label="Opening your association" />;
}
