"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Scale } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { money, pluralize } from "@/lib/utils";

/** Reads a typed amount into cents, tolerating "1,240.50" and "$1240". */
function toCents(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, "");
  if (!clean) return 0;
  if (!/^-?\d*\.?\d{0,2}$/.test(clean)) return null;
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
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

  const [asOf, setAsOf] = useState(community.asOf);
  const [entered, setEntered] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      community.owners.map((o) => [o.id, o.balanceCents ? (o.balanceCents / 100).toFixed(2) : ""]),
    ),
  );
  const [saved, setSaved] = useState(false);

  const parsed = owners.map((owner) => ({
    owner,
    raw: entered[owner.id] ?? "",
    cents: toCents(entered[owner.id] ?? ""),
  }));
  const bad = parsed.filter((row) => row.cents === null);
  const owing = parsed.filter((row) => (row.cents ?? 0) > 0);
  const totalCents = parsed.reduce((sum, row) => sum + (row.cents ?? 0), 0);

  function save() {
    if (bad.length > 0) return;
    setOpeningBalances(
      asOf,
      parsed.map((row) => ({ ownerId: row.owner.id, amountCents: row.cents ?? 0 })),
    );
    setSaved(true);
    notify(
      `Opening balances set for ${pluralize(owners.length, "home")}. Statements show them as of ${asOf}.`,
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
            description="Add the homes first. A balance needs somewhere to sit."
            action={
              <Link
                href="/board/homeowners"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-medium text-brand-fg transition-opacity hover:opacity-90"
              >
                Go to the roster
              </Link>
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
        description="What each home owed on the day you switched. One figure each, and you are correct from there."
      />

      <Callout tone="info" icon={<Scale className="size-4" />} title="Nothing before this date moves">
        History stays where it is. Copying years of somebody else&apos;s ledger is how a
        switch stalls, and the copy is never quite right. What matters is that the balance is right
        on the day you start billing from here.
      </Callout>

      <Card className="mt-5">
        <CardHeader
          title="As of"
          subtitle="The day you switched. Every balance below is dated to it on the owner's statement."
          action={
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              aria-label="Balances as of"
              className="h-9 rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
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
              : "Leave a home blank or at zero if it owed nothing."
          }
        />
        <div className="divide-y divide-border">
          {parsed.map(({ owner, raw, cents }) => (
            <div key={owner.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-20 shrink-0 truncate text-[13px] font-medium text-fg-subtle">
                {owner.unit}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] text-fg">
                {owner.displayName}
              </span>
              <label className="relative w-36 shrink-0">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-fg-subtle">
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
                  className={`tnum h-9 w-full rounded-lg border bg-surface pl-6 pr-3 text-right text-[15px] text-fg outline-none focus:border-brand ${
                    cents === null ? "border-danger" : "border-border-2"
                  }`}
                />
              </label>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={bad.length > 0}>
          <Check className="size-4" />
          {saved ? "Saved" : `Set ${pluralize(owners.length, "balance")}`}
        </Button>
        {bad.length > 0 ? (
          <p className="text-[13px] text-danger">
            {pluralize(bad.length, "amount")} could not be read. Use figures only, like 1240.50.
          </p>
        ) : (
          <p className="text-[13px] text-fg-subtle">
            Each one appears on that owner&apos;s statement as &ldquo;Balance brought
            forward&rdquo;, dated {asOf}. Nothing is sent to anybody.
          </p>
        )}
      </div>

      {/* An opening balance says what is owed. It says nothing about how long
          it has been owed, so nobody is put onto the collections ladder by it:
          that ladder runs off the calendar from the switch date, which is what
          makes it defensible at a hearing. */}
      <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-fg-subtle">
        Setting a balance does not put anybody into collections. How far past due a
        household is comes from your own records, and the ladder here starts counting from
        the date above rather than backdating somebody on their first day.
      </p>

      <p className="mt-8 text-[13px] text-fg-subtle">
        <Link href="/board/homeowners" className="text-brand hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          Back to the roster
        </Link>
      </p>
    </>
  );
}
