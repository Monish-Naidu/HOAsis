"use client";

import { ChevronDown, ChevronRight, Download, Info, Landmark, Receipt } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Callout, SectionTitle } from "@/components/ui/primitives";

import { useAppState, useCurrentOwner, useOwnerCharges } from "@/lib/app-state";
import { MyHomeCard } from "@/components/app/my-home-card";
import { ContactCard } from "@/components/app/contact-card";
import { formatDate, money, today } from "@/lib/utils";

export default function ResidentAccount() {
  const { community } = useAppState();
  const association = community.association;
  const currentOwner = useCurrentOwner();
  const ownerCharges = useOwnerCharges();
  if (!currentOwner) return null;
  const totalFees = ownerCharges.reduce((t, c) => t + (c.feeCents ?? 0), 0);
  // The year the ledger is actually in, not a constant.
  const paidYear = ownerCharges[0]?.date.slice(0, 4) ?? String(today().getUTCFullYear());
  const paidThisYear = ownerCharges
    .filter((c) => c.kind === "payment")
    .reduce((t, c) => t + Math.abs(c.amountCents), 0);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">Account</h1>
        <p className="mt-1 text-[15px] text-fg-muted">
          Unit {currentOwner.unit} · {currentOwner.displayName}
        </p>
      </div>

      <MyHomeCard detailsLink={false} />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-fg-muted">
            Balance
          </p>
          <p className="tnum mt-1.5 text-[24px] font-semibold leading-none text-fg">
            {money(currentOwner.balanceCents)}
          </p>
          <Badge
            tone={
              currentOwner.standing === "current"
                ? "ok"
                : currentOwner.standing === "collections"
                  ? "danger"
                  : "warn"
            }
            className="mt-2"
          >
            {currentOwner.standing === "current"
              ? "In good standing"
              : currentOwner.standing === "grace"
                ? `In grace, ${currentOwner.daysPastDue} days`
                : currentOwner.standing === "late"
                  ? `Late, ${currentOwner.daysPastDue} days`
                  : "In collections"}
          </Badge>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-fg-muted">
            Paid in {paidYear}
          </p>
          <p className="tnum mt-1.5 text-[24px] font-semibold leading-none text-fg">
            {money(paidThisYear, { cents: false })}
          </p>
          <p className="mt-2 text-[13px] text-fg-muted">
            {money(association.duesCents, { cents: false })}/mo assessment
          </p>
        </Card>
      </div>

      <Callout tone="info" icon={<Info className="size-4" />} title="Tap a payment to see what it paid off" />

      <section>
        <SectionTitle
          action={
            <button className="inline-flex items-center gap-1 text-[13px] font-medium text-accent">
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
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      isPayment ? "bg-ok-soft text-ok" : "bg-surface-3 text-fg-muted"
                    }`}
                  >
                    <Receipt className="size-3.5" />
                  </span>
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
                      bal {money(line.balanceAfterCents)}
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
                  {line.feeCents ? (
                    <p className="mt-2.5 border-t border-border pt-2 text-[13px] text-fg-subtle">
                      Processing cost {money(line.feeCents)}, paid by the association.
                    </p>
                  ) : null}
                </div>
              </details>
            );
          })}
        </Card>
      </section>

      <ContactCard />

      <Link
        href="/resident/finances"
        className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card transition-colors hover:bg-surface-2"
      >
        <Landmark className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1 text-[15px] font-medium text-fg">Association funds</span>
        <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
      </Link>

      <p className="text-[13px] leading-relaxed text-fg-subtle">
        {money(totalFees)} in processing costs absorbed by the association this year.
      </p>
    </div>
  );
}
