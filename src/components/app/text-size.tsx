"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { TEXT_SIZE_KEY as STORAGE_KEY } from "@/components/app/text-size-script";

/**
 * Three text sizes, chosen by the reader.
 *
 * Every size in the product is a type-scale token (`text-body`,
 * `text-footnote`, ...) in rem times `--type-scale`, so this grows the words
 * and leaves the layout alone, the way the text size setting on a phone does.
 * Browser zoom still works on top of it; this is for the reader who has
 * never heard of browser zoom. It lives in Settings on both sides (resident
 * Settings, board Settings > Display), where people look for it.
 */
export type TextSize = "standard" | "large" | "largest";

const DEFAULT_SIZE: TextSize = "standard";
const SIZES: TextSize[] = ["standard", "large", "largest"];

let listeners: (() => void)[] = [];
let cached: TextSize | null = null;

function read(): TextSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SIZES.includes(stored as TextSize) ? (stored as TextSize) : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

function getSnapshot(): TextSize {
  if (cached === null) cached = read();
  return cached;
}

function getServerSnapshot(): TextSize {
  return DEFAULT_SIZE;
}

function subscribe(onChange: () => void) {
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
  };
}

function setTextSize(size: TextSize) {
  cached = size;
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    /* private browsing. The change still holds for this visit. */
  }
  if (size === DEFAULT_SIZE) delete document.documentElement.dataset.textSize;
  else document.documentElement.dataset.textSize = size;
  listeners.forEach((l) => l());
}

const options: { value: TextSize; label: string; glyph: string }[] = [
  { value: "standard", label: "Standard", glyph: "text-[15px]" },
  { value: "large", label: "Large", glyph: "text-[19px]" },
  { value: "largest", label: "Largest", glyph: "text-[23px]" },
];

/**
 * The choice, spelled out: three buttons, each an "A" at the size it gives
 * and the word under it. Labelled so nobody has to guess what the A means.
 */
export function TextSizeControl({ className }: { className?: string }) {
  const size = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div
      role="radiogroup"
      aria-label="Text size"
      className={cn("grid grid-cols-3 gap-2", className)}
    >
      {options.map((o) => {
        const on = size === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTextSize(o.value)}
            className={cn(
              "press flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 transition-colors",
              on
                ? "border-primary bg-primary-soft text-fg ring-1 ring-primary"
                : "border-border-2 bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span aria-hidden className={cn("font-semibold leading-none", o.glyph)}>
              A
            </span>
            <span className={cn("text-footnote", on ? "font-semibold" : "font-medium")}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
