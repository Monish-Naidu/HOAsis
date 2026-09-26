"use client";

import Link from "next/link";
import { ArrowRight, Check, Rocket } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { goLiveChecklist } from "@/lib/go-live";
import { cn, todayIsoDate } from "@/lib/utils";

/**
 * Going live, as a list the board can read on Monday morning.
 *
 * Seven rows, every one derived from the records (`src/lib/go-live.ts`),
 * each with the one link that fixes it. Shown for a real association only:
 * a browser copy has no Stripe, no email and no trial, and a list of things
 * it can never do is not a plan.
 */
export function GoLiveChecklist() {
  const { community, isRemote } = useAppState();
  if (!isRemote) return null;

  const live = goLiveChecklist(community, todayIsoDate());

  return (
    <section className="mb-8">
      <Card>
        <CardHeader
          icon={<Rocket className="size-4" />}
          title={
            live.allDone
              ? "You are live"
              : live.canCollect
                ? "Residents can pay. A few things left"
                : `${live.done} of ${live.total} to go live`
          }
          subtitle={
            live.allDone
              ? "Every household can sign in and pay, and the association is billed on a card."
              : live.canCollect
                ? "The money side is ready. The rest is who can see it and how long the free days last."
                : "Money moves once the first four are done. The other three keep it moving."
          }
        />
        <ol className="divide-y divide-border">
          {live.items.map((item) => (
            <li
              key={item.key}
              className={cn("flex items-start gap-3 px-5 py-3.5", item.done && "opacity-70")}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  item.done
                    ? "border-ok bg-ok text-white"
                    : item.urgent
                      ? "border-danger text-transparent"
                      : "border-border-2 text-transparent",
                )}
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-body font-semibold text-fg", item.done && "line-through")}>
                  {item.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-footnote leading-relaxed",
                    item.urgent && !item.done ? "text-danger" : "text-fg-muted",
                  )}
                >
                  {item.detail}
                </span>
              </span>
              {item.done ? null : (
                <Link
                  href={item.href}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-footnote font-semibold text-accent hover:underline"
                >
                  {item.action}
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
