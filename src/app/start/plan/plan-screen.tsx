"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { SetupFlow } from "@/components/app/setup-plan";
import { useAppState } from "@/lib/app-state";

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
  const { communities } = useAppState();
  const router = useRouter();

  // Somebody who has not founded anything has no plan to look at.
  if (communities.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center">
        <p className="text-[17px] font-semibold text-fg">No association yet</p>
        <p className="mt-1.5 text-[15px] text-fg-muted">
          Set one up and this becomes your plan.
        </p>
        <Button className="mt-5" onClick={() => router.push("/start")}>
          Set up an association
        </Button>
      </div>
    );
  }

  return <SetupFlow welcome />;
}
