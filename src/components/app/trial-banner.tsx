"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CalendarClock, CreditCard } from "lucide-react";
import { ButtonLink, Callout } from "@/components/ui/primitives";
import { billingPhase, type BillingPhase } from "@/lib/billing";
import { useAppState } from "@/lib/app-state";
import { monthlyFor } from "@/lib/pricing";
import { formatDate, money } from "@/lib/utils";

/**
 * Where the free period stands, on every board screen of a real association.
 *
 * Quiet while there is time (one line, brand tone, easy to ignore), louder
 * in the last two weeks, and red once it has ended. Gone the moment a card
 * is on file, because a paying board does not need reminding that it pays.
 * The demo has no clock and never sees this.
 */
export function usePhase(): BillingPhase | null {
  const { community, isRemote } = useAppState();
  const a = community.association;
  if (!isRemote || !a.trialEndsOn) return null;
  return billingPhase(
    {
      status: a.subscriptionStatus ?? "trialing",
      trialEndsOn: a.trialEndsOn,
      homes: a.unitCount,
      hasSubscription: Boolean(a.billing?.subscriptionId),
    },
    community.asOf,
  );
}

export function TrialBanner() {
  const { community } = useAppState();
  const pathname = usePathname();
  const phase = usePhase();
  if (!phase) return null;
  // Settings is where the card gets added; the card there says it all.
  if (pathname.startsWith("/board/settings")) return null;

  const homes = community.association.unitCount;
  const price = `${money(monthlyFor(homes), { cents: false })} a month for ${homes} ${homes === 1 ? "home" : "homes"}`;

  const action = (
    <ButtonLink
      href="/board/settings#billing"
      variant="secondary"
      size="sm"
    >
      Add a card
      <ArrowRight className="size-3.5" />
    </ButtonLink>
  );

  if (phase.phase === "trialing") {
    if (!phase.closing) {
      return (
        <p className="mb-5 flex items-center gap-2 text-footnote text-fg-muted">
          <CalendarClock className="size-3.5" />
          Free until {formatDate(phase.endsOn, "long")}, {phase.daysLeft} days left. Then {price}.{" "}
          <Link href="/board/settings#billing" className="font-medium text-fg underline underline-offset-2">
            Add a card
          </Link>
        </p>
      );
    }
    return (
      <Callout
        tone="warn"
        className="mb-5"
        icon={<CalendarClock className="size-4" />}
        title={`Your free 90 days end ${formatDate(phase.endsOn, "long")}`}
        action={action}
      >
        {phase.daysLeft} {phase.daysLeft === 1 ? "day" : "days"} left. After that it is {price}. Add
        a card now and nothing changes on the day.
      </Callout>
    );
  }

  if (phase.phase === "ended") {
    return (
      <Callout
        tone="danger"
        className="mb-5"
        icon={<CreditCard className="size-4" />}
        title={`Your free 90 days ended ${formatDate(phase.endsOn, "long")}`}
        action={action}
      >
        Residents can still pay and nothing is lost. Add a card to keep the board&apos;s screens
        open; it is {price}.
      </Callout>
    );
  }

  if (phase.phase === "past_due") {
    return (
      <Callout
        tone="danger"
        className="mb-5"
        icon={<CreditCard className="size-4" />}
        title="The last payment for Your HOAsis did not go through"
        action={
          <ButtonLink
            href="/board/settings#billing"
            variant="secondary"
            size="sm"
          >
            Update the card
            <ArrowRight className="size-3.5" />
          </ButtonLink>
        }
      >
        Stripe will try the card again. Update the card on file to fix it sooner.
      </Callout>
    );
  }

  return null;
}
