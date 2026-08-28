"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { buildPlan, profileFromCommunity } from "@/lib/setup-plan";

/**
 * The way back to the list.
 *
 * Every task on the list links into the workspace, and once a board followed
 * one there was nothing to follow back. So while setup is unfinished a thin
 * bar rides above the page with the count and a way back, and it disappears
 * the moment the list is complete.
 *
 * It also does the returning. A board that came here from the list, with
 * `?from=setup` on the address, is taken back to the list the moment the
 * task this screen exists for is done, with the count moved. Somebody who
 * came here on their own is left where they are.
 */
export function SetupReturnBar() {
  const { community } = useAppState();
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = useToast();
  const plan = buildPlan(community, profileFromCommunity(community));
  const tasks = plan.phases.flatMap((phase) => phase.tasks);
  const doneKeys = tasks.filter((task) => task.complete).map((task) => task.key).join(",");
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = doneKeys;
    if (before === null) return;
    const fresh = doneKeys.split(",").filter((key) => key && !before.split(",").includes(key));
    if (!fresh.length) return;
    const fromSetup =
      new URLSearchParams(window.location.search).get("from") === "setup";
    const finishedHere = fresh
      .map((key) => tasks.find((task) => task.key === key))
      .filter((task) => task && task.href === pathname);
    if (!fromSetup || !finishedHere.length) return;
    const label = finishedHere[0]?.label ?? "Done";
    notify(`${label}: done. ${plan.done} of ${plan.total}.`, "ok");
    router.push("/admin/setup");
  }, [doneKeys, pathname, tasks, plan.done, plan.total, notify, router]);

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
