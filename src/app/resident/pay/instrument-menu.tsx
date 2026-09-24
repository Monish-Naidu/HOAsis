"use client";

import { MoreHorizontal, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small per-row menu on a saved payment method: make it the default, or
 * remove it. One open at a time, and closing is the same press that opened
 * it. Shared by the demo list and the Stripe panel so the two never drift.
 */
export function InstrumentMenu({
  label,
  isDefault,
  open,
  onToggle,
  onMakeDefault,
  onRemove,
}: {
  label: string;
  isDefault: boolean;
  open: boolean;
  onToggle: () => void;
  onMakeDefault: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`Options for ${label}`}
        aria-expanded={open}
        onClick={onToggle}
        className="press flex size-10 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-20 cursor-default"
            onClick={onToggle}
          />
          <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-card border border-border bg-surface shadow-float">
            <button
              type="button"
              disabled={isDefault}
              onClick={onMakeDefault}
              className="flex w-full items-center gap-2.5 h-11 px-3.5 text-left text-[15px] text-fg hover:bg-surface-2 disabled:opacity-40"
            >
              <Star className={cn("size-3.5", isDefault && "fill-current")} />
              {isDefault ? "Already default" : "Make default"}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex w-full items-center gap-2.5 border-t border-border h-11 px-3.5 text-left text-[15px] text-danger hover:bg-danger-soft"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
