"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * A word with its meaning one tap away. Tap, not hover: a hover tooltip
 * never opens on a phone and vanishes when an unsteady pointer drifts. The
 * dotted underline and the small question mark say it can be tapped.
 */
export function Term({
  k,
  children,
  className,
}: {
  k: GlossaryKey;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Which edge the note hangs from: a word near the right of the screen
  // opens leftward, so the note never runs off the side.
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={box} className={cn("relative inline", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          // A term inside a link or a row explains itself; it does not open the row.
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setAlignRight(r.left + 288 > window.innerWidth - 16);
          setOpen((v) => !v);
        }}
        className="inline cursor-help underline decoration-fg-subtle decoration-dotted decoration-1 underline-offset-4 hover:decoration-fg-muted"
      >
        {children}
        <CircleHelp aria-hidden className="ml-1 inline size-3.5 align-[-2px] text-fg-subtle" />
        <span className="sr-only"> (what this means)</span>
      </button>
      {open ? (
        <span
          id={id}
          role="note"
          className={cn(
            "animate-rise absolute top-full z-30",
            alignRight ? "right-0" : "left-0",
            "mt-2 block w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 text-left text-footnote font-normal normal-case leading-snug tracking-normal text-fg shadow-float",
          )}
        >
          {GLOSSARY[k]}
        </span>
      ) : null}
    </span>
  );
}
