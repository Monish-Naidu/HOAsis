"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import type { Violation } from "@/lib/types";
import { formatDate, money, todayIsoDate } from "@/lib/utils";
import { placeLabel } from "@/lib/wording";

/**
 * A notice as a letter, ready for an envelope.
 *
 * Electronic notice is a courtesy in most states until the owner has agreed
 * to it in writing, and a fine that rests on an email alone is the first
 * thing struck at a hearing. The board needs paper, and the paper has to say
 * the same things the portal says: what was seen, which provision, what is
 * asked, by when, and how to answer. So it is the same record printed, not a
 * second document somebody types.
 *
 * Printing hides everything but the sheet. The overlay sits inside the app
 * shell, so the print rule in globals.css works on visibility rather than
 * on the tree: everything invisible, the sheet visible, positioned at the
 * top of the page.
 */

const SUBJECT: Record<Violation["stage"], string> = {
  courtesy: "Courtesy notice",
  "first-notice": "First notice",
  hearing: "Notice of hearing",
  fined: "Notice of fine",
  cured: "Notice of resolution",
};

export function NoticeLetter({
  violation,
  onClose,
}: {
  violation: Violation;
  onClose: () => void;
}) {
  const { community } = useAppState();
  const { association } = community;
  const owner = community.owners.find((o) => o.id === violation.ownerId);
  const today = todayIsoDate();
  const where = placeLabel(violation.unit);

  useEffect(() => {
    document.body.dataset.printing = "letter";
    return () => {
      delete document.body.dataset.printing;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="print-letter fixed inset-0 z-50 overflow-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label={`${SUBJECT[violation.stage]} for ${where}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3 print:hidden">
        <p className="text-[15px] font-semibold text-fg">
          {SUBJECT[violation.stage]} · {violation.reference}
        </p>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>
      </div>

      <div className="mx-auto my-8 max-w-2xl rounded-card border border-border bg-surface px-10 py-12 text-[15px] leading-relaxed text-fg shadow-sm print:my-0 print:max-w-none print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[17px] font-semibold tracking-[-0.01em]">{association.name}</p>
            <p className="text-fg-muted">{association.addressLine}</p>
          </div>
          <p className="tnum text-fg-muted">{formatDate(today, "long")}</p>
        </div>

        <div className="mt-8">
          <p className="font-medium">{violation.ownerName}</p>
          <p className="text-fg-muted">{where}</p>
          {owner?.mailingAddress ? (
            <p className="text-fg-muted">{owner.mailingAddress}</p>
          ) : owner?.address && owner.address !== where ? (
            <p className="text-fg-muted">{owner.address}</p>
          ) : null}
        </div>

        <p className="mt-8 font-semibold">
          Re: {SUBJECT[violation.stage]}, {violation.reference}
        </p>

        <div className="mt-5 space-y-4">
          <p>Dear {violation.ownerName},</p>
          <p>
            On {formatDate(violation.openedDate, "long")} the association observed the following
            at {where}: {violation.rule}
          </p>
          <p>
            The association relies on {violation.ruleCitation} of its governing documents, which
            every owner agreed to on taking title. A copy is available to you at any time through
            the resident portal or from the board on request.
          </p>
          {violation.stage === "hearing" ? (
            <p>
              A hearing has been set for {formatDate(violation.nextActionDate, "long")}. You are
              entitled to attend, to be heard, and to see every photograph and note the board is
              relying on before that date. No fine is decided before the hearing.
            </p>
          ) : violation.stage === "fined" ? (
            <p>
              Following the hearing, a fine of {money(violation.fineCents)} has been imposed and
              will appear on your statement. It is due by{" "}
              {formatDate(violation.nextActionDate, "long")}.
            </p>
          ) : violation.stage === "cured" ? (
            <p>
              The board has confirmed the matter is resolved as of{" "}
              {formatDate(violation.resolvedDate ?? violation.nextActionDate, "long")}. No further
              action is needed and nothing remains on your record from this notice.
            </p>
          ) : (
            <p>
              Please correct this by {formatDate(violation.nextActionDate, "long")}. If it is
              corrected by then, the matter is closed and nothing further follows.
              {violation.stage === "first-notice"
                ? " If it is not, the next step is a hearing before the board, at which a fine may be considered."
                : " If it is not, a formal first notice follows."}
            </p>
          )}
          <p>
            If you believe this notice is mistaken, or the work is already done, you may reply
            through the resident portal, where you can also see the photographs and dates the
            board is relying on. An appeal goes to the board and is answered on the record.
          </p>
          <p>Sincerely,</p>
          <div>
            <p className="font-medium">The Board of Directors</p>
            <p className="text-fg-muted">{association.name}</p>
          </div>
        </div>

        <p className="mt-10 border-t border-border pt-4 text-[13px] text-fg-subtle">
          {violation.reference} · opened {formatDate(violation.openedDate)} · printed{" "}
          {formatDate(today)}
        </p>
      </div>
    </div>
  );
}
