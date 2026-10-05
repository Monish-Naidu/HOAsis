"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { Button, ButtonLink, Callout, Card, Field, PageHeader, fieldClass } from "@/components/ui/primitives";
import { RosterPreview } from "@/components/app/roster-preview";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { importRoster, type ImportOutcome } from "@/lib/roster/apply";
import type { RosterRow } from "@/lib/roster/csv";
import { homeWording } from "@/lib/wording";
import { formatDate, money, pluralize } from "@/lib/utils";

/**
 * The roster, from the spreadsheet the board already keeps.
 *
 * Reached from Homeowners. The file is read and shown back with every
 * problem named; one press sends the good rows to `import_households`,
 * which creates homes and seats, fills in what an existing home was
 * missing, and writes each opening balance as one dated statement line.
 * Nothing is emailed from here: invitations go out from Homeowners once the
 * board has looked at the register.
 *
 * In a browser only copy the rows go through the same store the roster's
 * own form uses, so the plan and the register agree either way.
 */
export function ImportScreen() {
  const { community, can, isRemote, addOwner, setOpeningBalances, setHomeDues } = useAppState();
  const { notify } = useToast();
  const w = homeWording(community);
  const [asOf, setAsOf] = useState(community.asOf);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const mayImport = can("settings");
  const seesMoney = can("finances");
  const existingUnits = community.owners.map((o) => o.unit);

  if (!mayImport) {
    return (
      <>
        <PageHeader eyebrow="Homeowners" title="Import the roster" />
        <Callout tone="warn" icon={<Lock className="size-4" />} title="This needs the settings capability">
          Adding homes to the register is settings work. The President grants it.
        </Callout>
      </>
    );
  }

  async function confirm(rows: RosterRow[]) {
    setBusy(true);
    setFailure(null);
    try {
      if (isRemote) {
        const result = await importRoster(community.id, seesMoney ? rows : rows.map(withoutBalance), asOf);
        setOutcome(result);
      } else {
        // The browser copy: the same store the roster's own form writes to.
        let created = 0;
        const balances: { ownerId: string; amountCents: number }[] = [];
        const dues: { ownerId: string; cents: number }[] = [];
        for (const row of rows) {
          const known = community.owners.find((o) => o.unit.toLowerCase() === row.unit.toLowerCase());
          if (known) {
            if (row.openingBalanceCents !== undefined) balances.push({ ownerId: known.id, amountCents: row.openingBalanceCents });
            if (row.duesCents) dues.push({ ownerId: known.id, cents: row.duesCents });
            continue;
          }
          const owner = addOwner({ name: row.name, email: row.email, unit: row.unit });
          created++;
          if (row.openingBalanceCents !== undefined) balances.push({ ownerId: owner.id, amountCents: row.openingBalanceCents });
          if (row.duesCents) dues.push({ ownerId: owner.id, cents: row.duesCents });
        }
        if (balances.length) setOpeningBalances(asOf, balances);
        if (dues.length) setHomeDues(dues);
        setOutcome({
          created,
          updated: rows.length - created,
          balances: balances.filter((b) => b.amountCents !== 0).length,
          skipped: 0,
          ...(dues.length ? { dues: dues.length } : {}),
        });
      }
      notify(`Roster imported: ${pluralize(rows.length, w.home)}`, "ok");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not import the roster");
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    const withEmail = community.owners.filter((o) => o.email && !o.placeholder).length;
    return (
      <>
        <PageHeader eyebrow="Homeowners" title="Roster imported" />
        <Card className="p-6">
          <span className="flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
            <Check className="size-6" strokeWidth={3} />
          </span>
          <p className="mt-4 text-headline font-semibold tracking-[-0.015em] text-fg">
            {pluralize(outcome.created, `new ${w.home}`)} on the register
            {outcome.updated ? `, ${outcome.updated} filled in` : ""}
            {outcome.balances ? `, ${pluralize(outcome.balances, "opening balance")} as of ${formatDate(asOf, "long")}` : ""}
            {outcome.dues ? `, ${pluralize(outcome.dues, w.home)} on their own dues from the next bill` : ""}.
          </p>
          {outcome.duesError ? (
            <Callout tone="warn" className="mt-3" title="Some dues amounts were not saved">
              The homes are on the register. {outcome.duesError} Open each household and use Change
              dues. Until then they pay the usual amount.
            </Callout>
          ) : null}
          <p className="mt-2 max-w-[60ch] text-body leading-relaxed text-fg-muted">
            {withEmail
              ? `${pluralize(withEmail, "household")} can be invited now. Each gets a link that opens on their own ${w.home}; nobody has been emailed yet.`
              : `No household has an email yet. Add them on Homeowners and the invitations follow.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/board/homeowners" variant="primary" size="lg">
              Open Homeowners
              <ArrowRight className="size-4" />
            </ButtonLink>
            <Button variant="ghost" size="lg" onClick={() => setOutcome(null)}>
              Import another file
            </Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Homeowners"
        title="Import the roster"
        description={`Every ${w.home}, its owner, how to reach them${seesMoney ? ", and what they owe today" : ""}. From the spreadsheet you already keep.`}
        action={
          <Link
            href="/board/homeowners"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-body font-medium text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="size-3.5" />
            Homeowners
          </Link>
        }
      />

      <Card className="p-5">
        {seesMoney ? (
          <div className="mb-5 grid gap-4 sm:grid-cols-[14rem_1fr] sm:items-end">
            <Field
              label="Balances are true as of"
              hint="The day you read them off the old books. Dues due after this date are billed here; anything before it is inside the figure."
            >
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={fieldClass} />
            </Field>
            <p className="text-footnote leading-relaxed text-fg-muted">
              A balance column is optional. Leave it blank to keep what is already on a {w.home}; put 0 to clear it.
              Each figure lands on the owner&apos;s statement as one line, &ldquo;Balance brought forward&rdquo;, dated as above.
            </p>
          </div>
        ) : null}

        {failure ? (
          <Callout tone="danger" className="mb-4" title="Nothing was imported">
            {failure}
          </Callout>
        ) : null}

        <RosterPreview
          existingUnits={existingUnits}
          homeWord={w.home}
          confirmLabel="Import"
          onConfirm={confirm}
          busy={busy}
          showBalances={seesMoney}
          showDues={seesMoney}
        />
      </Card>

      <p className="mt-4 text-footnote text-fg-subtle">
        {community.owners.length ? `${pluralize(community.owners.length, w.home)} on the register now` : "The register is empty"}
        {seesMoney && community.owners.some((o) => o.balanceCents > 0)
          ? `, ${money(community.owners.reduce((t, o) => t + Math.max(0, o.balanceCents), 0))} owed`
          : ""}
        .
      </p>
    </>
  );
}

function withoutBalance(row: RosterRow): RosterRow {
  // Dues amounts are finance work as well, so they are left out with it.
  const { openingBalanceCents: _omit, duesCents: _dues, ...rest } = row;
  void _omit;
  void _dues;
  return rest;
}
