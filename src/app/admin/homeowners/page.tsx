"use client";

import {
  Building2,
  Download,
  Link2 as LinkIcon,
  Lock,
  Mail,
  Repeat,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Meter,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { useMemo, useState } from "react";
import { communitySlug, delinquency } from "@/lib/metrics";
import { useAppState } from "@/lib/app-state";
import { inviteUrl } from "@/lib/invitations";
import { useToast } from "@/components/app/toast";
import { TemplateComposer } from "@/components/app/template-composer";
import { downloadCsv, toCsv } from "@/lib/core/export";
import { money, pluralize } from "@/lib/utils";
import type { Owner } from "@/lib/types";

const standingMeta: Record<Owner["standing"], { tone: "ok" | "warn" | "danger"; label: string }> = {
  current: { tone: "ok", label: "Current" },
  grace: { tone: "warn", label: "In grace" },
  late: { tone: "warn", label: "Late" },
  collections: { tone: "danger", label: "Collections" },
};

export default function BoardHomeowners() {
  const { community, addOwner, removeOwner, can } = useAppState();
  const association = community.association;
  const owners = community.owners;
  const delinq = delinquency(community);
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState({ name: "", email: "", unit: "" });

  const maySeeRoster = can("finances") || can("communications");

  function saveOwner() {
    try {
      const owner = addOwner(entry);
      setEntry({ name: "", email: "", unit: "" });
      setAdding(false);
      const undo = () => removeOwner(owner.id)();
      notify(`Added ${owner.displayName}, unit ${owner.unit}`, "ok", {
        label: "Undo",
        onClick: undo,
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add that household", "warn");
    }
  }

  function copyInvite(owner: Owner) {
    const url = inviteUrl(community.id, owner.id, window.location.origin);
    navigator.clipboard
      .writeText(url)
      .then(() => notify(`Invitation link for ${owner.displayName} copied`, "ok"))
      .catch(() => notify("Could not copy. Select the link and copy it manually.", "warn"));
  }
  // Anything needing attention first, then the board, then the rest by unit.
  const sorted = [...owners].sort((a, b) => {
    if (a.daysPastDue !== b.daysPastDue) return b.daysPastDue - a.daysPastDue;
    if (Boolean(a.boardRole) !== Boolean(b.boardRole)) return a.boardRole ? -1 : 1;
    return Number(a.unit) - Number(b.unit);
  });
  const PAGE = 25;
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (o) =>
        o.displayName.toLowerCase().includes(needle) ||
        o.unit === needle ||
        o.email.toLowerCase().includes(needle),
    );
  }, [sorted, query]);
  const visible = matching.slice(0, PAGE);

  function exportRoster() {
    const csv = toCsv(matching, [
      { header: "Unit", value: (o) => o.unit },
      { header: "Household", value: (o) => o.displayName },
      { header: "Email", value: (o) => o.email },
      { header: "Phone", value: (o) => o.phone },
      { header: "Balance", value: (o) => (o.balanceCents / 100).toFixed(2) },
      { header: "Days past due", value: (o) => o.daysPastDue },
      { header: "Standing", value: (o) => o.standing },
      { header: "Autopay", value: (o) => (o.autopay ? "yes" : "no") },
    ]);
    downloadCsv(`${communitySlug(community)}-roster.csv`, csv);
    notify(`Exported ${matching.length} households`);
  }

  const buckets = [
    { label: "1–30 days", owners: delinq.past.filter((o) => o.daysPastDue <= 30) },
    {
      label: "31–60 days",
      owners: delinq.past.filter((o) => o.daysPastDue > 30 && o.daysPastDue <= 60),
    },
    {
      label: "61–90 days",
      owners: delinq.past.filter((o) => o.daysPastDue > 60 && o.daysPastDue <= 90),
    },
    { label: "90+ days", owners: delinq.past.filter((o) => o.daysPastDue > 90) },
  ];

  if (!maySeeRoster) {

    return (

      <Callout

        tone="warn"

        icon={<Lock className="size-4" />}

        title="You cannot see the homeowner register"

      >

        It carries every household&apos;s balance and contact details, so it needs the money

        or communications capability. The President grants those.

      </Callout>

    );

  }


  return (
    <>
      <PageHeader
        eyebrow={`${association.unitCount} units · ${owners.length} households`}
        title="Homeowners"
        
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={exportRoster}>
              <Download className="size-3.5" />
              Export roster
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setComposing((v) => !v)}
            >
              <Mail className="size-3.5" />
              Message past due
            </Button>
            <Button variant="primary" size="md" onClick={() => setAdding((v) => !v)}>
              {adding ? "Cancel" : "Add household"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Collection rate"
          value={`${Math.round(delinq.collectionRate * 100)}%`}
          tone="ok"
          hint={`${owners.length - delinq.past.length} of ${owners.length} accounts current`}
        />
        <Stat
          label="Total past due"
          value={money(delinq.totalCents, { cents: false })}
          tone="warn"
          hint={pluralize(delinq.past.length, "account")}
        />
        <Stat
          label="On autopay"
          value={`${Math.round(delinq.autopayRate * 100)}%`}
          hint="Autopay accounts never get a reminder email"
          icon={<Repeat className="size-4" />}
        />
        <Stat
          label="In collections"
          value={String(delinq.byBucket.collections.length)}
          tone={delinq.byBucket.collections.length ? "danger" : "ok"}
          hint="Referred to counsel"
        />
      </div>

      {composing ? (
        <TemplateComposer recipients={delinq.past} onClose={() => setComposing(false)} />
      ) : null}

      {/* Aging */}
      <Card className="mt-5">
        <CardHeader title="Delinquency aging" />
        <div className="grid gap-5 px-5 py-4 sm:grid-cols-4">
          {buckets.map((b) => {
            const total = b.owners.reduce((t, o) => t + o.balanceCents, 0);
            const share = delinq.totalCents ? total / delinq.totalCents : 0;
            return (
              <div key={b.label}>
                <p className="text-[13px] font-semibold text-fg-muted">
                  {b.label}
                </p>
                <p className="tnum mt-1.5 text-[20px] font-semibold leading-none text-fg">
                  {money(total, { cents: false })}
                </p>
                <p className="mt-1 text-[13px] text-fg-muted">{pluralize(b.owners.length, "account")}</p>
                <Meter
                  className="mt-2"
                  value={share}
                  tone={b.label === "90+ days" ? "danger" : "warn"}
                  aria-label={`${b.label}: ${Math.round(share * 100)}% of past due balance`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Roster */}
      <Card className="mt-5">
        <CardHeader
          title="Roster"
          action={
            <div className="flex items-center gap-2">
              <div className="hidden h-8 items-center gap-2 rounded-lg border border-border px-2.5 sm:flex">
                <Search className="size-3.5 text-fg-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search owners or units"
                  aria-label="Search owners or units"
                  className="w-44 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => notify("Column chooser opens here", "info")}
              >
                <SlidersHorizontal className="size-3.5" />
                Columns
              </Button>
            </div>
          }
        />
        {adding ? (
          <div className="grid gap-3 border-b border-border px-5 py-4 sm:grid-cols-[1fr_1fr_6rem_auto]">
            <input
              value={entry.name}
              onChange={(e) => setEntry({ ...entry, name: e.target.value })}
              placeholder="Household name"
              aria-label="Household name"
              onKeyDown={(e) => e.key === "Enter" && saveOwner()}
              className={rosterInput}
            />
            <input
              type="email"
              value={entry.email}
              onChange={(e) => setEntry({ ...entry, email: e.target.value })}
              placeholder="Email"
              aria-label="Household email"
              onKeyDown={(e) => e.key === "Enter" && saveOwner()}
              className={rosterInput}
            />
            <input
              value={entry.unit}
              onChange={(e) => setEntry({ ...entry, unit: e.target.value })}
              placeholder="Unit"
              aria-label="Unit"
              onKeyDown={(e) => e.key === "Enter" && saveOwner()}
              className={rosterInput}
            />
            <Button
              variant="primary"
              size="md"
              onClick={saveOwner}
              disabled={!entry.name.trim() || !entry.unit.trim()}
            >
              Save
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                <th className="px-5 py-2.5 font-semibold">Household</th>
                <th className="px-3 py-2.5 font-semibold">Unit</th>
                <th className="px-3 py-2.5 font-semibold">Contact</th>
                <th className="px-3 py-2.5 text-right font-semibold">Balance</th>
                <th className="px-3 py-2.5 text-right font-semibold">Days late</th>
                <th className="px-3 py-2.5 font-semibold">Standing</th>
                <th className="px-5 py-2.5 text-right font-semibold">Invite</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const meta = standingMeta[o.standing];
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border text-[15px] transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {o.isCorporateOwner ? (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-fg-muted">
                            <Building2 className="size-3.5" />
                          </span>
                        ) : (
                          <Avatar name={o.members[0]} />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-fg">{o.displayName}</span>
                            {o.boardRole ? <Badge tone="brand">{o.boardRole}</Badge> : null}
                            {o.autopay ? (
                              <span title="On autopay">
                                <Repeat className="size-3 text-ok" />
                              </span>
                            ) : null}
                          </div>
                          {o.members.length > 1 ? (
                            <span className="text-[13px] text-fg-subtle">
                              {o.members.join(" · ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="tnum px-3 py-3 text-fg-muted">{o.unit}</td>
                    <td className="px-3 py-3">
                      <p className="truncate text-[13px] text-fg-muted">{o.email}</p>
                      <p className="tnum text-[13px] text-fg-subtle">{o.phone}</p>
                    </td>
                    <td
                      className={`tnum px-3 py-3 text-right font-semibold ${
                        o.balanceCents > 0 ? "text-fg" : "text-fg-subtle"
                      }`}
                    >
                      {money(o.balanceCents)}
                    </td>
                    <td className="tnum px-3 py-3 text-right text-fg-muted">
                      {o.daysPastDue}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => copyInvite(o)}
                          aria-label={`Copy the invitation link for ${o.displayName}`}
                          title="Copy invitation link"
                          className="rounded-md border border-border-2 px-2 py-1 text-[13px] font-medium text-fg hover:bg-surface-2"
                        >
                          <LinkIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const undo = removeOwner(o.id);
                            notify(`Removed ${o.displayName}`, "warn", {
                              label: "Undo",
                              onClick: undo,
                            });
                          }}
                          aria-label={`Remove ${o.displayName} from the roster`}
                          className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-danger"
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          
          <p className="tnum text-[13px] text-fg-muted">
            Showing {visible.length} of {matching.length}
          </p>
        </div>
      </Card>
    </>
  );
}

const rosterInput =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-brand";
