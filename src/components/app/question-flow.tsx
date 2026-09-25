"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * One question at a time.
 *
 * A form with nine fields asks the reader to find the one that matters. A
 * screen with one question does not. Each answer moves the page to the next
 * question, the way a conversation does, and anything that does not apply can
 * be passed over with a labelled button rather than left blank and wondered
 * about.
 *
 * The engine knows nothing about what is being asked. It draws the progress,
 * the title, the body it is handed, and the two or three buttons, and it
 * moves between questions with a short exit and a settled entrance so the
 * change reads as travel rather than as a cut.
 */

export type FlowDirection = "forward" | "back";

export interface FlowQuestion {
  id: string;
  /** Which part of the flow this is, for the eyebrow. */
  group: string;
  title?: string;
  detail?: ReactNode;
  body: ReactNode;
  /** Whether Continue is enabled. Defaults to true. */
  canContinue?: boolean;
  continueLabel?: string;
  /** A labelled way past the question without answering it. */
  skipLabel?: string;
  /** What Continue does instead of moving on, when it does something else. */
  onContinue?: () => void;
  /** What skipping does before moving on, such as clearing a half answer. */
  onSkip?: () => void;
  /** Enter in a field continues. For questions of one or two fields. */
  enterContinues?: boolean;
  /** The question draws its own buttons. */
  ownsFooter?: boolean;
}

/** How long the outgoing question takes to leave, matching `--dur-fast`. */
const LEAVE_MS = 180;

/**
 * Where the reader is, and how to move them.
 *
 * Tracked by id rather than by index, because a list of questions can change
 * shape mid-flow (an account step drops out when a session arrives) and an
 * index would then point one question off.
 */
export function useFlowPosition(initial: string) {
  const [current, setCurrent] = useState(initial);
  const [direction, setDirection] = useState<FlowDirection>("forward");
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const go = useCallback((id: string, dir: FlowDirection) => {
    setDirection(dir);
    setLeaving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setCurrent(id);
      setLeaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, LEAVE_MS);
  }, []);

  /** Lands somewhere without the motion, for a list that changed under us. */
  const jump = useCallback((id: string) => {
    window.clearTimeout(timer.current);
    setLeaving(false);
    setCurrent(id);
  }, []);

  return { current, direction, leaving, go, jump };
}

export function QuestionFlow({
  question,
  index,
  total,
  direction,
  leaving,
  onBack,
  onContinue,
  onSkip,
  busy,
  failure,
  above,
  below,
}: {
  question: FlowQuestion;
  index: number;
  total: number;
  direction: FlowDirection;
  leaving: boolean;
  onBack?: () => void;
  onContinue: () => void;
  onSkip: () => void;
  busy?: boolean;
  failure?: string | null;
  /** Anything to sit above the question, such as an offer to resume. */
  above?: ReactNode;
  /** Anything to sit under the buttons, such as a way out. */
  below?: ReactNode;
}) {
  const canContinue = question.canContinue !== false && !busy;
  const motion = leaving
    ? direction === "forward"
      ? "q-leave-up"
      : "q-leave-down"
    : direction === "forward"
      ? "q-enter-up"
      : "q-enter-down";

  return (
    <div
      className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14"
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !question.enterContinues || !canContinue) return;
        const target = event.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;
        event.preventDefault();
        (question.onContinue ?? onContinue)();
      }}
    >
      <Progress index={index} total={total} group={question.group} />

      {above}

      {/* Keyed by question so each one mounts fresh and plays its entrance. */}
      <div key={question.id} className={cn("mt-8", motion)}>
        {question.title ? (
          <div className="mb-6">
            <h1 className="text-title1 font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[32px]">
              {question.title}
            </h1>
            {question.detail ? (
              <p className="mt-2 max-w-[56ch] text-body leading-relaxed text-fg-muted sm:text-headline">
                {question.detail}
              </p>
            ) : null}
          </div>
        ) : null}

        {question.body}

        {failure ? (
          <p className="mt-6 rounded-lg bg-danger-soft px-3 py-2 text-footnote text-danger" role="status">
            {failure}
          </p>
        ) : null}

        {question.ownsFooter ? null : (
          // One row: Back on the left, Continue on the right. When there is
          // a skip, it sits beside Continue from a tablet up; on a phone the
          // three did not fit, so Back drops to its arrow, Continue takes the
          // row, and the skip goes full width underneath. One button, moved
          // by `order`, so there is never a hidden twin for a test to find.
          <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2">
            {onBack ? (
              <Button
                variant="ghost"
                size="lg"
                onClick={onBack}
                disabled={busy}
                className="order-1 max-sm:px-3"
              >
                <ArrowLeft className="size-4" />
                <span className="max-sm:sr-only">Back</span>
              </Button>
            ) : null}
            {question.skipLabel ? (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  question.onSkip?.();
                  onSkip();
                }}
                disabled={busy}
                className="order-3 basis-full sm:order-2 sm:ml-auto sm:basis-auto"
              >
                {question.skipLabel}
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              onClick={question.onContinue ?? onContinue}
              disabled={!canContinue}
              className={cn(
                "order-2 ml-auto max-sm:flex-1 sm:order-3",
                question.skipLabel && "sm:ml-0",
              )}
            >
              {busy ? "One moment" : (question.continueLabel ?? "Continue")}
              {busy ? null : <ArrowRight className="size-4" />}
            </Button>
          </div>
        )}
      </div>

      {below}
    </div>
  );
}

/**
 * A single bar that fills as the reader goes, and one line saying where they
 * are. Not a row of named steps: with a dozen questions the names would not
 * fit, and a reader who wants to know what is coming is better served by the
 * questions themselves being short.
 */
function Progress({ index, total, group }: { index: number; total: number; group: string }) {
  const percent = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  return (
    <div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-label="Setup progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-footnote font-semibold text-fg-muted">
        Step {index + 1} of {total} · {group}
      </p>
    </div>
  );
}
