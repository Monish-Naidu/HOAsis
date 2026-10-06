"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/lib/app-state";
import { useRemote } from "@/lib/data/remote-store";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * Seats the visitor in the sample association and sends them on.
 *
 * `?as=owner` opens the resident side as an owner; anything else opens the
 * board as the president. Somebody already signed in to a real association is
 * sent to it untouched: a real session outranks the demo everywhere else, so
 * seating them here would only be undone on the next page.
 */
export function DemoEntry() {
  const router = useRouter();
  const { ready, accounts, signIn } = useAppState();
  const remote = useRemote();
  const waiting = !ready || (hasSupabase && remote.status === "loading");
  const signedIn = hasSupabase && remote.status === "ready" && remote.community !== null;

  useEffect(() => {
    if (waiting) return;
    // `?as=` names a role (president, vice-president, treasurer, secretary,
    // owner) or a demo account id, so a tester can be any of the board and
    // not only the President. Anything unknown opens the board as before.
    const as = new URLSearchParams(window.location.search).get("as") ?? "";
    const asOwner = as === "owner" || as === "resident";
    const byId = accounts.find((a) => a.id === as);
    const seat =
      byId ??
      (asOwner
        ? accounts.find((a) => a.role === "resident")
        : (accounts.find((a) => a.role === as) ??
          accounts.find((a) => a.role === "president") ??
          accounts.find((a) => a.role !== "resident")));
    if (!signedIn && seat) signIn(seat.id);
    router.replace(seat?.role === "resident" ? "/resident" : "/board");
  }, [waiting, signedIn, accounts, signIn, router]);

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5">
      <p className="text-body font-medium text-fg-muted">Opening the demo…</p>
    </div>
  );
}
