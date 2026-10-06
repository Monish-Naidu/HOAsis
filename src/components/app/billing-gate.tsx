"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { boardLocked } from "@/lib/billing";
import { useAppState } from "@/lib/app-state";
import { homeCount } from "@/lib/metrics";
import { monthlyFor } from "@/lib/pricing";
import { formatDate, money } from "@/lib/utils";
import { usePhase } from "./trial-banner";

/**
 * The billing wall.
 *
 * Two weeks after a trial ends with nothing on file, board screens wait
 * here. Settings stays open, because it is where the card is added, and the
 * resident side is never touched: an owner's statement is theirs whatever
 * the board has or has not paid.
 */
export function BillingGate({ children }: { children: React.ReactNode }) {
  const { community } = useAppState();
  const pathname = usePathname();
  const phase = usePhase();

  // Only a trial that ran out walls the screens. A card that failed or a
  // cancelled subscription leaves the board able to read; the database
  // refuses its writes (0105) and the banner says why.
  if (!phase || phase.phase !== "ended" || !boardLocked(phase) || pathname.startsWith("/board/settings")) {
    return <>{children}</>;
  }

  const homes = homeCount(community);
  const endsOn = phase.endsOn;

  return (
    <Card className="mx-auto max-w-xl">
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg">
          <CreditCard className="size-5" />
        </span>
        <h1 className="mt-4 text-title2 font-semibold tracking-tight text-fg">
          The free 90 days ended {formatDate(endsOn, "long")}
        </h1>
        <p className="mt-2 max-w-md text-body leading-relaxed text-fg-muted">
          Everything is still here and residents can still pay. Add a card to open the board&apos;s
          screens again. It is {money(monthlyFor(homes), { cents: false })} a month for {homes}{" "}
          {homes === 1 ? "home" : "homes"}, and you can cancel whenever.
        </p>
        <Link
          href="/board/settings#billing"
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-body font-semibold text-brand-fg"
        >
          Add a card
        </Link>
      </div>
    </Card>
  );
}
