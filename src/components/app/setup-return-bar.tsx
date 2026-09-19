"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";

/**
 * The way back to the question.
 *
 * Every task on the list links into the workspace, and once a board followed
 * one there was nothing to follow back. So while setup is unfinished a thin
 * bar rides above the page with the count and a way back, and it disappears
 * the moment the list is complete.
 *
 * Back means the question they left, not the overview. A link out of a
 * question carries `?from=setup&task=<key>`, and the bar reads both: with a
 * task it points at that question on /start/plan, without one it points at
 * the overview. It also does the returning. When the task this screen exists
 * for gets done, the board is taken to the next open question, or to the
 * overview when there is none, with the count moved. Somebody who came here
 * on their own is left where they are.
 */
export function SetupReturnBar() {
  // useSearchParams needs a Suspense boundary; the layout is a server
  // component and cannot provide one, so the bar brings its own.
  return (
    <Suspense fallback={null}>
      <ReturnBar />
    </Suspense>
  );
}

function ReturnBar() {
  const { community } = useAppState();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();
  const plan = buildPlan(community, profileFromCommunity(community));
  const tasks = plan.phases.flatMap((phase) => phase.tasks);
  const doneKeys = tasks.filter((task) => task.complete).map((task) => task.key).join(",");
  const previous = useRef<string | null>(null);

  const fromSetup = params.get("from") === "setup";
  const requestedKey = params.get("task");
  const requested = tasks.find((task) => task.key === requestedKey);

  useEffect(() => {
    const before = previous.current;
    previous.current = doneKeys;
    if (before === null) return;
    const fresh = doneKeys.split(",").filter((key) => key && !before.split(",").includes(key));
    if (!fresh.length) return;
    const finishedHere = fresh
      .map((key) => tasks.find((task) => task.key === key))
      .filter((task) => task && task.href === pathname);
    if (!fromSetup || !finishedHere.length) return;
    const label = finishedHere[0]?.label ?? "Done";
    notify(`${label}: done. ${plan.done} of ${plan.total}.`, "ok");
    // On to the next question, in phase order, rather than back to the list
    // to find it. The list is where they land when nothing is left.
    const next = tasks.find((task) => !task.complete);
    router.push(next ? `/start/plan?task=${encodeURIComponent(next.key)}` : "/board/setup");
  }, [doneKeys, pathname, tasks, plan.done, plan.total, fromSetup, notify, router]);

  if (plan.allDone) return null;
  if (pathname === "/board/setup" || pathname === "/board") return null;

  const href = requested ? `/start/plan?task=${encodeURIComponent(requested.key)}` : "/board/setup";

  return (
    <Link
      href={href}
      className="mb-5 flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-2.5 transition-colors hover:bg-surface-2"
    >
      <ArrowLeft className="size-4 shrink-0 text-fg-subtle" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-fg">
          {requested ? "Back to the question" : "Back to setting up"}
        </span>
        {requested ? (
          <span className="block truncate text-[13px] text-fg-muted">{requested.label}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
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
