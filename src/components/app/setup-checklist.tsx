"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Community } from "@/lib/data/community";

/**
 * What a new board still has to do.
 *
 * Derived from the association itself rather than from a stored "you finished
 * onboarding" flag. A flag goes stale the moment someone deletes their last
 * vendor or disconnects a bank, and it cannot tell an association that skipped
 * a step from one that undid it. Reading the data means the list is always
 * true, and it disappears on its own once there is nothing left to say.
 */

interface Task {
  id: string;
  label: string;
  detail: string;
  href: string;
  done: (c: Community) => boolean;
}

const TASKS: Task[] = [
  {
    id: "bank",
    label: "Connect the operating account",
    detail: "Dues have nowhere to land until you do. Everything else can wait; this cannot.",
    href: "/admin/money",
    done: (c) => c.bankAccounts.some((a) => a.kind === "operating"),
  },
  {
    id: "invites",
    label: "Invite your neighbors",
    detail: "A household with no email address has no way to reach their balance.",
    href: "/admin/homeowners",
    done: (c) => c.owners.every((o) => o.email.trim().length > 0),
  },
  {
    id: "budget",
    label: "Budget what you spend",
    detail: "Assessment income is already in. Add the expenses it has to cover.",
    href: "/admin/money",
    done: (c) => c.budget.some((line) => line.kind === "expense"),
  },
  {
    id: "documents",
    label: "Upload the governing documents",
    detail: "CC&Rs, bylaws, and rules, so owners can answer their own questions.",
    href: "/admin/documents",
    done: (c) => c.documents.length > 0,
  },
  {
    id: "reserves",
    label: "Commission a reserve study",
    detail: "Until one exists, there is no way to say whether reserves are enough.",
    href: "/admin/reserves",
    done: (c) => c.reserveComponents.length > 0,
  },
];

export function SetupChecklist() {
  const { community } = useAppState();
  const state = TASKS.map((task) => ({ ...task, complete: task.done(community) }));
  const remaining = state.filter((task) => !task.complete);

  // An association that has done all of it never sees this again.
  if (!remaining.length) return null;

  const done = state.length - remaining.length;

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3.5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
          Finish setting up {community.settings.displayName}
        </h2>
        <span className="tnum text-[11px] text-fg-subtle">
          {done} of {state.length} done
        </span>
      </div>

      <ul className="divide-y divide-border">
        {state.map((task) => (
          <li key={task.id}>
            {task.complete ? (
              <div className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-fg-subtle line-through">
                  {task.label}
                </span>
              </div>
            ) : (
              <Link
                href={task.href}
                className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
              >
                <span className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-border-2" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">{task.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">
                    {task.detail}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
