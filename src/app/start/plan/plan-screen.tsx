"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button, Callout } from "@/components/ui/primitives";
import { pendingBooksFor, pendingBooksStore } from "@/lib/founding-books";
import { SetupFlow } from "@/components/app/setup-plan";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { useFoundedHere } from "@/lib/resident-plan";
import { openRemoteAssociation, useRemote } from "@/lib/data/remote-store";
import { hasSupabase } from "@/lib/supabase/env";
import { HummingbirdLoader } from "@/components/app/hummingbird";

/**
 * The first time a board sees their plan, and every return to a question.
 *
 * Deliberately outside the admin shell. A workspace with a permanent to-do
 * list on it is a workspace that never looks finished, and a board learns to
 * read past the list within a week. This is a destination they arrive at once,
 * leave when they want, and come back to from a single line on the dashboard.
 *
 * Every exit is open. Nothing here blocks reaching the product, because a
 * board that cannot get to the thing they signed up for does not come back to
 * finish a checklist.
 */
export function PlanScreen() {
  const { communities, community, isRemote, ready } = useAppState();
  const router = useRouter();
  const task = useSearchParams().get("task");
  const auth = useAuth();
  const remote = useRemote();
  const foundedHere = useFoundedHere(community.id);
  const pendingBooks = pendingBooksFor(
    useSyncExternalStore(
      (fn) => pendingBooksStore.subscribe(fn),
      () => pendingBooksStore.getSnapshot(),
      () => pendingBooksStore.getServerSnapshot(),
    ),
    auth.user?.id,
  );

  // The plan belongs to an association the visitor founded or belongs to.
  // Opened cold and signed out, the page used to show the demo association
  // ("Willow Creek Estates is live") as though it were theirs.
  // Not before the browser's stores are read: a reload would otherwise look
  // like a visitor with nothing and be sent away from their own plan.
  const settling = !ready || (hasSupabase && (auth.loading || remote.status === "loading"));
  const hasPlan = isRemote || foundedHere;
  // Signed in with nothing founded yet is a person with a real next step.
  const signedInWithNothing = hasSupabase && Boolean(auth.user) && remote.status === "empty";
  const sendToStart = !settling && !hasPlan && !signedInWithNothing;
  // Books still waiting belong to one association, and this is its plan
  // until they are saved. Opened straight from an address, the browser
  // would otherwise show whichever association it remembers under a notice
  // about another one.
  const pendingId = pendingBooks?.associationId ?? null;
  const openPending =
    !settling &&
    pendingId !== null &&
    remote.status === "ready" &&
    remote.activeId !== pendingId &&
    remote.associations.some((a) => a.id === pendingId);
  const profileId = auth.user?.id ?? null;

  useEffect(() => {
    if (sendToStart) router.replace("/start");
  }, [sendToStart, router]);
  useEffect(() => {
    if (openPending && pendingId && profileId) void openRemoteAssociation(pendingId, profileId);
  }, [openPending, pendingId, profileId]);

  if (settling || sendToStart || openPending) {
    return <HummingbirdLoader className="min-h-[50dvh]" label="Opening your plan" />;
  }

  // Somebody who has not founded anything has no plan to look at.
  if (signedInWithNothing || communities.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center">
        <p className="text-headline font-semibold text-fg">No association yet</p>
        <p className="mt-1.5 text-body text-fg-muted">Set one up and this becomes your plan.</p>
        <Button className="mt-5" onClick={() => router.push("/start")}>
          Set up an association
        </Button>
      </div>
    );
  }

  // Keyed on the requested task, so a link to another question from inside
  // the flow (the closing list, the overview) opens that question rather than
  // changing the address under a finished flow.
  return (
    <>
      {pendingBooks ? (
        <div className="mx-auto w-full max-w-2xl px-5 pt-6">
          <Callout
            tone="warn"
            icon={<AlertTriangle className="size-4" />}
            title={`The books for ${pendingBooks.associationName || "your association"} are not saved yet`}
            action={
              <Button size="sm" variant="primary" onClick={() => router.push("/start")}>
                Finish saving them
              </Button>
            }
          >
            Its budget year, first bill or opening balances are kept on this device until they are
            saved.
          </Callout>
        </div>
      ) : null}
      <SetupFlow key={task ?? ""} welcome />
    </>
  );
}
