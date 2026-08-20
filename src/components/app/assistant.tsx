"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, MessageCircle, Sparkles, X } from "lucide-react";
import { answerQuestion, suggestedQuestions, type Answer } from "@/lib/assistant";
import type { AssistantContext } from "@/lib/data";
import { cn } from "@/lib/utils";

interface Turn {
  id: number;
  question: string;
  answer: Answer;
}

/**
 * Corner assistant. Answers from the context snapshot only, so it cannot
 * state a number that is not in the data.
 */
export function Assistant({
  context,
  variant = "fixed",
}: {
  context: AssistantContext;
  variant?: "fixed" | "inset";
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, open]);

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setTurns((t) => [...t, { id: t.length, question: q, answer: answerQuestion(q, context) }]);
    setInput("");
  }

  const anchor =
    variant === "fixed"
      ? "fixed bottom-5 right-5 z-40"
      : "absolute bottom-20 right-4 z-40";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the assistant"
        className={cn(
          anchor,
          "flex size-12 items-center justify-center rounded-full bg-navy-900 text-navy-50 shadow-float transition-transform hover:scale-105 dark:bg-navy-100 dark:text-navy-950",
        )}
      >
        <MessageCircle className="size-5" strokeWidth={2} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        anchor,
        "flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-float",
        variant === "inset" ? "max-h-[26rem]" : "max-h-[min(32rem,calc(100dvh-3rem))]",
      )}
      role="dialog"
      aria-label="Assistant"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="size-4 shrink-0 text-fg-muted" />
        <p className="flex-1 text-[13px] font-semibold text-fg">Ask about your account</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-fg-muted">
            I read your account and the association&apos;s records directly, so the numbers here
            are the real ones.
          </p>
        ) : null}

        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-xl rounded-br-sm bg-navy-900 px-3 py-2 text-[13px] text-navy-50 dark:bg-navy-100 dark:text-navy-950">
                {t.question}
              </p>
            </div>
            <div className="max-w-[92%] rounded-xl rounded-bl-sm bg-surface-2 px-3 py-2.5">
              <p className="text-[13px] leading-relaxed text-fg">{t.answer.text}</p>
              {t.answer.facts?.length ? (
                <dl className="mt-2 space-y-1 border-t border-border pt-2">
                  {t.answer.facts.map((f) => (
                    <div key={f.label} className="flex items-baseline justify-between gap-3">
                      <dt className="min-w-0 truncate text-[12px] text-fg-muted">{f.label}</dt>
                      <dd className="tnum shrink-0 text-[12px] font-medium text-fg">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {t.answer.action ? (
                <Link
                  href={t.answer.action.href}
                  onClick={() => setOpen(false)}
                  className="mt-2.5 inline-flex h-7 items-center rounded-md bg-brand px-2.5 text-[12px] font-semibold text-brand-fg"
                >
                  {t.answer.action.label}
                </Link>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2">
        {suggestedQuestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question"
          aria-label="Ask a question"
          className="min-w-0 flex-1 bg-transparent px-1 text-[13px] text-fg outline-none placeholder:text-fg-subtle"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-fg disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
