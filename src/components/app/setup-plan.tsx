"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleCheck, PartyPopper } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { buildPlan, profileFromCommunity, type PlanPhase } from "@/lib/setup-plan";
import { cn } from "@/lib/utils";

/**
 * The plan, grouped by what finishing each part buys.
 *
 * Replaces a checklist of eleven items with a list of the ones that apply to
 * this association, in the order that gets money moving first. The milestone
 * that matters, "you can take a payment now", is announced rather than left to
 * be inferred from a fraction.
 */
export function SetupPlan() {
  const { community } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community));

  if (plan.allDone) {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <PartyPopper className="size-6" />
        </span>
        <p className="mt-3 text-[19px] font-semibold tracking-[-0.015em] text-fg">
          Everything is set up
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-relaxed text-fg-muted">
          Nothing outstanding. This page is here if you add something later.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
              {plan.canCollect
                ? "You can take payments"
                : `${plan.phases[0].total - plan.phases[0].done} to go before you can take a payment`}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
              {plan.canCollect
                ? "The rest of this makes the association easier to run. None of it is urgent."
                : "Start here. Everything below it can wait."}
            </p>
          </div>
          <p className="tnum shrink-0 text-[15px] font-semibold text-fg-muted">
            {plan.done} of {plan.total}
          </p>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${Math.round(plan.percent * 100)}%` }}
          />
        </div>
        {plan.skipped > 0 ? (
          // Worth saying once. It is the whole argument for asking three
          // questions instead of showing everybody the same eleven things.
          <p className="mt-3 text-[13px] text-fg-subtle">
            {plan.skipped} {plan.skipped === 1 ? "step does" : "steps do"} not apply to an
            association like yours, so we left {plan.skipped === 1 ? "it" : "them"} out.
          </p>
        ) : null}
      </Card>

      {plan.phases.map((phase) => (
        <Phase key={phase.id} phase={phase} />
      ))}
    </div>
  );
}

function Phase({ phase }: { phase: PlanPhase }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {phase.title}
          {phase.complete ? (
            <Badge tone="ok" className="ml-2">
              Done
            </Badge>
          ) : null}
        </h2>
        <p className="tnum text-[13px] text-fg-muted">
          {phase.done} of {phase.total}
        </p>
      </div>
      <p className="mb-3 text-[15px] leading-relaxed text-fg-muted">{phase.outcome}</p>

      <Card className="divide-y divide-border">
        {phase.tasks.map((task) => (
          <Link
            key={task.key}
            href={task.href}
            className={cn(
              "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2",
              task.complete && "opacity-60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                task.complete
                  ? "border-ok bg-ok text-white"
                  : "border-border-2 text-transparent",
              )}
              aria-hidden
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[15px] font-semibold text-fg",
                  task.complete && "line-through",
                )}
              >
                {task.label}
              </span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">
                {task.because ?? task.detail}
              </span>
            </span>
            {task.complete ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
            ) : (
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            )}
          </Link>
        ))}
      </Card>
    </section>
  );
}

/**
 * The one line version for the dashboard.
 *
 * Deliberately a link rather than a list. The workspace should look like a
 * workspace; a to-do list living permanently on the dashboard is how a board
 * learns to read past it.
 */
export function SetupPlanSummary() {
  const { community } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community));
  if (plan.allDone) return null;

  return (
    <Link
      href="/admin/setup"
      className="mb-5 flex items-center gap-4 rounded-card border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <Ring percent={plan.percent} done={plan.done} total={plan.total} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {plan.canCollect ? "Finish setting up" : "Set up payments"}
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">
          {plan.canCollect
            ? "You can already take payments. The rest makes the association easier to run."
            : `${plan.phases[0].total - plan.phases[0].done} things before you can take a payment.`}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
    </Link>
  );
}

function Ring({ percent, done, total }: { percent: number; done: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
        <circle cx="24" cy="24" r={r} className="fill-none stroke-surface-3" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          className="fill-none stroke-brand transition-all duration-500"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent)}
        />
      </svg>
      <span className="tnum absolute text-[13px] font-semibold text-fg">
        {done}
        <span className="text-fg-subtle">/{total}</span>
      </span>
    </span>
  );
}
