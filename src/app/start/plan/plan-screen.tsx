"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { SetupPlan } from "@/components/app/setup-plan";
import { PortingCard } from "@/components/app/porting-card";
import { useAppState } from "@/lib/app-state";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";

/**
 * The first time a board sees their plan.
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
  const { community, communities } = useAppState();
  const router = useRouter();
  const plan = buildPlan(community, profileFromCommunity(community));

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

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <header className="mb-8">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <PartyPopper className="size-6" />
        </span>
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[38px]">
          {community.settings.displayName} is live.
        </h1>
        <p className="mt-3 max-w-[58ch] text-[17px] leading-relaxed text-fg-muted">
          {plan.canCollect
            ? "You can already take payments. Everything below makes the association easier to run, and none of it is urgent."
            : "Here is what is left, in the order that gets money moving first. You can stop after the first section."}
        </p>
      </header>

      <SetupPlan />

      <PortingCard />

      {/* The way out, stated plainly and always available. A plan that has to
          be finished before the product opens is a plan people abandon. */}
      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-fg">Come back to this any time</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
            It lives under Getting started, and the dashboard keeps a link until it is done.
          </p>
        </div>
        <Link
          href="/board"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
        >
          Go to the dashboard
          <ArrowRight className="size-4" />
        </Link>
      </Card>
    </div>
  );
}
