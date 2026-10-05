"use client";

import { useState } from "react";
import { AlertTriangle, Check, Download, Upload } from "lucide-react";
import { Button, Callout, Card } from "@/components/ui/primitives";
import { parseRosterCsv, rosterSummary, type RosterParse, type RosterRow } from "@/lib/roster/csv";
import { ROSTER_ACCEPT, downloadRosterTemplate, readFileText } from "@/lib/roster/template";
import { cn, money, pluralize } from "@/lib/utils";

/**
 * A spreadsheet, read and shown back before anything is created.
 *
 * The file is parsed in the browser; every row is listed with what is wrong
 * with it, in words, and the rows that are fine are counted. Nothing is
 * written until the person presses the one button, and rows with a problem
 * are never written at all: the file can be fixed and picked again, or the
 * good rows can go in now and the rest by hand.
 *
 * Used twice: on the homes question of the wizard, where the rows join the
 * draft, and on Homeowners, where they go straight to the register.
 */
export function RosterPreview({
  existingUnits,
  homeWord = "home",
  confirmLabel,
  onConfirm,
  busy = false,
  showBalances = true,
  showDues = false,
}: {
  /** Register keys already on the roster, so a row can say "will be updated". */
  existingUnits: string[];
  homeWord?: string;
  /** "Add 12 homes" is built here; pass a prefix to change the verb. */
  confirmLabel?: string;
  onConfirm: (rows: RosterRow[]) => void | Promise<void>;
  busy?: boolean;
  /** Whether the balance column means anything on this screen. */
  showBalances?: boolean;
  /** Whether the optional Dues column means anything here: a home's own regular assessment. */
  showDues?: boolean;
}) {
  const [parsed, setParsed] = useState<RosterParse | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const text = await readFileText(file);
      setFileName(file.name);
      setParsed(parseRosterCsv(text));
    } catch (error) {
      setParsed({
        rows: [],
        columns: {},
        problems: [error instanceof Error ? error.message : "Could not read the file"],
      });
    } finally {
      setReading(false);
    }
  }

  const summary = parsed ? rosterSummary(parsed.rows, existingUnits) : null;
  const existing = new Set(existingUnits.map((u) => u.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label
          aria-busy={reading}
          className="press inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border-2 bg-surface px-3.5 text-callout font-medium text-fg hover:bg-surface-2 aria-busy:opacity-70"
        >
          <Upload className="size-3.5" />
          {parsed ? "Pick another file" : "Choose a CSV file"}
          <input
            type="file"
            accept={ROSTER_ACCEPT}
            aria-label="Choose a roster spreadsheet"
            className="sr-only"
            disabled={reading || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void pick(file);
            }}
          />
        </label>
        <button
          type="button"
          onClick={downloadRosterTemplate}
          className="inline-flex min-h-10 items-center gap-1.5 text-footnote font-medium text-accent underline underline-offset-2 hover:text-fg"
        >
          <Download className="size-3.5" />
          Download the template
        </button>
      </div>
      <p className="text-footnote leading-relaxed text-fg-muted">
        Columns can be in any order and most names work: Name, Email, Unit or Lot, Address,
        Phone{showBalances ? ", Opening balance" : ""}{showDues ? ", Dues (what that home pays, if not the usual)" : ""}. Save as CSV from Excel or Google Sheets.
        Only the home is required.
      </p>

      {parsed && summary ? (
        <>
          {parsed.problems.length ? (
            <Callout
              tone={parsed.rows.length ? "info" : "warn"}
              icon={<AlertTriangle className="size-4" />}
              title={parsed.rows.length ? "About this file" : "This file cannot be read"}
            >
              <ul className="list-disc space-y-1 pl-4">
                {parsed.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Callout>
          ) : null}

          {parsed.rows.length ? (
            <>
              <p className="text-body text-fg">
                <span className="font-semibold">{fileName}</span>: {pluralize(parsed.rows.length, "row")}.{" "}
                {summary.creating.length ? `${pluralize(summary.creating.length, `new ${homeWord}`)}` : `no new ${homeWord}s`}
                {summary.updating.length ? `, ${summary.updating.length} already on the register (details filled in)` : ""}
                {summary.withEmail.length ? `, ${summary.withEmail.length} with an email` : ""}
                {showBalances && summary.withBalance.length
                  ? `, ${money(summary.owedCents)} owed across ${summary.withBalance.length}`
                  : ""}
                {showDues && summary.withDues.length
                  ? `, ${pluralize(summary.withDues.length, "home")} with their own dues`
                  : ""}
                {summary.problems.length ? (
                  <span className="text-warn">
                    {" "}
                    · {pluralize(summary.problems.length, "row")} with a problem, left out
                  </span>
                ) : null}
              </p>

              <Card className="max-h-[26rem] overflow-auto">
                <table className="w-full text-footnote">
                  <thead className="sticky top-0 bg-surface-2 text-left text-fg-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Line</th>
                      <th className="px-3 py-2 font-semibold">{homeWord[0].toUpperCase() + homeWord.slice(1)}</th>
                      <th className="px-3 py-2 font-semibold">Owner</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      {showBalances ? <th className="px-3 py-2 text-right font-semibold">Owes</th> : null}
                      {showDues ? <th className="px-3 py-2 text-right font-semibold">Dues</th> : null}
                      <th className="px-3 py-2 font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsed.rows.map((row) => {
                      const bad = row.problems.length > 0;
                      const known = existing.has(row.unit.toLowerCase());
                      return (
                        <tr key={row.line} className={cn(bad && "bg-warn-soft/40")}>
                          <td className="tnum px-3 py-2 text-fg-subtle">{row.line}</td>
                          <td className="px-3 py-2 text-fg">
                            <span className="block font-medium">{row.unit || "?"}</span>
                            {row.address && row.address !== row.unit ? (
                              <span className="block text-fg-muted">{row.address}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-fg">{row.name || <span className="text-fg-subtle">No owner</span>}</td>
                          <td className="px-3 py-2 text-fg-muted">{row.email || ""}</td>
                          {showBalances ? (
                            <td className="tnum px-3 py-2 text-right text-fg">
                              {row.openingBalanceCents !== undefined && row.openingBalanceCents !== 0
                                ? money(row.openingBalanceCents)
                                : ""}
                            </td>
                          ) : null}
                          {showDues ? (
                            <td className="tnum px-3 py-2 text-right text-fg">
                              {row.duesCents ? money(row.duesCents) : ""}
                            </td>
                          ) : null}
                          <td className="px-3 py-2">
                            {bad ? (
                              <span className="text-warn">{row.problems.join(" ")}</span>
                            ) : known ? (
                              <span className="text-fg-muted">On the register, will be updated</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-ok">
                                <Check className="size-3" strokeWidth={3} />
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  disabled={busy || summary.ok.length === 0}
                  onClick={() => void onConfirm(summary.ok)}
                >
                  {busy
                    ? "Adding"
                    : `${confirmLabel ?? "Add"} ${pluralize(summary.ok.length, homeWord)}`}
                </Button>
                {summary.problems.length ? (
                  <span className="text-footnote text-fg-muted">
                    Fix the {pluralize(summary.problems.length, "row")} in the file and pick it again, or add them by hand after.
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
