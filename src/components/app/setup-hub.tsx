"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Info, Plus, Undo2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import {
  SETUP_TASKS,
  TIER_BLURB,
  TIER_LABEL,
  setupProgress,
  type TaskState,
  type Tier,
} from "@/lib/setup";
import { cn } from "@/lib/utils";

/**
 * What is left to set up.
 *
 * Built around one idea: a board should always be able to see how far along
 * they are, and should never be blocked by a question that does not apply to
 * them. So the ring counts only what they have not skipped, skipping is a
 * decision they can reverse, and the three tiers say plainly which parts are
 * required and which are just good practice.
 *
 * Every task explains itself. A list that says "add a budget" teaches nobody
 * anything; one that says why a budget has to exist, and by when, is the
 * difference between software and a filing cabinet.
 */

const TIERS: Tier[] = ["essential", "recommended", "complete"];

export function SetupHub({ compact = false }: { compact?: boolean }) {
  const { community, dismissedSetupTasks, dismissSetupTask, restoreSetupTask } =
    useAppState();
  const [open, setOpen] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const progress = setupProgress(community, dismissedSetupTasks);
  const skipped = progress.tasks.filter((t) => t.dismissed);

  if (progress.allDone && !skipped.length) return null;

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <Ring percent={progress.percent} done={progress.done} total={progress.total} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
              {progress.allDone
                ? "Everything is set up"
                : progress.canCollect
                  ? "You can take payments"
                  : "A few things before you can collect"}
            </h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
              {progress.allDone
                ? "Nothing outstanding. Anything you skipped is still there if you want it."
                : progress.canCollect
                  ? "Dues can be collected right now. What is left makes the association easier to run, and most of it is optional."
                  : `${progress.essentialsRemaining} ${
                      progress.essentialsRemaining === 1 ? "thing" : "things"
                    } still stand between you and taking a payment.`}
            </p>
          </div>
        </div>
      </Card>

      {TIERS.map((tier) => {
        const tasks = progress.tasks.filter((t) => t.tier === tier && !t.dismissed);
        if (!tasks.length) return null;
        const tierDone = tasks.filter((t) => t.complete).length;

        return (
          <section key={tier}>
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
                  {TIER_LABEL[tier]}
                </h3>
                <p className="mt-0.5 text-[13px] text-fg-muted">{TIER_BLURB[tier]}</p>
              </div>
              <span className="tnum text-[13px] text-fg-subtle">
                {tierDone} of {tasks.length}
              </span>
            </div>

            <Card className="divide-y divide-border overflow-hidden">
              {tasks.map((task) => (
                <TaskRow
                  key={task.key}
                  task={task}
                  expanded={open === task.key}
                  onToggle={() => setOpen(open === task.key ? null : task.key)}
                  onSkip={() => dismissSetupTask(task.key)}
                  compact={compact}
                />
              ))}
            </Card>
          </section>
        );
      })}

      {skipped.length ? (
        <div>
          <button
            type="button"
            onClick={() => setShowSkipped((v) => !v)}
            className="text-[13px] font-medium text-accent hover:underline"
          >
            {showSkipped ? "Hide" : "Show"} {skipped.length} skipped{" "}
            {skipped.length === 1 ? "item" : "items"}
          </button>
          {showSkipped ? (
            <Card className="mt-2.5 divide-y divide-border overflow-hidden">
              {skipped.map((task) => (
                <div key={task.key} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-fg-muted">{task.label}</span>
                    <span className="block text-[13px] text-fg-subtle">{task.detail}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => restoreSetupTask(task.key)}
                  >
                    <Undo2 className="size-3.5" />
                    Put it back
                  </Button>
                </div>
              ))}
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TaskRow({
  task,
  expanded,
  onToggle,
  onSkip,
  compact,
}: {
  task: TaskState;
  expanded: boolean;
  onToggle: () => void;
  onSkip: () => void;
  compact: boolean;
}) {
  if (task.complete) {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] text-fg-muted line-through">
          {task.label}
        </span>
        <Link
          href={task.href}
          className="text-[13px] font-medium text-fg-subtle hover:text-fg"
        >
          Change
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3 px-5 py-3.5">
        <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-border-2" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-fg">{task.label}</span>
            {task.optional ? <Badge tone="neutral">Optional</Badge> : null}
          </div>
          <p className="mt-0.5 text-[13px] text-fg-muted">{task.detail}</p>

          {expanded ? (
            <p className="mt-3 rounded-lg bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-fg-muted">
              {task.why}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={task.href}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
            >
              {compact ? "Open" : "Do this"}
              <ArrowRight className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Info className="size-3.5" />
              {expanded ? "Hide" : "Why this matters"}
            </button>
            {task.optional ? (
              <button
                type="button"
                onClick={onSkip}
                className="inline-flex h-9 items-center rounded-lg px-2.5 text-[13px] font-medium text-fg-subtle hover:bg-surface-2 hover:text-fg"
              >
                {task.dismissLabel ?? "Not applicable"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The progress ring.
 *
 * Drawn rather than charted, because it is one number and a library would be
 * more code than the arc. `pathLength` normalises the circumference to 100, so
 * the dash maths is just the percentage.
 */
function Ring({ percent, done, total }: { percent: number; done: number; total: number }) {
  const pct = Math.round(percent * 100);
  return (
    <div className="relative size-[104px] shrink-0">
      <svg viewBox="0 0 44 44" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="22"
          cy="22"
          r="19"
          pathLength={100}
          fill="none"
          strokeWidth="4"
          className="stroke-border-2"
        />
        <circle
          cx="22"
          cy="22"
          r="19"
          pathLength={100}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${pct} 100`}
          className={cn(
            "transition-[stroke-dasharray] duration-700",
            pct === 100 ? "stroke-ok" : "stroke-brand",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[22px] font-semibold leading-none tracking-[-0.02em] text-fg">
          {done}
          <span className="text-[15px] text-fg-subtle">/{total}</span>
        </span>
        <span className="mt-0.5 text-[11px] text-fg-subtle">done</span>
      </div>
    </div>
  );
}

/** A one line version for the dashboard, once setup is mostly behind them. */
export function SetupSummary() {
  const { community, dismissedSetupTasks } = useAppState();
  const progress = setupProgress(community, dismissedSetupTasks);
  if (progress.allDone) return null;

  return (
    <Link
      href="/board/setup"
      className="mb-5 flex items-center gap-4 rounded-card border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <Ring percent={progress.percent} done={progress.done} total={progress.total} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold tracking-[-0.015em] text-fg">
          Finish setting up
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">
          {progress.canCollect
            ? "You can already take payments. The rest makes the association easier to run."
            : `${progress.essentialsRemaining} ${
                progress.essentialsRemaining === 1 ? "thing" : "things"
              } before you can take a payment.`}
        </span>
      </span>
      <Plus className="size-4 shrink-0 rotate-45 text-fg-subtle" aria-hidden />
    </Link>
  );
}

export { SETUP_TASKS };
