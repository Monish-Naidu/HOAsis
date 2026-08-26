"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  ImageIcon,
  Lock,
  Megaphone,
  Plus,
  RotateCcw,
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
  PageHeader,
  SettingRow,
  Toggle,
} from "@/components/ui/primitives";
import { DangerZone } from "@/components/app/danger-zone";
import { useAppState } from "@/lib/app-state";
import { AmenityRules } from "@/components/app/amenity-rules";
import { useToast } from "@/components/app/toast";
import { CAPABILITY_LABEL, GRANTABLE } from "@/lib/data";
import { ROLE_LABEL, type ArchitecturalForm, type CommunityAmenity } from "@/lib/types";
import { cn, formatDate, todayIsoDate } from "@/lib/utils";

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
    removeAmenity,
    removeForm,
    resetDemo,
    can,
  } = useAppState();
  const { notify } = useToast();

  const [newAmenity, setNewAmenity] = useState("");
  const [newFormLabel, setNewFormLabel] = useState("");

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
        eyebrow="Community"
        title="Settings"
        action={
          <Button variant="secondary" size="md" onClick={resetDemo}>
            <RotateCcw className="size-3.5" />
            Reset demo data
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader title="Identity" icon={<ImageIcon className="size-4" />} />
          <SettingRow title="Community name" description="Shown on the banner and on sign in">
            <input
              value={settings.displayName}
              onChange={(e) => updateSettings({ displayName: e.target.value })}
              aria-label="Community name"
              className="h-9 w-48 rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            />
          </SettingRow>
          <div className="border-b border-border px-5 py-4">
            <p className="text-[15px] font-medium text-fg">Community photo</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Sits behind the community name on every screen.
            </p>
            <div
              className="mt-3 h-28 rounded-lg bg-cover bg-center"
              style={{ backgroundImage: `url(${settings.photoUrl})` }}
              role="img"
              aria-label="Current community photo"
            />
            <div className="mt-2 flex items-center gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border-2 bg-surface px-3 text-[15px] font-medium text-fg hover:bg-surface-2">
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
          <CardHeader title="Resident home" icon={<CalendarDays className="size-4" />} />
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
                      ? "border-navy-700 bg-brand-soft dark:border-navy-300"
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

          <SettingRow
            title="Payment fee"
            description="Flat HOAsis fee per payment, on top of the processor's cost"
          >
            <select
              value={settings.paymentFeeCents}
              onChange={(e) => updateSettings({ paymentFeeCents: Number(e.target.value) })}
              aria-label="Payment fee"
              className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            >
              {[0, 50, 100, 150, 200, 250, 300].map((cents) => (
                <option key={cents} value={cents}>
                  {cents === 0 ? "No fee" : `$${(cents / 100).toFixed(2)}`}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow
            title="Who pays it"
            description="The owner pays it, or the association does"
          >
            <select
              value={settings.paymentFeePaidBy}
              onChange={(e) =>
                updateSettings({
                  paymentFeePaidBy: e.target.value as "owner" | "association",
                })
              }
              aria-label="Who pays the fee"
              className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            >
              <option value="owner">The owner</option>
              <option value="association">The association</option>
            </select>
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
            description="Autopay cannot be set later than this day"
          >
            <select
              value={settings.autopayLateAfterDay}
              onChange={(e) => updateSettings({ autopayLateAfterDay: Number(e.target.value) })}
              aria-label="Autopay late day"
              className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </SettingRow>
        </Card>

        {/* Visibility */}
        <Card>
          <CardHeader title="What residents can see" icon={<ShieldCheck className="size-4" />} />
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
            description="Off means tallies stay sealed until a ballot closes"
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

        {/* Amenities */}
        <Card>
          <CardHeader
            title="Amenities"
            subtitle="Reservable ones appear in the resident request dropdown"
          />
          {amenities.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-fg">{a.name}</p>
                <p className="truncate text-[13px] text-fg-muted">{a.detail}</p>
                {a.reservable ? (
                  <AmenityRules
                    amenity={a}
                    onChange={(rules) => patchAmenity(a.id, { rules })}
                  />
                ) : null}
              </div>
              <label className="mt-0.5 flex shrink-0 items-center gap-1.5 text-[13px] text-fg-muted">
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
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            <input
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
              placeholder="Add an amenity"
              aria-label="New amenity name"
              className="h-9 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            />
            <Button variant="primary" size="sm" onClick={addAmenity} disabled={!newAmenity.trim()}>
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
              placeholder="Label residents will see, for example Paint color request"
              aria-label="New form label"
              className="h-9 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            />
            <Button variant="primary" size="sm" onClick={addForm} disabled={!newFormLabel.trim()}>
              <Upload className="size-3.5" />
              Upload
            </Button>
          </div>
        </Card>

        {/* Permissions */}
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
                          <input
                            type="checkbox"
                            checked={a.capabilities[c]}
                            disabled={!isPresident || a.role === "president"}
                            onChange={(e) => setCapability(a.id, c, e.target.checked)}
                            aria-label={`${a.name}: ${CAPABILITY_LABEL[c]}`}
                            className="size-4 accent-navy-700 disabled:opacity-40"
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
      </div>
          <DangerZone />
</>
  );
}
