"use client";

import Link from "next/link";
import { ArrowRight, MonitorSmartphone } from "lucide-react";
import { Callout } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";

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
        <Link
          href="/signin"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-brand-fg"
        >
          Set it up for real
          <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      Nothing here is saved anywhere else and nobody else can sign in. Create an account, then
      run Quick Setup again signed in. It takes about three minutes.
    </Callout>
  );
}
