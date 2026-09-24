"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { portingPlan } from "@/lib/porting";
import { profileFromCommunity } from "@/lib/setup-plan";

/**
 * The first weeks, in the order they have to happen.
 *
 * Shown once the association has said who is setting it up. A builder standing
 * one up and a board taking control from that builder are the two halves of
 * one event, and they get different lists rather than the same list reworded.
 *
 * Nothing here is a records migration. There is no existing association to
 * move, which is the point of building for new construction: the failure to
 * design against is not a bad import, it is a community handed over with
 * reserves nobody funded.
 */
export function PortingCard() {
  const { community } = useAppState();
  const profile = profileFromCommunity(community);
  const plan = portingPlan(profile.origin, profile.previously);

  if (!plan) return null;

  return (
    <section className="mt-8">
      <Card>
        <CardHeader
          icon={<ArrowRight className="size-4" />}
          title={plan.title}
          subtitle={plan.lede}
        />
        <ol className="divide-y divide-border">
          {plan.steps.map((step, index) => (
            <li key={step.key} className="flex items-start gap-3 px-5 py-4">
              <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-fg-muted">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-fg">{step.title}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-fg-muted">{step.detail}</p>
                {/* Order is the whole argument at a handover, so the reason a
                    step sits where it does is stated rather than implied. */}
                {step.because ? (
                  <p className="mt-1.5 border-l-2 border-border-2 pl-3 text-[13px] leading-relaxed text-fg-muted">
                    {step.because}
                  </p>
                ) : null}

                {step.href ? (
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                  >
                    Open
                    <ArrowRight className="size-3" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
