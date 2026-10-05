"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Scale } from "lucide-react";
import { Button, ButtonLink, Callout, Card, CardHeader, EmptyState, PageHeader, fieldClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { cn, money, pluralize } from "@/lib/utils";

/** Reads a typed amount into cents, tolerating "1,240.50" and "$1240". */
function toCents(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, "");
  if (!clean) return 0;
  if (!/^-?\d*\.?\d{0,2}$/.test(clean)) return null;
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** The label the opening line carries on a statement. */
const OPENING_LABEL = "Balance brought forward";

/**
 * What goes in each box to begin with: the home's opening line where one is
 * on its statement, and nothing where there is none.
 *
 * Never the home's balance today. That is the opening figure plus everything
 * billed and paid since, and a screen that showed it and then saved every
 * row wrote today's balance back as the opening line, so every home that had
 * been billed once owed its dues twice.
 */
export function openingFigures(
  community: Pick<ReturnType<typeof useAppState>["community"], "owners" | "ownerCharges">,
) {
  return Object.fromEntries(
    community.owners.map((owner) => {
      const line = (community.ownerCharges[owner.id] ?? []).find((l) => l.label === OPENING_LABEL);
      return [owner.id, line ? (line.amountCents / 100).toFixed(2) : ""];
    }),
  );
}

/**
 * The date each home's opening line carries, for the homes that have one.
 *
 * The date is half of the line. A board that set its balances and then saw
 * they were dated the day it typed them, not the day it switched, has to be
 * able to move the date without typing every amount again.
 */
export function openingDates(
  community: Pick<ReturnType<typeof useAppState>["community"], "owners" | "ownerCharges">,
): Record<string, string> {
  const dates: Record<string, string> = {};
  for (const owner of community.owners) {
    const line = (community.ownerCharges[owner.id] ?? []).find((l) => l.label === OPENING_LABEL);
    if (line) dates[owner.id] = line.date;
  }
  return dates;
}

/**
 * What each home owed on the day the association switched to us.
 *
 * This is the one screen that makes moving an established association work,
 * and it is deliberately not an import. Nothing here reads a file or an export
 * from another product, because reproducing a decade of somebody else's ledger
 * is where migrations stall and the reproduced version is never right anyway.
 * One figure per home on one date is enough to be correct from here forward,
 * and it is a number a treasurer can read off their own statement.
 *
 * The figure lands on the owner's statement as a dated line rather than as a
 * balance that appears from nowhere. An owner who cannot see where a number
 * came from disputes it, and a board that cannot show where it came from loses
 * that dispute.
 */
export function BalancesScreen() {
  const { community, setOpeningBalances } = useAppState();
  const { notify } = useToast();

  const owners = useMemo(
    () => [...community.owners].sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true })),
    [community.owners],
  );

  // What is on file for each home, and what is in each box. A home is saved
  // only when the two differ, so a correction to one home cannot rewrite the
  // other eighty seven.
  const [onFile, setOnFile] = useState<Record<string, string>>(() => openingFigures(community));
  const [entered, setEntered] = useState<Record<string, string>>(onFile);
  // The date each line on file carries. The date box starts on the one the
  // statements already show (the latest, if they differ), and on today for
  // an association that has set none.
  const [dateOnFile, setDateOnFile] = useState<Record<string, string>>(() => openingDates(community));
  const [asOf, setAsOf] = useState(
    () => Object.values(dateOnFile).sort().at(-1) ?? community.asOf,
  );
  // Whether the date box has been moved since the last save. Only then is a
  // different date on a line read as a correction to it: a home whose line
  // carries another day is not rewritten just because the screen was opened.
  const [dateMoved, setDateMoved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsed = owners.map((owner) => {
    const raw = entered[owner.id] ?? "";
    const redated =
      dateMoved && dateOnFile[owner.id] !== undefined && dateOnFile[owner.id] !== asOf;
    return {
      owner,
      raw,
      cents: toCents(raw),
      // A new figure, or the same figure under a corrected date. The second
      // applies only to a home that has a line to re-date.
      changed: raw.trim() !== (onFile[owner.id] ?? "") || redated,
    };
  });
  const bad = parsed.filter((row) => row.cents === null);
  const owing = parsed.filter((row) => (row.cents ?? 0) > 0);
  const totalCents = parsed.reduce((sum, row) => sum + (row.cents ?? 0), 0);
  const changed = parsed.filter((row) => row.changed);

  async function save() {
    // The line is cleared before it is written again, so a date the database
    // will refuse must not get as far as the clearing.
    if (bad.length > 0 || changed.length === 0 || saving || !asOf) return;
    const sending = changed;
    // Held until the write is back. For a real association it is two
    // statements per home, and a second press part way through could leave
    // a home with two opening lines.
    setSaving(true);
    const ok = await setOpeningBalances(
      asOf,
      sending.map((row) => ({ ownerId: row.owner.id, amountCents: row.cents ?? 0 })),
    );
    setSaving(false);
    // A refusal has already been said by the write itself.
    if (!ok) return;
    setOnFile((all) => ({
      ...all,
      ...Object.fromEntries(sending.map((row) => [row.owner.id, row.raw.trim()])),
    }));
    setDateOnFile((all) => {
      const next = { ...all };
      for (const row of sending) {
        // A home set to nothing has no line left to carry a date.
        if (row.cents) next[row.owner.id] = asOf;
        else delete next[row.owner.id];
      }
      return next;
    });
    setDateMoved(false);
    setSaved(true);
    notify(
      `Opening balances saved for ${pluralize(sending.length, "home")}. Statements show them as of ${asOf}.`,
    );
  }

  if (owners.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Homeowners"
          title="Opening balances"
          description="What each home owed on the day you switched."
        />
        <Card>
          <EmptyState
            icon={<Scale className="size-6" />}
            title="No homes on the register yet"
            description="Add homes first, then enter their balances."
            action={
              <ButtonLink
                href="/board/homeowners"
                variant="primary"
                size="md"
              >
                Go to Homeowners
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Homeowners"
        title="Opening balances"
        description="What each home owed on the day you switched. One amount per home."
      />

      <Callout tone="info" icon={<Scale className="size-4" />} title="Nothing before this date moves">
        History stays where it is. Copying years of old records is how a switch stalls, and
        the copy is never quite right. What matters is that each balance is right on the day you
        start billing here.
      </Callout>

      <Card className="mt-5">
        <CardHeader
          title="As of"
          subtitle="Balances are dated to this day on each statement"
          action={
            <input
              type="date"
              value={asOf}
              onChange={(e) => {
                setAsOf(e.target.value);
                setDateMoved(true);
                setSaved(false);
              }}
              aria-label="Balances as of"
              className={cn(fieldClass, "w-auto")}
            />
          }
        />
      </Card>

      <Card className="mt-5">
        <CardHeader
          title={`${pluralize(owners.length, "home")} on the register`}
          subtitle={
            owing.length > 0
              ? `${pluralize(owing.length, "home")} carrying a balance, ${money(totalCents)} in total`
              : "What each home owed on that day, not what it owes now. Only the homes you change are saved."
          }
        />
        <div className="divide-y divide-border">
          {parsed.map(({ owner, raw, cents }) => (
            <div key={owner.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-20 shrink-0 truncate text-footnote font-medium text-fg-subtle">
                {owner.unit}
              </span>
              <span className="min-w-0 flex-1 truncate text-body text-fg">
                {owner.displayName}
                {/* For reference only. It includes everything billed and paid
                    here since the switch, so it is not the figure to type. */}
                {owner.balanceCents !== 0 ? (
                  <span className="ml-2 text-footnote text-fg-muted">
                    {owner.balanceCents > 0
                      ? `Owes ${money(owner.balanceCents)} today`
                      : `${money(-owner.balanceCents)} in credit today`}
                  </span>
                ) : null}
              </span>
              <label className="relative w-36 shrink-0">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-fg-subtle">
                  $
                </span>
                <input
                  inputMode="decimal"
                  value={raw}
                  onChange={(e) => {
                    setEntered((all) => ({ ...all, [owner.id]: e.target.value }));
                    setSaved(false);
                  }}
                  placeholder="0.00"
                  aria-label={`Opening balance for ${owner.displayName}, ${owner.unit}`}
                  className={`tnum h-9 w-full rounded-lg border bg-surface pl-6 pr-3 text-right text-body text-fg outline-none focus:border-brand ${
                    cents === null ? "border-danger" : "border-border-2"
                  }`}
                />
              </label>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void save()}
          disabled={bad.length > 0 || changed.length === 0 || saving || !asOf}
        >
          <Check className="size-4" />
          {saving
            ? "Saving"
            : changed.length > 0
              ? `Save ${pluralize(changed.length, "balance")}`
              : saved
                ? "Saved"
                : "Save balances"}
        </Button>
        {bad.length > 0 ? (
          <p className="text-footnote text-danger">
            {pluralize(bad.length, "amount")} could not be read. Use figures only, like 1240.50.
          </p>
        ) : (
          <p className="text-footnote text-fg-subtle">
            Each one appears on that owner&apos;s statement as &ldquo;Balance brought
            forward&rdquo;, dated {asOf}. Nothing is sent to anybody.
          </p>
        )}
      </div>

      {/* An opening balance says what is owed. It says nothing about how long
          it has been owed, so nobody is put onto the collections ladder by it:
          that ladder runs off the calendar from the switch date, which is what
          makes it defensible at a hearing. */}
      <p className="mt-4 max-w-2xl text-footnote leading-relaxed text-fg-subtle">
        Saving a balance does not make any home past due. Days past due are counted from
        the date above, so nobody starts out behind.
      </p>

      <p className="mt-8 text-footnote text-fg-subtle">
        <Link href="/board/homeowners" className="text-brand hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          Back to Homeowners
        </Link>
      </p>
    </>
  );
}
