"use client";

import { AlertTriangle, Check } from "lucide-react";
import { Button, Callout, Card } from "@/components/ui/primitives";
import { booksDone, openingTotals, type PendingBooks } from "@/lib/founding-books";
import { formatDate, money } from "@/lib/utils";
import { MONTHS } from "./books";

/**
 * A founded association whose books did not all land.
 *
 * Shown in place of the wizard, so the only way forward is to save these
 * figures into the association that already exists, never to found it
 * again. Each figure is shown as it will be saved, with what has landed
 * so far, and nothing is thrown away unless the founder says so.
 */
export function PendingBooksPanel({
  pending,
  busy,
  onRetry,
  onLater,
  onDiscard,
}: {
  pending: PendingBooks;
  busy: boolean;
  onRetry: () => void;
  onLater: () => void;
  onDiscard: () => void;
}) {
  const { books } = pending;
  const [month, day] = books.fiscalYearStart.split("-").map(Number);
  const opening = openingTotals(books);
  const phones = books.rows.filter((r) => r.phone.trim()).length;
  const name = pending.associationName || "Your association";
  // Every figure landed and only opening the association is left.
  const saved = booksDone(pending);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="text-headline font-semibold text-fg">
        {saved
          ? `${name} is set up and its books are saved.`
          : `${name} is set up. Its books are not saved yet.`}
      </h1>
      <p className="mt-1.5 text-body text-fg-muted">
        {saved
          ? `Opening ${name} again does not save anything twice.`
          : `Nothing you entered is lost. It is kept on this device until it is saved to ${name}. Trying again saves it there; it does not create another association.`}
      </p>

      {pending.problem ? (
        <Callout
          tone="danger"
          className="mt-5"
          icon={<AlertTriangle className="size-4" />}
          title="The last try did not finish"
        >
          {pending.problem}
        </Callout>
      ) : null}

      <Card className="mt-5 divide-y divide-border">
        <Row
          label="Budget year starts"
          value={`${MONTHS[month - 1] ?? books.fiscalYearStart} ${day || 1}`}
          saved={pending.datesSaved}
        />
        <Row
          label="First bill"
          value={formatDate(books.billingStartsOn, "long")}
          saved={pending.datesSaved}
        />
        {opening.homes ? (
          <Row
            label={`Opening balances as of ${formatDate(books.openingAsOf, "long")}`}
            value={`${opening.homes} ${opening.homes === 1 ? "home" : "homes"}, ${money(opening.cents)} in total`}
            saved={pending.rosterSaved}
          />
        ) : null}
        {phones ? (
          <Row
            label="Phone numbers"
            value={`${phones} ${phones === 1 ? "home" : "homes"}`}
            saved={pending.rosterSaved}
          />
        ) : null}
      </Card>

      <div className="mt-5 flex flex-wrap gap-2">
        {saved ? (
          <Button variant="primary" onClick={onRetry} disabled={busy}>
            {busy ? "Opening" : `Open ${name}`}
          </Button>
        ) : (
          <>
            <Button variant="primary" onClick={onRetry} disabled={busy}>
              {busy ? "Saving" : "Save the books"}
            </Button>
            <Button onClick={onLater} disabled={busy}>
              Go to the plan and come back
            </Button>
            <Button variant="ghost" onClick={onDiscard} disabled={busy}>
              Discard these figures
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, saved }: { label: string; value: string; saved: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-caption text-fg-muted">{label}</p>
        <p className="text-body font-medium text-fg">{value}</p>
      </div>
      <span
        className={
          saved
            ? "inline-flex shrink-0 items-center gap-1 text-caption text-ok"
            : "shrink-0 text-caption text-warn"
        }
      >
        {saved ? <Check className="size-3.5" /> : null}
        {saved ? "Saved" : "Not saved"}
      </span>
    </div>
  );
}
