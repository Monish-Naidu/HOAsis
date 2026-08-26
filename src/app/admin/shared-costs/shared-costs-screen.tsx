"use client";

import { useState } from "react";
import {
  Droplets,
  Download,
  Flame,
  HandCoins,
  Plug,
  Plus,
  Trash2,
  Waves,
  Wifi,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Meter,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { MoneyTabs } from "@/components/app/money-tabs";
import { useAppState } from "@/lib/app-state";
import { assessmentProgress, communitySlug, sharedCostSummary } from "@/lib/metrics";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { useToast } from "@/components/app/toast";
import { formatDate, money, shortMoney, todayIsoDate } from "@/lib/utils";
import type {
  AllocationMethod,
  SharedCost,
  SharedCostBill,
  SharedCostKind,
} from "@/lib/types";
import { CostTrend } from "./cost-trend";

const ICON: Record<SharedCostKind, typeof Droplets> = {
  water: Droplets,
  sewer: Waves,
  trash: Trash2,
  gas: Flame,
  electric: Plug,
  internet: Wifi,
  other: HandCoins,
};

/** Plain English for how a bill is split. Owners read these words, not the enum. */
const ALLOCATION_LABEL: Record<AllocationMethod, string> = {
  equal: "Split evenly",
  square_feet: "By floor area",
  bedrooms: "By bedrooms",
  occupants: "By people living there",
  submeter: "By meter reading",
};

/** What each split needs from the board, said in the words they would use. */
const ALLOCATION_HELP: Record<AllocationMethod, string> = {
  equal: "Every home pays the same. Right for one cart per home, or a street light.",
  square_feet: "Larger homes pay more. Needs floor area on the roster.",
  bedrooms: "A rough stand-in for occupancy. Needs bedroom counts on the roster.",
  occupants: "Fairest for water. Needs how many people live in each home.",
  submeter: "Each home pays for what its meter read. Needs a reading every period.",
};

const KIND_LABEL: Record<SharedCostKind, string> = {
  water: "Water",
  sewer: "Sewer",
  trash: "Trash",
  gas: "Gas",
  electric: "Electric",
  internet: "Internet",
  other: "Something else",
};

export function SharedCostsScreen() {
  const { community, addSharedCost, removeSharedCost, postSharedCostBill } = useAppState();
  const { notify } = useToast();
  const shared = sharedCostSummary(community);
  const assessments = assessmentProgress(community);
  const [open, setOpen] = useState<string | null>(shared.rows[0]?.cost.id ?? null);
  const [adding, setAdding] = useState(false);
  const [billFor, setBillFor] = useState<string | null>(null);

  // An association that bills one flat due sees this and nothing else. The
  // screen exists so the layer can be turned on, not so it can be nagged about.
  if (!shared.enabled && !assessments.enabled && !adding) {
    return (
      <>
        <MoneyTabs />
        <PageHeader
          eyebrow="Shared costs"
          title="Bills the association passes on"
          description="Most associations bill one flat amount and never need this. Turn it on if the association pays a bill on everyone's behalf, like a shared water meter or one trash contract."
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add a shared cost
            </Button>
          }
        />
        <Card>
          <EmptyState
            icon={<Droplets className="size-6" />}
            title="Nothing shared yet"
            description="Add a provider and the amount each home owes is worked out for you, added to their statement, and shown to them alongside what the community paid."
          />
        </Card>
      </>
    );
  }

  function exportTrend() {
    const rows = community.sharedCostBills
      .slice()
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const nameOf = (id: string) => community.sharedCosts.find((c) => c.id === id);
    const csv = toCsv(rows, [
      { header: "Period", value: (b) => b.periodStart },
      { header: "Cost", value: (b) => nameOf(b.sharedCostId)?.name ?? "" },
      { header: "Provider", value: (b) => nameOf(b.sharedCostId)?.provider ?? "" },
      { header: "Community total", value: (b) => (b.totalCents / 100).toFixed(2) },
      { header: "Homes", value: (b) => b.homes },
      { header: "Per home", value: (b) => (b.averageShareCents / 100).toFixed(2) },
      { header: "Usage", value: (b) => b.usageAmount ?? "" },
      { header: "Unit", value: (b) => nameOf(b.sharedCostId)?.usageUnit ?? "" },
    ]);
    downloadCsv(`${communitySlug(community)}-shared-costs.csv`, csv);
    notify("Downloaded every bill, ready for the budget");
  }

  return (
    <>
      <PageHeader
        eyebrow="Shared costs"
        title="Bills the association passes on"
        description="What the community actually pays each provider, how it is split, and what that works out to per home. Owners see the same figures."
        action={
          <div className="flex gap-2">
            {shared.enabled ? (
              <Button variant="secondary" size="sm" onClick={exportTrend}>
                <Download className="size-4" />
                Export
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        }
      />

      {shared.enabled ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="This month, all providers"
            value={money(shared.monthlyCents)}
            hint={`${money(shared.perHomeMonthlyCents)} a home`}
          />
          <Stat
            label="Last twelve months"
            value={shortMoney(shared.trailingYearCents)}
            hint="What the community paid, before dues"
          />
          <Stat
            label="Per home, per year"
            value={money(shared.rows.reduce((t, r) => t + r.perHomeYearCents, 0))}
            hint="The number an owner asks for at the annual meeting"
          />
        </div>
      ) : null}

      {adding ? (
        <AddSharedCost
          onCancel={() => setAdding(false)}
          onSave={(cost) => {
            addSharedCost(cost);
            setAdding(false);
            setOpen(cost.id);
            notify(`${cost.name} added. Post a bill and every home gets its share.`);
          }}
        />
      ) : null}

      {shared.enabled ? (
        <div className="mt-5 space-y-4">
          {shared.rows.map((row) => {
            const Icon = ICON[row.cost.kind];
            const expanded = open === row.cost.id;
            const change = row.changeYearOverYear;
            return (
              <Card key={row.cost.id}>
                <CardHeader
                  icon={<Icon className="size-4" />}
                  title={row.cost.name}
                  subtitle={
                    <>
                      {row.cost.provider}
                      {row.cost.accountRef ? ` · ${row.cost.accountRef}` : ""}
                      {" · "}
                      {ALLOCATION_LABEL[row.cost.allocation]}
                    </>
                  }
                  action={
                    <div className="flex items-center gap-2">
                      {change === undefined ? null : (
                        <Badge tone={change > 0.1 ? "warn" : change > 0 ? "neutral" : "ok"}>
                          {change >= 0 ? "+" : ""}
                          {Math.round(change * 100)}% on last year
                        </Badge>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setBillFor(billFor === row.cost.id ? null : row.cost.id)}
                      >
                        <Plus className="size-4" />
                        Post a bill
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen(expanded ? null : row.cost.id)}
                      >
                        {expanded ? "Hide" : "History"}
                      </Button>
                      <button
                        type="button"
                        aria-label={`Stop passing on ${row.cost.name}`}
                        onClick={() => {
                          removeSharedCost(row.cost.id);
                          notify(`${row.cost.name} is no longer passed on`, "warn");
                        }}
                        className="flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  }
                />
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[13px] font-semibold text-fg-muted">Latest bill</p>
                    <p className="tnum mt-1 text-[20px] font-semibold text-fg">
                      {money(row.latest?.totalCents ?? 0)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      {row.latest ? formatDate(row.latest.periodStart, "medium") : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-fg-muted">Each home</p>
                    <p className="tnum mt-1 text-[20px] font-semibold text-fg">
                      {money(row.latest?.averageShareCents ?? 0)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      Across {row.latest?.homes ?? 0} homes
                    </p>
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-fg-muted">Last twelve months</p>
                    <p className="tnum mt-1 text-[20px] font-semibold text-fg">
                      {shortMoney(row.trailingYearCents)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                      {money(row.perHomeYearCents)} a home
                    </p>
                  </div>
                </div>

                {billFor === row.cost.id ? (
                  <PostBill
                    costName={row.cost.name}
                    homes={row.latest?.homes ?? community.owners.length}
                    unit={row.cost.usageUnit}
                    onCancel={() => setBillFor(null)}
                    onSave={(bill) => {
                      postSharedCostBill({ ...bill, sharedCostId: row.cost.id });
                      setBillFor(null);
                      notify(
                        `Posted. Every home's share is on their next statement.`,
                      );
                    }}
                  />
                ) : null}

                {/* Collapsed by default. The summary answers the common
                    question; the history answers the argument. */}
                {expanded ? (
                  <div className="border-t border-border px-5 py-4">
                    <CostTrend
                      bills={row.bills}
                      peakCents={row.bills.reduce((m, b) => Math.max(m, b.totalCents), 0)}
                      label={row.cost.name}
                    />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      {assessments.enabled ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">
            Special assessments
          </h2>
          {assessments.rows.map((row) => (
            <Card key={row.assessment.id}>
              <CardHeader
                icon={<HandCoins className="size-4" />}
                title={row.assessment.title}
                subtitle={`${ALLOCATION_LABEL[row.assessment.allocation]} · ${
                  row.assessment.installments
                } payments from ${formatDate(row.assessment.firstDueOn, "medium")}`}
                action={
                  <Badge tone={row.assessment.status === "complete" ? "ok" : "neutral"}>
                    {row.assessment.status === "complete" ? "Paid off" : "In progress"}
                  </Badge>
                }
              />
              <div className="px-5 py-4">
                <p className="text-[15px] leading-relaxed text-fg-muted">
                  {row.assessment.reason}
                </p>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <p className="tnum text-[20px] font-semibold text-fg">
                    {shortMoney(row.collectedCents)}{" "}
                    <span className="text-[15px] font-normal text-fg-muted">
                      of {shortMoney(row.assessment.totalCents)}
                    </span>
                  </p>
                  <p className="tnum text-[13px] text-fg-muted">
                    {row.installmentsLeft} payments left
                  </p>
                </div>
                <Meter
                  value={row.percent}
                  tone="brand"
                  className="mt-2"
                  aria-label={`${Math.round(row.percent * 100)}% collected`}
                />
                <p className="mt-2 text-[13px] text-fg-muted">
                  About {money(row.perHomeRemainingCents)} a home still to come. A buyer&apos;s
                  lender asks for this figure by name.
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Turning the layer on.
 *
 * Four questions, because that is all it takes: what it is called, who the
 * association pays, what kind of thing it is, and how it gets divided. The
 * division is the only one that needs explaining, so it is the only one with
 * help text under it.
 */
function AddSharedCost({
  onSave,
  onCancel,
}: {
  onSave: (cost: SharedCost) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [kind, setKind] = useState<SharedCostKind>("water");
  const [allocation, setAllocation] = useState<AllocationMethod>("equal");
  const [markup, setMarkup] = useState("0");

  const field =
    "mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none transition-colors focus:border-brand";

  return (
    <Card className="mt-5">
      <CardHeader
        icon={<Plus className="size-4" />}
        title="Add a shared cost"
        subtitle="A bill the association receives and passes on to homes"
        action={
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">
              What owners will see on their statement
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Water and sewer"
              className={field}
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SharedCostKind)}
              className={field}
            >
              {(Object.keys(KIND_LABEL) as SharedCostKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">
              Who the association pays
            </span>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Cascade Water District"
              className={field}
            />
            <span className="mt-1.5 block text-[13px] text-fg-muted">
              Shown to owners. It is the question they ask most and the one no other
              product answers.
            </span>
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-fg-muted">
              Account number, if you have it
            </span>
            <input
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              placeholder="CWD-88-4471"
              className={field}
            />
          </label>
        </div>

        <div>
          <span className="text-[13px] font-semibold text-fg-muted">How it is divided</span>
          <div className="mt-1.5 space-y-1.5">
            {(Object.keys(ALLOCATION_HELP) as AllocationMethod[]).map((method) => (
              <label
                key={method}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  allocation === method
                    ? "border-brand bg-brand-soft"
                    : "border-border-2 hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name="allocation"
                  checked={allocation === method}
                  onChange={() => setAllocation(method)}
                  className="mt-0.5 size-4"
                />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-fg">
                    {ALLOCATION_LABEL[method]}
                  </span>
                  <span className="block text-[13px] leading-snug text-fg-muted">
                    {ALLOCATION_HELP[method]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="block max-w-[16rem]">
          <span className="text-[13px] font-semibold text-fg-muted">
            Administration markup
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            className={field}
          />
          <span className="mt-1.5 block text-[13px] leading-snug text-fg-muted">
            A percentage on top, recorded separately rather than hidden in the rate.
            Several states cap or forbid it, so leave it at zero unless your documents
            allow it.
          </span>
        </label>

        <Button
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              id: `sc-${Date.now()}`,
              name: name.trim(),
              kind,
              provider: provider.trim(),
              accountRef: accountRef.trim(),
              allocation,
              markupPercent: Number(markup) || 0,
              active: true,
              usageUnit: "",
            })
          }
        >
          Add it
        </Button>
      </div>
    </Card>
  );
}

/**
 * Recording one provider bill.
 *
 * The split is shown before it is saved, because a board that cannot see what
 * each home will be charged will not trust the feature enough to use it twice.
 */
function PostBill({
  costName,
  homes,
  unit,
  onSave,
  onCancel,
}: {
  costName: string;
  homes: number;
  unit: string;
  onSave: (bill: Omit<SharedCostBill, "sharedCostId">) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(todayIsoDate().slice(0, 7));
  const [usage, setUsage] = useState("");

  const cents = Math.round((Number(amount) || 0) * 100);
  const perHome = homes > 0 ? Math.round(cents / homes) : 0;
  const field =
    "mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand";

  return (
    <div className="border-t border-border bg-surface-2 px-5 py-4">
      <p className="text-[15px] font-semibold text-fg">Post a {costName} bill</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Period</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">
            What the provider charged
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="486.00"
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">
            Usage {unit ? `(${unit})` : "(optional)"}
          </span>
          <input
            type="number"
            min="0"
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
            className={field}
          />
        </label>
      </div>

      {cents > 0 ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[15px] text-fg">
          {money(cents)} across {homes} homes is{" "}
          <span className="font-semibold">{money(perHome)}</span> each. Shares are worked
          out to the cent, so they add up to the bill exactly.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={cents <= 0}
          onClick={() => {
            const start = `${period}-01`;
            const end = new Date(Date.UTC(
              Number(period.slice(0, 4)),
              Number(period.slice(5, 7)),
              1,
            ))
              .toISOString()
              .slice(0, 10);
            onSave({
              id: `bill-${Date.now()}`,
              periodStart: start,
              periodEnd: end,
              dueOn: end,
              totalCents: cents,
              usageAmount: Number(usage) || undefined,
              homes,
              averageShareCents: perHome,
            });
          }}
        >
          Post it
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
