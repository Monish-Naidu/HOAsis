"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Landmark,
  Plus,
  ShieldAlert,
  Timer,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { useState } from "react";
import { useAppState, usePendingApprovals, useVendorGaps } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { daysFromToday, formatDate, money, relativeDays } from "@/lib/utils";

const payoutTone = {
  paid: "ok",
  "in-transit": "warn",
  scheduled: "info",
  "needs-approval": "warn",
} as const;

export default function BoardVendors() {
  const gaps = useVendorGaps();
  const awaiting = usePendingApprovals();
  const { vendors, payouts, markW9Requested, approvePayout, addVendor, removeVendor } =
    useAppState();
  const { notify } = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    service: "",
    achEnabled: true,
    w9OnFile: false,
  });

  function saveVendor() {
    if (!draft.name.trim()) return;
    addVendor({
      id: `v-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: draft.name.trim(),
      service: draft.service.trim() || "Services",
      achEnabled: draft.achEnabled,
      w9OnFile: draft.w9OnFile,
      ytdPaidCents: 0,
      defaultCategory: "Repairs & maintenance",
    });
    notify(
      draft.w9OnFile ? `Added ${draft.name}` : `Added ${draft.name}. W-9 requested by email.`,
    );
    setDraft({ name: "", service: "", achEnabled: true, w9OnFile: false });
    setAdding(false);
  }
  // Undefined rather than zero when there are no vendors, so a board with none
  // is not told that 0% of them are on ACH.

  return (
    <>
      <PageHeader
        title="Vendors"
        
        action={
          <Button variant="primary" size="md" onClick={() => setAdding((v) => !v)}>
            {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {adding ? "Cancel" : "Add vendor"}
          </Button>
        }
      />

      {/* Four counts sat here and two were trivia. "Bank payment lands in 1.8
          days" is a backward looking average of payments already made, which
          tells a board nothing they can act on, and the signature card claimed
          "two signatures required over $1,000", a policy this association had
          never set anywhere. Stating a rule nobody chose is worse than saying
          nothing. What is left is the three things that are somebody's job. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Waiting on you"
          value={String(awaiting.length)}
          tone={awaiting.length ? "warn" : "ok"}
          hint={
            awaiting.length
              ? "Payments a board member has to approve before they go"
              : "Nothing needs approving"
          }
          icon={<Timer className="size-4" />}
        />
        <Stat
          label="Missing a W-9"
          value={String(gaps.missingW9.length)}
          tone={gaps.missingW9.length ? "danger" : "ok"}
          hint={
            gaps.missingW9.length
              ? "Pay one more than $600 in a year and the IRS wants a 1099 in January"
              : "Every vendor has one on file"
          }
          icon={<FileWarning className="size-4" />}
        />
        <Stat
          label="Insurance expiring"
          value={String(gaps.expiringCoi.length)}
          tone={gaps.expiringCoi.length ? "warn" : "ok"}
          hint={
            gaps.expiringCoi.length
              ? "Within 60 days. An uninsured vendor on your property is your problem"
              : "No certificate lapses in the next 60 days"
          }
          icon={<Landmark className="size-4" />}
        />
      </div>

      {gaps.missingW9.length ? (
        <Callout
          tone="danger"
          className="mt-5"
          icon={<ShieldAlert className="size-4" />}
          title={`${gaps.missingW9[0].name} has no W-9 on file`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                markW9Requested(gaps.missingW9[0].id);
                notify(`W-9 requested from ${gaps.missingW9[0].name}`);
              }}
            >
              Request W-9
            </Button>
          }
        >
          Paid {money(gaps.missingW9[0].ytdPaidCents)} year to date, past the $600 threshold for a
          1099-NEC. Without the W-9 the January filing will be wrong.
        </Callout>
      ) : null}

      {adding ? (
        <Card className="mt-5">
          <CardHeader
            title="New vendor"
            subtitle="Over $600 a year, the IRS needs a W-9 from them in January"
          />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-fg-muted">
                Name
              </span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Cascade Grounds Co."
                className="h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-fg-muted">
                Service
              </span>
              <input
                value={draft.service}
                onChange={(e) => setDraft({ ...draft, service: e.target.value })}
                placeholder="Grounds and irrigation"
                className="h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3">
            <label className="flex items-center gap-2 text-[15px] text-fg">
              <input
                type="checkbox"
                checked={draft.achEnabled}
                onChange={(e) => setDraft({ ...draft, achEnabled: e.target.checked })}
                className="size-4 accent-navy-700"
              />
              Pays by ACH
            </label>
            <label className="flex items-center gap-2 text-[15px] text-fg">
              <input
                type="checkbox"
                checked={draft.w9OnFile}
                onChange={(e) => setDraft({ ...draft, w9OnFile: e.target.checked })}
                className="size-4 accent-navy-700"
              />
              W-9 already on file
            </label>
            <Button
              variant="primary"
              size="sm"
              className="ml-auto"
              disabled={!draft.name.trim()}
              onClick={saveVendor}
            >
              Save vendor
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Vendor list"
            
            icon={<Truck className="size-4" />}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                  <th className="px-5 py-2.5 font-semibold">Vendor</th>
                  <th className="px-3 py-2.5 font-semibold">Rail</th>
                  <th className="px-3 py-2.5 font-semibold">Docs</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Paid YTD</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const coiDays = v.coiExpires ? daysFromToday(v.coiExpires) : null;
                  const coiSoon = coiDays !== null && coiDays < 60;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-border text-[15px] transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-fg">{v.name}</p>
                        <p className="text-[13px] text-fg-muted">{v.service}</p>
                      </td>
                      <td className="px-3 py-3">
                        {v.achEnabled ? (
                          <Badge tone="ok">ACH</Badge>
                        ) : (
                          <Badge tone="warn">Check</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {v.w9OnFile ? (
                            <Badge tone="neutral">W-9</Badge>
                          ) : (
                            <Badge tone="danger">
                              <AlertTriangle className="size-2.5" />
                              No W-9
                            </Badge>
                          )}
                          {v.coiExpires ? (
                            <Badge tone={coiSoon ? "warn" : "neutral"}>
                              COI {coiSoon ? relativeDays(v.coiExpires) : formatDate(v.coiExpires)}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center justify-end gap-2">
                          <span className="tnum font-semibold text-fg">
                            {money(v.ytdPaidCents, { cents: false })}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${v.name}`}
                            onClick={() => {
                              const undo = removeVendor(v.id);
                              notify(`Removed ${v.name}`, "warn", {
                                label: "Undo",
                                onClick: undo,
                              });
                            }}
                            className="flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent payouts" />
          {payouts.map((p) => (
            <div key={p.id} className="border-b border-border px-5 py-3.5 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-fg">{p.vendor}</p>
                  <p className="text-[13px] text-fg-muted">{p.invoiceNumber}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[15px] font-semibold text-fg">
                    {money(p.amountCents, { cents: false })}
                  </p>
                  <Badge tone={payoutTone[p.status]} className="mt-0.5">
                    {p.status.replace("-", " ")}
                  </Badge>
                </div>
              </div>
              {p.approvals.length < p.approvalsRequired ? (
                <button
                  type="button"
                  onClick={() => {
                    approvePayout(p.id);
                    notify(`Approved ${p.vendor}`);
                  }}
                  className="mt-2 h-7 rounded-md bg-brand px-2.5 text-[13px] font-medium text-brand-fg"
                >
                  Add my approval
                </button>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-subtle">
                <span className="font-medium uppercase">{p.method}</span>
                <span>
                  {p.status === "paid" ? "landed" : "lands"} {relativeDays(p.expectedDate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  {p.approvals.length >= p.approvalsRequired ? (
                    <CheckCircle2 className="size-3 text-ok" />
                  ) : (
                    <AlertTriangle className="size-3 text-warn" />
                  )}
                  {p.approvals.length}/{p.approvalsRequired} approvals
                </span>
              </div>
              {p.method === "check" ? (
                <p className="mt-2 rounded-md bg-warn-soft px-2 py-1 text-[13px] leading-snug text-warn">
                  Check rail, {daysFromToday(p.expectedDate) - daysFromToday(p.issuedDate)} days in
                  transit. Ask this vendor to enable ACH.
                </p>
              ) : null}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
