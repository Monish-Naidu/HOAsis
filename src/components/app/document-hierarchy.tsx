import { Landmark } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { GOVERNING_DOCS, articlesIn, documentsPresent } from "@/lib/governing";
import type { GoverningArticle } from "@/lib/types";
import { pluralize } from "@/lib/utils";

/**
 * Which document is which, and which one wins.
 *
 * Boards and owners say "the bylaws" for all of it, and the conflation is not
 * harmless. A board that thinks it can change a covenant by board vote has
 * adopted something void. An owner who thinks the neighbours can vote away the
 * declaration is wrong in the other direction. The most common form of both
 * mistakes is a rule that goes further than the declaration allows, which
 * survives precisely because nobody checks the layer above it.
 *
 * So this is a ladder, not a list. The order is the answer, and state law sits
 * at the top of it because a provision the legislature has since overridden is
 * still sitting in most recorded declarations, unamended, looking enforceable.
 */
export function DocumentHierarchy({ articles }: { articles: GoverningArticle[] }) {
  const present = documentsPresent(articles);
  if (present.length === 0) return null;

  return (
    <Card>
      <div className="border-b border-border px-5 py-3.5">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <Landmark className="size-4 text-fg-muted" />
          Three documents, and which one wins
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          When two of them disagree, the one higher up this list governs. Most arguments in
          an association are really this question.
        </p>
      </div>

      <div className="divide-y divide-border">
        <div className="flex items-start gap-3 px-5 py-3.5">
          <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-fg-muted">
            1
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-fg">State law</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
              Beats all three of the documents below. A covenant the legislature has since
              overridden stays printed in the declaration and stops being enforceable
              anyway, which is why a provision existing is not the same as it applying.
            </p>
          </div>
        </div>

        {present.map((kind, index) => {
          const meta = GOVERNING_DOCS[kind];
          const count = articlesIn(articles, kind).length;
          return (
            <div key={kind} className="flex items-start gap-3 px-5 py-3.5">
              <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-fg-muted">
                {index + 2}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-[15px] font-semibold text-fg">{meta.label}</p>
                  <span className="text-[13px] text-fg-subtle">
                    {pluralize(count, "article")}
                    {meta.recorded ? " · recorded with the county" : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">
                  {meta.plain}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-subtle">
                  Changed by: {meta.changedBy.toLowerCase()}.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
