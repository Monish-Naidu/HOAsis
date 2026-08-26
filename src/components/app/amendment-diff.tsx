"use client";

import { Minus, Plus } from "lucide-react";
import type { BylawAmendment, BylawArticle } from "@/lib/types";

/**
 * What the words become.
 *
 * Paragraph level rather than word level on purpose. A word diff of legal text
 * produces a speckled mess that is harder to read than either version, and the
 * question an owner is actually answering is "which paragraphs am I voting to
 * add or strike". Several states require the marked up text be delivered
 * before the vote, and this is that text.
 */
export function AmendmentDiff({
  amendment,
  current,
}: {
  amendment: BylawAmendment;
  /** The article as it stands. Absent when the proposal adds a new one. */
  current?: BylawArticle;
}) {
  const before = current?.text ?? [];
  const after = amendment.kind === "remove" ? [] : amendment.text;

  const removed = before.filter((p) => !after.includes(p));
  const added = after.filter((p) => !before.includes(p));
  const kept = before.filter((p) => after.includes(p));

  return (
    <div className="space-y-3">
      {kept.length > 0 ? (
        <div>
          <p className="text-[13px] font-semibold text-fg-muted">Unchanged</p>
          <div className="mt-1.5 space-y-2">
            {kept.map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-fg-muted">
                {p}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {removed.length > 0 ? (
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-danger">
            <Minus className="size-3.5" strokeWidth={2.6} />
            {amendment.kind === "remove" ? "Struck in full" : "Struck"}
          </p>
          <div className="mt-1.5 space-y-2">
            {removed.map((p, i) => (
              <p
                key={i}
                className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[15px] leading-relaxed text-fg line-through decoration-danger/50"
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {added.length > 0 ? (
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
            <Plus className="size-3.5" strokeWidth={2.6} />
            {amendment.kind === "add" ? "New article" : "Added"}
          </p>
          <div className="mt-1.5 space-y-2">
            {added.map((p, i) => (
              <p
                key={i}
                className="rounded-lg border border-ok/25 bg-ok-soft px-3 py-2 text-[15px] leading-relaxed text-fg"
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
