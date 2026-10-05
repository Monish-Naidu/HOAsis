"use client";

import Link from "next/link";
import { ArrowRight, MonitorSmartphone } from "lucide-react";
import { ButtonLink, Callout } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/**
 * Says so when an association exists only in this browser.
 *
 * Quick Setup without an account builds a copy here and nowhere else, which
 * is fine for looking around and fatal for a board that then types a roster
 * into it. The wizard says this once, at the end; this says it on every
 * screen of the copy, because that is where the roster gets typed.
 *
 * The shipped demo associations have no profile and are not shown this: they
 * are the demo, not somebody's mistake.
 */
export function LocalCopyBanner() {
  const { community, isRemote } = useAppState();
  if (isRemote || !community.profile) return null;
  return (
    <Callout
      tone="warn"
      className="mb-5"
      icon={<MonitorSmartphone className="size-4" />}
      title={`${community.settings.displayName} lives only in this browser`}
      action={
        <ButtonLink href="/signin" variant="primary" size="sm">
          Set it up for real
          <ArrowRight className="size-3.5" />
        </ButtonLink>
      }
    >
      Nothing here is saved anywhere else and nobody else can sign in. Create an account, then
      go through Setting up again once you are signed in. It takes about three minutes.
    </Callout>
  );
}

/**
 * Says so on the shipped demo, and offers the way out of it.
 *
 * The front page sends visitors straight in to look around. Without this the
 * demo was a dead end for the one person it exists for: a board member who
 * liked what they saw had to find their own way back to the sign-up. One
 * quiet line rather than a callout, so the dashboard under it still looks
 * like the dashboard.
 */
export function DemoBanner({ className }: { className?: string }) {
  const { community, isRemote } = useAppState();
  if (isRemote || community.profile) return null;
  return (
    <p
      data-testid="demo-banner"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-xl border border-tint-blue/25 bg-tint-blue/[0.07] px-4 py-2.5 text-body text-fg",
        className ?? "mb-5",
      )}
    >
      <span>
        <span className="font-semibold">This is a demo.</span>{" "}
        <span className="text-fg-muted">
          {community.settings.displayName} is made up. Nothing you change is saved.
        </span>
      </span>
      <Link
        href="/start"
        className="press group inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
      >
        Set up your association
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </p>
  );
}
