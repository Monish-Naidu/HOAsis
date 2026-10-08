"use client";

import { useRef, useState } from "react";
import { Camera, Gavel } from "lucide-react";
import { Button, Field, Select, textareaClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { fineProblem } from "@/lib/app-state/use-enforcement";
import { ATTACHMENT_TYPES, attachmentProblem } from "@/lib/attachments";
import { amountFormatMessage, dollarsToCents } from "@/lib/input-checks";
import type { PhotoVantage, Violation } from "@/lib/types";
import { VANTAGE_LABEL } from "@/lib/violations";
import { addDays, cn, formatDate, money, todayIsoDate } from "@/lib/utils";

/** Photos only: a PDF is a fine attachment on a request but not evidence of a yard. */
const PHOTO_TYPES = ATTACHMENT_TYPES.filter((type) => type.startsWith("image/")).join(",");

const VANTAGES = Object.keys(VANTAGE_LABEL) as PhotoVantage[];

const FIELD = cn(textareaClass, "mt-1.5");

/**
 * The step after a hearing: what the board decided to charge. Posting it
 * puts the amount on the home's statement and moves the notice to fined, so
 * the letter's promise ("will appear on your statement") is one the code
 * keeps. Shown only at the hearing stage; a fine is never a stage click.
 */
export function FineForm({ violation }: { violation: Violation }) {
  const { fineViolation } = useAppState();
  const { notify } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cents = dollarsToCents(amount);
  const typed = amount.trim().length > 0;
  const problem = !typed
    ? null
    : Number.isNaN(cents)
      ? amountFormatMessage(amount)
      : fineProblem(violation, cents);
  const ready = typed && problem === null;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    const ok = await fineViolation(violation.id, cents, note);
    setBusy(false);
    if (ok) {
      notify(`${violation.reference} fined ${money(cents)}. It is on the home's statement.`);
      setAmount("");
      setNote("");
    } else {
      notify("The fine was not posted. Try again.", "warn");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3 rounded-card border border-border bg-surface-2 p-3.5"
    >
      <p className="flex items-center gap-1.5 text-footnote font-semibold text-fg-muted">
        <Gavel className="size-3.5" />
        Record the hearing&apos;s fine
      </p>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="Amount in dollars" error={problem}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="150.00"
            className={FIELD}
          />
        </Field>
        <Field label="Note (optional)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="What the board decided"
            className={FIELD}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={!ready || busy}>
          {ready ? `Fine ${money(cents)}` : "Fine"}
        </Button>
        <span className="text-footnote text-fg-subtle">
          Goes on the home&apos;s statement, due {formatDate(addDays(todayIsoDate(), 30))}.
        </span>
      </div>
    </form>
  );
}

/** One line on a fined notice: what, and by when. */
export function fineLine(violation: Pick<Violation, "fineCents" | "nextActionDate">): string {
  return `Fined ${money(violation.fineCents)}, due ${formatDate(violation.nextActionDate)}`;
}

/**
 * A photograph the board took, added to a notice. "What it shows" is
 * required because it is what the owner is told and what a hearing turns on;
 * where it was taken from is recorded because it is what an appeal turns on.
 */
export function AddPhotoForm({ violation }: { violation: Violation }) {
  const { addViolationPhoto } = useAppState();
  const { notify } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [brief, setBrief] = useState("");
  const [vantage, setVantage] = useState<PhotoVantage>("street");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const fileProblem = file ? attachmentProblem(file) : null;
  const ready = file !== null && fileProblem === null && brief.trim().length >= 3;

  async function submit() {
    if (!file || !ready || busy) return;
    setBusy(true);
    const ok = await addViolationPhoto(violation.id, file, brief, vantage);
    setBusy(false);
    if (ok) {
      notify(`Photo added to ${violation.reference}.`);
      setFile(null);
      setBrief("");
      setVantage("street");
      if (input.current) input.current.value = "";
    } else {
      notify("The photo was not added. Try again.", "warn");
    }
  }

  return (
    <details className="group rounded-card border border-border bg-surface-2">
      <summary className="flex cursor-pointer items-center gap-1.5 px-3.5 py-2.5 text-footnote font-semibold text-fg-muted">
        <Camera className="size-3.5" />
        Add a photo
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3 border-t border-border p-3.5"
      >
        <Field label="Photo" error={fileProblem}>
          <input
            ref={input}
            type="file"
            accept={PHOTO_TYPES}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-footnote text-fg-muted file:mr-3 file:rounded-lg file:border file:border-border-2 file:bg-surface file:px-3 file:py-1.5 file:text-footnote file:font-medium file:text-fg"
          />
        </Field>
        <Field label="What it shows">
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={200}
            placeholder="Trash bins left at the curb since Monday"
            className={FIELD}
          />
        </Field>
        <Field label="Where it was taken from">
          <Select
            value={vantage}
            onChange={(e) => setVantage(e.target.value as PhotoVantage)}
            className="mt-1.5 w-full"
          >
            {VANTAGES.map((v) => (
              <option key={v} value={v}>
                {VANTAGE_LABEL[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" size="sm" disabled={!ready || busy}>
          Add photo
        </Button>
      </form>
    </details>
  );
}
