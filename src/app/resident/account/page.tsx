"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import { ChevronDown, ChevronRight, CircleDollarSign, Download, Landmark, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { Badge, Card, IconTile, SectionTitle, Stat, type Tone } from "@/components/ui/primitives";

import { useAppState, useCurrentOwner, useOwnerCharges } from "@/lib/app-state";
import { ContactCard } from "@/components/app/contact-card";
import { formatDate, money, today } from "@/lib/utils";
import { homeLabel } from "@/lib/wording";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { HOME_TYPE_LABEL, isMixed, ownerDues } from "@/lib/home-types";

export default function ResidentAccount() {
  const { community } = useAppState();
  const association = community.association;
  const currentOwner = useCurrentOwner();
  const ownerCharges = useOwnerCharges();
  if (!currentOwner) return null;
  // The year the ledger is actually in, not a constant.
  const paidYear = ownerCharges[0]?.date.slice(0, 4) ?? String(today().getUTCFullYear());
  // That year's payments only. Summing every line was right while a statement
  // held one year; with five it put the whole history under "Paid in".
  const paidThisYear = ownerCharges
    .filter((c) => c.kind === "payment" && c.date.startsWith(paidYear))
    .reduce((t, c) => t + Math.abs(c.amountCents), 0);

  // What the balance badge says. A balance that is owed but not yet late is
  // due, not paid up: a green "Paid up" under $285.00 was two answers.
  const standing: { tone: Tone; label: string } =
    currentOwner.standing === "collections"
      ? { tone: "danger", label: "In collections" }
      : currentOwner.daysPastDue > 0
        ? { tone: "warn", label: `${currentOwner.daysPastDue} days past due` }
        : currentOwner.balanceCents > 0
          ? { tone: "info", label: `Due ${formatDate(community.nextChargeDate)}` }
          : { tone: "ok", label: "Paid up" };

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle
        title="Account"
        subtitle={[
          homeLabel(community, currentOwner.unit),
          isMixed(community.profile) && currentOwner.homeType
            ? HOME_TYPE_LABEL[currentOwner.homeType].one
            : null,
          currentOwner.displayName,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2">
        <Stat
          label="Balance"
          value={money(currentOwner.balanceCents)}
          icon={<Wallet className="size-4" />}
          accent="teal"
          tone={standing.tone === "danger" ? "danger" : "neutral"}
          hint={<Badge tone={standing.tone}>{standing.label}</Badge>}
        />
        <Stat
          label={`Paid in ${paidYear}`}
          value={money(paidThisYear, { cents: false })}
          icon={<Receipt className="size-4" />}
          accent="violet"
          hint={`${money(ownerDues(association, currentOwner), { cents: false })} a ${
            association.duesCadence === "monthly"
              ? "month"
              : association.duesCadence === "quarterly"
                ? "quarter"
                : "year"
          } in dues`}
        />
      </div>

      <section>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() =>
                // The ledger as a spreadsheet, for a tax return or a lender.
                downloadCsv(
                  `dues-${currentOwner.unit}-${paidYear}.csv`,
                  toCsv(ownerCharges, [
                    { header: "Date", value: (c) => c.date },
                    { header: "Description", value: (c) => c.label },
                    { header: "Method", value: (c) => c.method ?? "" },
                    { header: "Amount", value: (c) => (c.amountCents / 100).toFixed(2) },
                    { header: "Balance", value: (c) => (c.balanceAfterCents / 100).toFixed(2) },
                  ]),
                )
              }
              className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
            >
              <Download className="size-3" />
              Statement
            </button>
          }
        >
          Activity
        </SectionTitle>
        <Card>
          {ownerCharges.map((line, i) => {
            const isPayment = line.kind === "payment";
            const body = (
              <>
                <div className="flex items-start gap-3">
                  <IconTile
                    icon={isPayment ? CircleDollarSign : Receipt}
                    tint={isPayment ? "teal" : "neutral"}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-fg">{line.label}</p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      {formatDate(line.date, "long")}
                      {line.method ? ` · ${line.method}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`tnum text-[15px] font-semibold ${
                        isPayment ? "text-ok" : "text-fg"
                      }`}
                    >
                      {isPayment ? "−" : ""}
                      {money(Math.abs(line.amountCents))}
                    </p>
                    <p className="tnum mt-0.5 text-[13px] text-fg-subtle">
                      Balance {money(line.balanceAfterCents)}
                    </p>
                  </div>
                  {line.appliedTo?.length ? (
                    <ChevronDown className="mt-1 size-3.5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
                  ) : null}
                </div>
              </>
            );

            if (!line.appliedTo?.length) {
              return (
                <div
                  key={line.id}
                  className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  {body}
                </div>
              );
            }

            return (
              <details
                key={line.id}
                className={`group ${i > 0 ? "border-t border-border" : ""}`}
              >
                <summary className="cursor-pointer list-none px-4 py-3 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  {body}
                </summary>
                <div className="border-t border-border bg-surface-2 px-4 py-3">
                  <p className="mb-2 text-[13px] font-semibold text-fg-muted">
                    Applied to
                  </p>
                  <ul className="space-y-1.5">
                    {line.appliedTo.map((a) => (
                      <li key={a.chargeId} className="flex justify-between text-[13px]">
                        <span className="text-fg-muted">{a.label}</span>
                        <span className="tnum font-medium text-fg">{money(a.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            );
          })}
        </Card>
      </section>

      <ContactCard />

      <Link
        href="/resident/finances"
        className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
      >
        <IconTile icon={Landmark} tint="teal" size="sm" />
        <span className="flex-1 text-[15px] font-medium text-fg">Association funds</span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>
    </div>
  );
}
