"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  Copy,
  FileText,
  Lock,
  Megaphone,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  PageHeader,
  Select,
  SettingRow,
  Toggle,
} from "@/components/ui/primitives";
import { DangerZone } from "@/components/app/danger-zone";
import { BillingRow } from "@/components/app/billing-row";
import { DuesSettings } from "@/components/app/dues-settings";
import { TestModeGuide } from "@/components/app/test-mode-guide";
import { useAppState } from "@/lib/app-state";
import { AmenityRules } from "@/components/app/amenity-rules";
import { useToast } from "@/components/app/toast";
import { CAPABILITY_LABEL, GRANTABLE } from "@/lib/data";
import {
  ROLE_LABEL,
  type AccountRole,
  type ArchitecturalForm,
  type CommunityAmenity,
} from "@/lib/types";
import { cn, formatDate, todayIsoDate } from "@/lib/utils";
import { homeLabel } from "@/lib/wording";
import { moduleOn } from "@/lib/modules";

export function SettingsScreen() {
  const {
    account,
    accounts,
    settings,
    updateSettings,
    amenities,
    setAmenities,
    forms,
    setForms,
    setCapability,
    setHomeRole,
    updateAssociation,
    community,
    removeAmenity,
    removeForm,
    can,
    isRemote,
    documents,
    ledger,
    vendors,
    requests,
  } = useAppState();
  const { notify } = useToast();

  const [newAmenity, setNewAmenity] = useState("");
  const [newFormLabel, setNewFormLabel] = useState("");
  const [appointing, setAppointing] = useState<{ ownerId: string; role: AccountRole } | null>(null);

  const roleFromLabel = (label?: string): AccountRole =>
    ((Object.keys(ROLE_LABEL) as AccountRole[]).find((r) => ROLE_LABEL[r] === label) ??
      "resident") as AccountRole;
  // Every home with a named owner, signed up or not, with the role it holds.
  // An officer can be named the day the association is set up; their access
  // is waiting when they create their account.
  const homes = community.owners
    .filter((o) => !o.placeholder && (o.email || accounts.some((a) => a.ownerId === o.id)))
    .map((o) => {
      const holder = accounts.find((a) => a.ownerId === o.id);
      return {
        ownerId: o.id,
        name: o.displayName,
        unit: o.unit,
        role: holder?.role ?? roleFromLabel(o.boardRole),
        signedUp: Boolean(holder),
      };
    });
  const ROLE_ORDER: AccountRole[] = ["president", "vice-president", "treasurer", "secretary"];
  const officers = homes
    .filter((h) => h.role !== "resident")
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  const candidates = homes
    .filter((h) => h.role === "resident")
    .sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }));

  if (!can("settings")) {
    return (
      <Callout
        tone="warn"
        icon={<Lock className="size-4" />}
        title="You do not have the settings capability"
      >
        The President grants this one. Ask them to turn it on for your account.
      </Callout>
    );
  }

  const isPresident = account?.role === "president";

  function addAmenity() {
    const name = newAmenity.trim();
    if (!name) return;
    setAmenities([
      ...amenities,
      {
        id: `am-${Date.now()}`,
        name,
        reservable: true,
        detail: "Added by the board",
        status: "open",
        maxHours: 4,
      },
    ]);
    setNewAmenity("");
  }

  function patchAmenity(id: string, patch: Partial<CommunityAmenity>) {
    setAmenities(amenities.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addForm() {
    const label = newFormLabel.trim();
    if (!label) return;
    const form: ArchitecturalForm = {
      id: `form-${Date.now()}`,
      label,
      description: "Uploaded by the board",
      fileName: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      size: "0 KB",
      source: "uploaded",
      updatedDate: todayIsoDate(),
    };
    setForms([...forms, form]);
    setNewFormLabel("");
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Name, visibility, board members, and billing."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader title="Identity" subtitle="The join code, the name, and the photo" />
          <SettingRow
            title="Join code"
            description="Share it with owners. They create their account with it, and you confirm their home under Homeowners."
          >
            <div className="flex items-center gap-2">
              <span className="tnum rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[15px] font-semibold tracking-[0.2em] text-fg">
                {community.association.joinCode ?? "Not set"}
              </span>
              {community.association.joinCode ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const link = `${window.location.origin}/join?code=${community.association.joinCode}`;
                    void navigator.clipboard?.writeText(link).then(
                      () => notify("Join link copied", "ok"),
                      () => notify(link, "info"),
                    );
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy link
                </Button>
              ) : null}
            </div>
          </SettingRow>
          <SettingRow title="Community name" description="Shown on the banner and on sign in">
            <input
              value={settings.displayName}
              onChange={(e) => updateSettings({ displayName: e.target.value })}
              aria-label="Community name"
              className="h-9 w-48 max-w-full rounded-lg border border-border-2 bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-primary"
            />
          </SettingRow>
          <div className="border-b border-border px-5 py-4">
            <p className="text-[15px] font-medium text-fg">Community photo</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Shown on the dashboard and at sign in.
            </p>
            <div
              className="mt-3 h-28 rounded-lg bg-cover bg-center"
              style={{ backgroundImage: `url(${settings.photoUrl})` }}
              role="img"
              aria-label="Current community photo"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="press inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-border-2 bg-surface px-3.5 text-[14px] font-medium text-fg hover:bg-surface-2">
                <Upload className="size-3.5" />
                Replace photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    // Object URLs are per tab, so this preview does not survive a
                    // reload. A real upload puts the file in object storage and
                    // stores the returned URL instead.
                    updateSettings({
                      photoUrl: URL.createObjectURL(file),
                      photoCredit: file.name,
                    });
                  }}
                />
              </label>
              {settings.photoCredit ? (
                <span className="text-[13px] text-fg-subtle">{settings.photoCredit}</span>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Resident home */}
        <Card>
          <CardHeader title="Resident home" subtitle="What owners see first when they sign in" />
          <div className="border-b border-border px-5 py-4">
            <p className="text-[15px] font-medium text-fg">Layout</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              A full calendar, or one banner you edit by hand.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  { v: "calendar" as const, label: "Calendar", hint: "Meetings, events, ballots" },
                  { v: "banner" as const, label: "Banner", hint: "One notice, quarterly boards" },
                ]
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => updateSettings({ homeLayout: o.v })}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    settings.homeLayout === o.v
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                    {o.label}
                    {settings.homeLayout === o.v ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-fg-muted">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {settings.homeLayout === "banner" ? (
            <div className="border-b border-border px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-[15px] font-medium text-fg">
                <Megaphone className="size-3.5" />
                Banner text
              </p>
              <input
                value={settings.banner.title}
                onChange={(e) =>
                  updateSettings({ banner: { ...settings.banner, title: e.target.value } })
                }
                aria-label="Banner title"
                className="h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] font-medium text-fg outline-none"
              />
              <textarea
                rows={2}
                value={settings.banner.detail}
                onChange={(e) =>
                  updateSettings({ banner: { ...settings.banner, detail: e.target.value } })
                }
                aria-label="Banner detail"
                className="mt-2 w-full resize-none rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg outline-none"
              />
            </div>
          ) : null}
        </Card>

        <DuesSettings />

        {/* Payments: billing, the bank, and who carries the fee */}
        <Card>
          <CardHeader title="Payments" subtitle="Your plan, where dues land, and who pays the fee" />
          {isRemote ? <BillingRow /> : null}
          {isRemote ? <StripeOnboardingRow associationId={community.id} /> : null}
          {isRemote ? <TestModeGuide audience="board" className="mx-4 my-3" /> : null}

          <SettingRow
            title="Payment fee"
            description="Flat fee per payment, added to the processor's cost"
          >
            <Select
              value={settings.paymentFeeCents}
              onChange={(e) => updateSettings({ paymentFeeCents: Number(e.target.value) })}
              aria-label="Payment fee"
            >
              {[0, 50, 100, 150, 200, 250, 300].map((cents) => (
                <option key={cents} value={cents}>
                  {cents === 0 ? "No fee" : `$${(cents / 100).toFixed(2)}`}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow
            title="Who pays it"
            description="Paid by the owner or by the association"
          >
            <Select
              value={settings.paymentFeePaidBy}
              onChange={(e) =>
                updateSettings({
                  paymentFeePaidBy: e.target.value as "owner" | "association",
                })
              }
              aria-label="Who pays the fee"
            >
              <option value="owner">The owner</option>
              <option value="association">The association</option>
            </Select>
          </SettingRow>
          <SettingRow
            title="Waive it on bank transfers"
            description="Bank transfers cost the association less than cards"
          >
            <Toggle
              checked={settings.paymentFeeWaivedOnAch}
              onChange={(v) => updateSettings({ paymentFeeWaivedOnAch: v })}
              label="Waive the fee on ACH"
            />
          </SettingRow>
          <SettingRow
            title="Autopay late day"
            description="The latest day of the month autopay can run"
          >
            <Select
              value={settings.autopayLateAfterDay}
              onChange={(e) => updateSettings({ autopayLateAfterDay: Number(e.target.value) })}
              aria-label="Autopay late day"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </SettingRow>
        </Card>

        {/* Visibility */}
        <Card>
          <CardHeader title="What residents can see" subtitle="Switch a section on or off for every owner" />
          <SettingRow
            title="Association funds"
            description="Balances, interest, and the transaction list"
          >
            <Toggle
              checked={settings.showFundsToResidents}
              onChange={(v) => updateSettings({ showFundsToResidents: v })}
              label="Show association funds to residents"
            />
          </SettingRow>
          <SettingRow
            title="Live vote results"
            description="When off, results stay hidden until the ballot closes"
          >
            <Toggle
              checked={settings.showLiveVoteResults}
              onChange={(v) => updateSettings({ showLiveVoteResults: v })}
              label="Show live vote results"
            />
          </SettingRow>
          <SettingRow title="Forum" description="Neighbor to neighbor posts">
            <Toggle
              checked={settings.forumEnabled}
              onChange={(v) => updateSettings({ forumEnabled: v })}
              label="Enable the forum"
            />
          </SettingRow>
        </Card>

        {/* Insurance. The setup plan sends a board here and there was nothing
            to fill in, so the task could never be completed. */}
        <Card id="insurance" className="scroll-mt-32 lg:scroll-mt-24">
          <CardHeader
            title="Insurance"
            subtitle="The policy and its renewal date"
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">Carrier</span>
              <input
                value={community.association.insuranceCarrier ?? ""}
                onChange={(e) => updateAssociation({ insuranceCarrier: e.target.value })}
                placeholder="Farmers Insurance"
                aria-label="Insurance carrier"
                className="mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">Policy number</span>
              <input
                value={community.association.insurancePolicyNo ?? ""}
                onChange={(e) => updateAssociation({ insurancePolicyNo: e.target.value })}
                placeholder="WA-CA-4471982"
                aria-label="Policy number"
                className="mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-fg-muted">Renews on</span>
              <input
                type="date"
                value={community.association.insuranceExpiresOn ?? ""}
                onChange={(e) => updateAssociation({ insuranceExpiresOn: e.target.value })}
                aria-label="Renewal date"
                className="mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
              />
            </label>
          </div>
        </Card>

        {/* The officers, and a way to add one. It listed all 88 homes with a
            role picker each, which made the four people who hold an office
            the hardest thing on the card to find. */}
        <Card>
          <CardHeader
            title="Who is on the board"
            subtitle="Each role comes with its own access."
            action={
              isPresident && !appointing && candidates.length ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAppointing({ ownerId: "", role: "secretary" })}
                >
                  <Plus className="size-3.5" />
                  Add a board member
                </Button>
              ) : undefined
            }
          />
          {appointing ? (
            <form
              className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-2 px-5 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                const home = candidates.find((h) => h.ownerId === appointing.ownerId);
                if (!home) return;
                setHomeRole(home.ownerId, appointing.role);
                notify(`${home.name} is ${ROLE_LABEL[appointing.role]}`, "ok");
                setAppointing(null);
              }}
            >
              <Select
                value={appointing.ownerId}
                onChange={(e) => setAppointing({ ...appointing, ownerId: e.target.value })}
                aria-label="Which home"
                className="min-w-[12rem] flex-1"
              >
                <option value="">Choose a home</option>
                {candidates.map((h) => (
                  <option key={h.ownerId} value={h.ownerId}>
                    {homeLabel(community, h.unit)} · {h.name}
                  </option>
                ))}
              </Select>
              <Select
                value={appointing.role}
                onChange={(e) =>
                  setAppointing({ ...appointing, role: e.target.value as AccountRole })
                }
                aria-label="Role"
              >
                {(["vice-president", "treasurer", "secretary"] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" size="md" disabled={!appointing.ownerId}>
                Add
              </Button>
              <Button variant="ghost" size="md" onClick={() => setAppointing(null)}>
                Cancel
              </Button>
            </form>
          ) : null}
          <div className="divide-y divide-border">
            {officers.map((row) => (
              <div key={row.ownerId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <div className="min-w-[10rem] flex-1">
                  <p className="truncate text-[15px] font-medium text-fg">{row.name}</p>
                  <p className="truncate text-[13px] text-fg-muted">
                    {homeLabel(community, row.unit)}
                    {row.signedUp ? "" : " · not signed up yet"}
                  </p>
                </div>
                {isPresident && row.role !== "president" ? (
                  <Select
                    value={row.role}
                    onChange={(e) => setHomeRole(row.ownerId, e.target.value as AccountRole)}
                    aria-label={`${row.name}'s role`}
                  >
                    {(["vice-president", "treasurer", "secretary", "resident"] as const).map((r) => (
                      <option key={r} value={r}>
                        {r === "resident" ? "Not on the board" : ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge tone={row.role === "president" ? "brand" : "neutral"}>
                    {ROLE_LABEL[row.role]}
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-fg-subtle">
            The President is set apart on purpose. Handing over that office is its own step,
            because an association with no President has no way to grant access back.
          </p>
        </Card>

        {/* What a board transition actually moves: nothing. The records are
            the association's, so changing who holds an office above is the
            entire handover. The counts are live so the claim stays checkable. */}
        {moduleOn("settings-advanced") ? (
        <Card>
          <CardHeader
            title="When the board changes"
            subtitle="Records stay with the association"
            icon={<ArrowLeftRight className="size-4" />}
          />
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
            {(
              [
                [documents.length, "documents"],
                [ledger.length, "ledger entries"],
                [community.owners.length, "homeowner records"],
                [vendors.length, "vendor contacts"],
                [community.meetings.length, "meetings on record"],
                [requests.length, "requests with history"],
              ] as const
            ).map(([count, noun]) => (
              <div key={noun} className="bg-surface px-5 py-3">
                <p className="tnum text-[22px] font-semibold leading-none text-fg">{count}</p>
                <p className="mt-1 text-[13px] text-fg-muted">{noun}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-fg-subtle">
            A new officer sees all of it the moment their office changes above. Nothing lives
            in the outgoing treasurer&apos;s inbox, and nothing leaves when they do.
          </p>
        </Card>
        ) : null}

        {/* Amenities */}
        <Card>
          <CardHeader
            title="Amenities"
            subtitle="Reservable ones appear in the resident request dropdown"
          />
          {amenities.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-border px-5 py-3 last:border-b-0"
            >
              {/* 12rem for the name and its rules before the switch and the
                  bin wrap under, so a phone never gets a word per line. */}
              <div className="min-w-[12rem] flex-1">
                <p className="truncate text-[15px] font-medium text-fg">{a.name}</p>
                <p className="truncate text-[13px] text-fg-muted">{a.detail}</p>
                {a.reservable ? (
                  <AmenityRules
                    amenity={a}
                    onChange={(rules) => patchAmenity(a.id, { rules })}
                  />
                ) : null}
              </div>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <label className="mt-0.5 flex items-center gap-1.5 text-[13px] text-fg-muted">
                  Reservable
                  <Toggle
                    checked={a.reservable}
                    onChange={(v) => patchAmenity(a.id, { reservable: v })}
                    label={`${a.name} reservable`}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => {
                    const undo = removeAmenity(a.id);
                    notify(`Removed ${a.name}`, "warn", { label: "Undo", onClick: undo });
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            <input
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
              placeholder="Add an amenity"
              aria-label="New amenity name"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border-2 bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-primary"
            />
            <Button variant="secondary" size="md" className="shrink-0" onClick={addAmenity} disabled={!newAmenity.trim()}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </Card>

        {/* Architectural forms */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Architectural forms"
            subtitle="Upload your own forms. The label is what residents see."
            icon={<FileText className="size-4" />}
          />
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {forms.map((f) => (
              <div key={f.id} className="flex items-start gap-3 bg-surface px-5 py-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-fg">{f.label}</p>
                    <Badge tone={f.source === "baseline" ? "neutral" : "brand"}>{f.source}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-fg-muted">{f.fileName}</p>
                  <p className="text-[13px] text-fg-subtle">
                    {f.size} · updated {formatDate(f.updatedDate, "long")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${f.label}`}
                  onClick={() => {
                    const undo = removeForm(f.id);
                    notify(`Removed ${f.label}`, "warn", { label: "Undo", onClick: undo });
                  }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            <input
              value={newFormLabel}
              onChange={(e) => setNewFormLabel(e.target.value)}
              placeholder="Label residents see, like Paint color request"
              aria-label="New form label"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border-2 bg-surface px-2.5 text-[15px] text-fg outline-none focus:border-primary"
            />
            <Button variant="secondary" size="md" className="shrink-0" onClick={addForm} disabled={!newFormLabel.trim()}>
              <Upload className="size-3.5" />
              Upload
            </Button>
          </div>
        </Card>

        {/* Permissions. Roles above cover month one; the per-person grid is
            a second permission model and waits with the advanced settings. */}
        {moduleOn("settings-advanced") ? (
        <Card className="xl:col-span-2">
          <CardHeader
            title="Admin capabilities"
            subtitle={
              isPresident
                ? "You hold the only capability that cannot be granted away"
                : "Only the President can change these"
            }
            icon={<ShieldCheck className="size-4" />}
          />
          {!isPresident ? (
            <div className="px-5 pt-4">
              <Callout tone="neutral" icon={<Lock className="size-4" />} title="Read only">
                Capabilities are set by the President.
              </Callout>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border text-[13px] font-semibold text-fg-muted">
                  <th className="px-5 py-2.5 font-semibold">Admin</th>
                  {GRANTABLE.map((c) => (
                    <th key={c} className="px-2 py-2.5 text-center font-semibold">
                      {CAPABILITY_LABEL[c].split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts
                  .filter((a) => a.role !== "resident")
                  .map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-3">
                        <p className="text-[15px] font-medium text-fg">{a.name}</p>
                        <p className="text-[13px] text-fg-muted">{ROLE_LABEL[a.role]}</p>
                      </td>
                      {GRANTABLE.map((c) => (
                        <td key={c} className="px-2 py-3 text-center">
                          <Checkbox
                            checked={a.capabilities[c]}
                            disabled={!isPresident || a.role === "president"}
                            onChange={(e) => setCapability(a.id, c, e.target.checked)}
                            aria-label={`${a.name}: ${CAPABILITY_LABEL[c]}`}
                            className="disabled:opacity-40"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-fg-subtle">
            The President&apos;s own row is locked on purpose. An association that can strip its
            President of access has no way back in.
          </p>
        </Card>
        ) : null}
      </div>
          <DangerZone />
</>
  );
}

/**
 * Where payment onboarding stands, and the door into Stripe's hosted flow.
 *
 * Rendered only for a real association: the demo has no money to move. The
 * status is read live from the connect route on every visit rather than
 * cached in a column, because "charges enabled" is Stripe's fact, not ours,
 * and a stale copy would tell a treasurer setup is done when it is not.
 */
function StripeOnboardingRow({ associationId }: { associationId: string }) {
  const [status, setStatus] = useState<
    | { name: "loading" }
    | { name: "error" }
    | { name: "none" }
    | { name: "incomplete" }
    | { name: "live" }
  >({ name: "loading" });
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/stripe/connect?associationId=${encodeURIComponent(associationId)}`,
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (cancelled) return;
        if (!data.accountId) setStatus({ name: "none" });
        else if (data.chargesEnabled) setStatus({ name: "live" });
        else setStatus({ name: "incomplete" });
      } catch {
        if (!cancelled) setStatus({ name: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [associationId]);

  async function openOnboarding() {
    setRedirecting(true);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associationId }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error();
      window.location.assign(data.url);
    } catch {
      setRedirecting(false);
      setStatus({ name: "error" });
    }
  }

  return (
    <SettingRow
      title="Accepting payments"
      description={
        status.name === "live"
          ? "Dues settle to the association's own bank account through Stripe"
          : "Connect the association to Stripe so residents can pay dues here"
      }
    >
      {status.name === "loading" ? (
        <span className="text-[13px] text-fg-subtle">Checking…</span>
      ) : status.name === "live" ? (
        <Badge tone="ok">Payments are live</Badge>
      ) : status.name === "error" ? (
        <span className="text-[13px] font-medium text-danger">Could not reach Stripe</span>
      ) : (
        <Button variant="primary" size="sm" onClick={openOnboarding} disabled={redirecting}>
          {redirecting
            ? "Opening…"
            : status.name === "incomplete"
              ? "Resume setup"
              : "Set up payments"}
        </Button>
      )}
    </SettingRow>
  );
}
