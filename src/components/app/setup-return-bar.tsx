"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";

/**
 * The way back to the plan.
 *
 * Every task on the plan links into the workspace, and once a board followed
 * one there was nothing to follow back. They uploaded the governing documents
 * and were then standing on the Documents page with no sign that they had just
 * completed a step, and no route to the next one.
 *
 * So while setup is unfinished, a thin bar rides above the page with the count
 * and a way back. It disappears the moment the plan is complete, which is the
 * only acceptable behaviour for a bar that appears on every screen.
 *
 * Hidden on the plan itself, where it would only point at the page you are on.
 */
export function SetupReturnBar() {
  const { community } = useAppState();
  const pathname = usePathname();
  const plan = buildPlan(community, profileFromCommunity(community));

  if (plan.allDone) return null;
  if (pathname === "/admin/setup" || pathname === "/admin") return null;

  return (
    <Link
      href="/admin/setup"
      className="mb-5 flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-2.5 transition-colors hover:bg-surface-2"
    >
      <ArrowLeft className="size-4 shrink-0 text-fg-subtle" />
      <span className="min-w-0 flex-1 text-[15px] font-medium text-fg">
        Back to setting up
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {/* The count is the point. A board that just finished a step should
            see the number move without going anywhere to check. */}
        <span className="hidden text-[13px] text-fg-muted sm:inline">
          {plan.done} of {plan.total} done
        </span>
        <span className="flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[13px] font-semibold text-ok">
          <Check className="size-3" strokeWidth={3} />
          {plan.done}
        </span>
      </span>
    </Link>
  );
}
