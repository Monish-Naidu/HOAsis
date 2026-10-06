"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Hourglass,
  IdCard,
  Landmark,
  Lock,
  Megaphone,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  Eye,
  History,
  Minus,
  Pencil,
} from "lucide-react";
import { Badge, Button, Callout, Card, CardHeader, PageHeader, SectionTitle, Select, SettingRow, Toggle, fieldClass, textareaClass } from "@/components/ui/primitives";
import { checkNewEmail } from "@/lib/email-change";
import { DangerZone } from "@/components/app/danger-zone";
import { SameNameNote } from "@/components/app/same-name-note";
import { BillingRow } from "@/components/app/billing-row";
import { DisplaySettings } from "@/components/app/display-settings";
import { DuesSettings } from "@/components/app/dues-settings";
import { TestModeGuide } from "@/components/app/test-mode-guide";
import { useAppState } from "@/lib/app-state";
import { AmenityRules } from "@/components/app/amenity-rules";
import { useCoverPhotoUpload } from "@/components/app/community-hero";
import { useToast } from "@/components/app/toast";
import { accessLevel, CAPABILITY_LABEL, GRANTABLE } from "@/lib/data";
import {
  type AccessLevel,
  type Activity,
  type Capability,
  ROLE_LABEL,
  type AccountRole,
  type ArchitecturalForm,
  type CommunityAmenity,
} from "@/lib/types";
import { clockTime, cn, daysFromToday, formatDate, relativeDays, todayIsoDate } from "@/lib/utils";
import { homeLabel } from "@/lib/wording";
import { moduleOn } from "@/lib/modules";
import { NEXT_ACCESS } from "@/lib/access";
import { joinNeeds } from "@/lib/stripe/requirements";

/** The jump row under the title, in page order. */
const SECTIONS: { id: string; label: string }[] = [
  { id: "display", label: "Display" },
  { id: "community", label: "Community" },
  { id: "money", label: "Money" },
  { id: "residents", label: "Residents" },
  { id: "board", label: "The board" },
  { id: "amenities", label: "Amenities and forms" },
  { id: "leaving", label: "Leaving and closing" },
];

export function SettingsScreen() {
  const coverPhoto = useCoverPhotoUpload();
  const {
    account,
    accounts,
    communities,
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
    sees,
    isRemote,
    documents,
    ledger,
    vendors,
    requests,
  } = useAppState();
  const { notify } = useToast();

  // Said only once the write resolved true: a refused save must not read as done.
  function saveSetting(patch: Parameters<typeof updateSettings>[0], said: string) {
    void Promise.resolve(updateSettings(patch)).then((ok) => {
      if (ok) notify(said, "ok");
    });
  }

  const [newAmenity, setNewAmenity] = useState("");
  const [name, setName] = useState(settings.displayName);
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
        // What the seat opens, in the names on the sidebar, so a president
        // appointing a treasurer can see what that gives them.
        opens: holder
          ? GRANTABLE.filter((c) => holder.capabilities[c])
          : [],
      };
    });
  const ROLE_ORDER: AccountRole[] = ["president", "vice-president", "treasurer", "secretary"];
  const officers = homes
    .filter((h) => h.role !== "resident")
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  const candidates = homes
    .filter((h) => h.role === "resident")
    .sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }));
  // Terms of office, where the database keeps them: when each sitting
  // officer took the seat, and who held one before. Absent for the demo.
  const terms = community.boardTerms ?? [];
  const sinceFor = (ownerId: string, role: AccountRole) =>
    terms.find((t) => !t.to && t.role === role && t.unit === community.owners.find((o) => o.id === ownerId)?.unit)?.from;
  const pastTerms = terms
    .filter((t): t is typeof t & { to: string } => Boolean(t.to))
    .sort((a, b) => b.to.localeCompare(a.to) || b.from.localeCompare(a.from));

  if (!sees("settings")) {
    return (
      <Callout
        tone="warn"
        icon={<Lock className="size-4" />}
        title="You can't change settings"
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
      {/* One column, full width like every other board tab. Two columns
          left a hole beside every short card, and a settings page is read
          top to bottom by heading, so the jump row under the title is the
          map. */}
      <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Text size, name, visibility, board members, and billing."
      />

      <nav aria-label="On this page" className="-mt-2 flex flex-wrap gap-x-1 gap-y-1">
        {SECTIONS.map((x) => (
          <a
            key={x.id}
            href={`#${x.id}`}
            className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-footnote font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg pointer-coarse:min-h-11"
          >
            {x.label}
          </a>
        ))}
      </nav>

      {/* Two columns that each stack their own cards, so nothing waits on
          a taller neighbour and no row runs the width of the screen. One
          column left every setting's control a foot away from its label. */}
      {/* min-w-0 on each column: a grid column's floor is its widest child's
          natural width, and the roster table's is 720px, so a phone showed a
          sideways scroll with the right edge of every card cut off. */}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <div className="min-w-0 space-y-6">
      {/* Yours, not the association's: first, because it is the setting a
          board member is most likely to come here looking for. */}
      <section id="display" className="scroll-mt-32 lg:scroll-mt-24">
        <SectionTitle>Display on this device</SectionTitle>
        <DisplaySettings />
      </section>

      <section id="community" className="scroll-mt-32 space-y-4 lg:scroll-mt-24">
        <SectionTitle>Community</SectionTitle>
        {/* Identity */}
        <Card>
          <CardHeader title="Identity" subtitle="The join code, the name, and the photo" />
          <SettingRow
            title="Join code"
            description="Share it with owners. They create their account with it, and you confirm their home under Homeowners."
          >
            <div className="flex items-center gap-2">
              <span className="tnum rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-body font-semibold tracking-[0.2em] text-fg">
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
            {/* Saved when the field is left, with a word to say so. Saving
                on every keystroke rewrote the banner mid-word and never
                told the board member the change had taken. */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onBlur={() => {
                const next = name.trim();
                if (!next) {
                  setName(settings.displayName);
                  return;
                }
                if (next === settings.displayName) return;
                updateSettings({ displayName: next });
                notify(`Saved. The community is now ${next}.`, "ok");
              }}
              aria-label="Community name"
              className={cn(fieldClass, "w-48 max-w-full")}
            />
            {name.trim() !== settings.displayName.trim() ? (
              <SameNameNote
                name={name}
                excludeSlug={communities.find((c) => c.id === community.id)?.slug}
                variant="plain"
                className="mt-2 max-w-sm text-footnote leading-snug text-fg-muted"
              />
            ) : null}
          </SettingRow>
          <ContactEmailRow
            value={community.association.contactEmail ?? ""}
            save={(contactEmail) => updateAssociation({ contactEmail })}
          />
          <div className="border-b border-border px-5 py-4">
            <p className="text-body font-medium text-fg">Community photo</p>
            <p className="mt-0.5 text-footnote text-fg-muted">
              Shown on the dashboard and at sign in.
            </p>
            {settings.photoUrl ? (
              <div
                className="mt-3 h-28 rounded-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${settings.photoUrl})` }}
                role="img"
                aria-label="Current community photo"
              />
            ) : (
              <div className="mt-3 flex h-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-2 bg-surface-2 text-fg-subtle">
                <ImageIcon className="size-5" aria-hidden />
                <span className="text-footnote">No photo yet</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="press inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg pointer-coarse:min-h-11 border border-border-2 bg-surface px-3.5 text-callout font-medium text-fg hover:bg-surface-2">
                <Upload className="size-3.5" />
                Replace photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Cleared so picking the same file again still fires.
                    event.target.value = "";
                    if (!file) return;
                    // The same upload the banner's camera button uses. This
                    // used to save an object URL, which only means anything
                    // in the tab that made it, as a real association's photo.
                    void coverPhoto.choose(file);
                    // The old credit named somebody else's picture.
                    if (settings.photoCredit) updateSettings({ photoCredit: "" });
                  }}
                />
              </label>
              {settings.photoCredit ? (
                <span className="text-footnote text-fg-subtle">{settings.photoCredit}</span>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Resident home */}
        <Card>
          <CardHeader title="Resident home" subtitle="What owners see first when they sign in" />
          <div className="border-b border-border px-5 py-4">
            <p className="text-body font-medium text-fg">Layout</p>
            <p className="mt-0.5 text-footnote text-fg-muted">
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
                  <span className="flex items-center gap-1.5 text-body font-semibold text-fg">
                    {o.label}
                    {settings.homeLayout === o.v ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="mt-0.5 block text-footnote text-fg-muted">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {settings.homeLayout === "banner" ? (
            <div className="border-b border-border px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-body font-medium text-fg">
                <Megaphone className="size-3.5" />
                Banner text
              </p>
              <DraftField
                value={settings.banner.title}
                // Only the field that changed. Sent with the whole banner as
                // this render saw it, the detail saved a moment later put the
                // old title back.
                onCommit={(title) => updateSettings({ banner: { title } })}
                aria-label="Banner title"
                className={cn(fieldClass, "font-medium")}
              />
              <DraftField
                multiline
                rows={2}
                value={settings.banner.detail}
                onCommit={(detail) => updateSettings({ banner: { detail } })}
                aria-label="Banner detail"
                className={cn(textareaClass, "mt-2 resize-none")}
              />
            </div>
          ) : null}
        </Card>

        {/* Insurance. The setup plan sends a board here and there was nothing
            to fill in, so the task could never be completed. */}
        <Card id="insurance">
          <CardHeader
            title="Insurance"
            subtitle="The policy and its renewal date"
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-footnote font-semibold text-fg-muted">Carrier</span>
              <DraftField
                value={community.association.insuranceCarrier ?? ""}
                onCommit={(insuranceCarrier) => updateAssociation({ insuranceCarrier })}
                placeholder="Farmers Insurance"
                aria-label="Insurance carrier"
                className={cn(fieldClass, "mt-1.5")}
              />
            </label>
            <label className="block">
              <span className="text-footnote font-semibold text-fg-muted">Policy number</span>
              <DraftField
                value={community.association.insurancePolicyNo ?? ""}
                onCommit={(insurancePolicyNo) => updateAssociation({ insurancePolicyNo })}
                placeholder="WA-CA-4471982"
                aria-label="Policy number"
                className={cn(fieldClass, "mt-1.5")}
              />
            </label>
            <label className="block">
              <span className="text-footnote font-semibold text-fg-muted">Renews on</span>
              <input
                type="date"
                value={community.association.insuranceExpiresOn ?? ""}
                onChange={(e) => updateAssociation({ insuranceExpiresOn: e.target.value })}
                aria-label="Renewal date"
                className={cn(fieldClass, "mt-1.5")}
              />
            </label>
          </div>
          {community.association.insuranceExpiresOn ? (
            <p
              className={cn(
                "border-t border-border px-5 py-3 text-footnote",
                daysFromToday(community.association.insuranceExpiresOn) <= 60
                  ? "font-medium text-warn"
                  : "text-fg-muted",
              )}
            >
              Renews {relativeDays(community.association.insuranceExpiresOn)}
              {daysFromToday(community.association.insuranceExpiresOn) <= 60
                ? ". Ask the carrier for the new policy now."
                : "."}
            </p>
          ) : null}
        </Card>
      </section>

      <section id="money" className="scroll-mt-32 space-y-4 lg:scroll-mt-24">
        <SectionTitle>Money</SectionTitle>
        <DuesSettings />

        {/* Payments: billing, the bank, and autopay's last day */}
        <Card>
          <CardHeader
            title="Payments"
            subtitle={
              isRemote ? "Your plan, where dues land, and when autopay runs" : "When autopay runs"
            }
          />
          {isRemote ? <BillingRow /> : null}
          {isRemote ? <StripeOnboardingRow associationId={community.id} /> : null}
          {isRemote ? <TestModeGuide audience="board" className="mx-4 my-3" /> : null}

          <SettingRow
            title="Last day for autopay"
            description="The latest day of the month autopay can run"
          >
            <Select
              value={settings.autopayLateAfterDay}
              onChange={(e) => updateSettings({ autopayLateAfterDay: Number(e.target.value) })}
              aria-label="Last day for autopay"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </SettingRow>
        </Card>
      </section>
      </div>

      <div className="min-w-0 space-y-6">
      <section id="residents" className="scroll-mt-32 space-y-4 lg:scroll-mt-24">
        <SectionTitle>Residents</SectionTitle>
        {/* Visibility */}
        <Card>
          <CardHeader title="What residents can see" subtitle="Switch a section on or off for every owner" />
          <SettingRow
            title="Association funds"
            description="Balances, interest, and the transaction list"
          >
            <Toggle
              checked={settings.showFundsToResidents}
              onChange={(v) =>
                saveSetting(
                  { showFundsToResidents: v },
                  v ? "Residents can see association funds." : "Residents cannot see association funds.",
                )
              }
              label="Show association funds to residents"
            />
          </SettingRow>
          <SettingRow
            title="Live vote results"
            description="When off, results stay hidden until the ballot closes"
          >
            <Toggle
              checked={settings.showLiveVoteResults}
              onChange={(v) =>
                saveSetting(
                  { showLiveVoteResults: v },
                  v ? "Live vote results are on." : "Live vote results are off.",
                )
              }
              label="Show live vote results"
            />
          </SettingRow>
          <SettingRow title="Community posts" description="Neighbor to neighbor posts">
            <Toggle
              checked={settings.forumEnabled}
              onChange={(v) =>
                saveSetting({ forumEnabled: v }, v ? "Community posts are on." : "Community posts are off.")
              }
              label="Allow community posts"
            />
          </SettingRow>
        </Card>
      </section>

      <section id="board" className="scroll-mt-32 space-y-4 lg:scroll-mt-24">
        <SectionTitle>The board</SectionTitle>
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
                  <p className="truncate text-body font-medium text-fg">{row.name}</p>
                  <p className="truncate text-footnote text-fg-muted">
                    {homeLabel(community, row.unit)}
                    {sinceFor(row.ownerId, row.role)
                      ? ` · since ${formatDate(sinceFor(row.ownerId, row.role) as string, "long")}`
                      : ""}
                    {row.signedUp ? "" : " · not signed up yet"}
                  </p>
                  {row.opens.length ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-footnote text-fg-subtle">Opens</span>
                      {row.role === "president" ? (
                        <Badge tone="neutral">Everything</Badge>
                      ) : (
                        sectionNames(row.opens).map((n) => (
                          <Badge key={n} tone="neutral">
                            {n}
                          </Badge>
                        ))
                      )}
                    </div>
                  ) : null}
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
          <p className="max-w-prose border-t border-border px-5 py-3 text-footnote leading-relaxed text-fg-subtle">
            The President is set apart on purpose. Handing over that office is its own step,
            because an association with no President has no way to grant access back.
          </p>
          {/* Who held an office before, folded: a ten year association has
              a dozen terms behind its four sitting officers. */}
          {pastTerms.length ? (
            <details className="group border-t border-border">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 py-3 text-footnote font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg [&::-webkit-details-marker]:hidden">
                Past officers
                <span className="flex items-center gap-2 font-medium text-fg-subtle">
                  {pastTerms.length} {pastTerms.length === 1 ? "term" : "terms"}
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {pastTerms.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                    <div className="min-w-[10rem] flex-1">
                      <p className="truncate text-body font-medium text-fg">{t.name}</p>
                      <p className="truncate text-footnote text-fg-muted">
                        {t.unit ? `${homeLabel(community, t.unit)} · ` : ""}
                        <span className="tnum">
                          {formatDate(t.from, "long")} to {formatDate(t.to, "long")}
                        </span>
                      </p>
                    </div>
                    <Badge tone="neutral">{ROLE_LABEL[t.role]}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
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
                [community.history?.ledgerCount ?? ledger.length, "transactions"],
                [community.owners.length, "owners"],
                [vendors.length, "vendors"],
                [community.meetings.length, "meetings on record"],
                [requests.length, "requests"],
              ] as const
            ).map(([count, noun]) => (
              <div key={noun} className="bg-surface px-5 py-3">
                <p className="tnum text-title2 font-semibold leading-none text-fg">{count}</p>
                <p className="mt-1 text-footnote text-fg-muted">{noun}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-border px-5 py-3 text-footnote leading-relaxed text-fg-subtle">
            A new officer sees all of it the moment their office changes above. Nothing lives
            in the outgoing treasurer&apos;s inbox, and nothing leaves when they do.
          </p>
        </Card>
        ) : null}

        {/* Permissions. Roles above cover month one; the per-person grid is
            a second permission model and waits with the advanced settings. */}
        {moduleOn("settings-advanced") ? (
        <Card>
          <CardHeader
            title="What each member can do"
            subtitle={
              isPresident
                ? "Only you can change these"
                : "Only the President can change these"
            }
            icon={<ShieldCheck className="size-4" />}
          />
          {!isPresident ? (
            <div className="px-5 pt-4">
              <Callout tone="neutral" icon={<Lock className="size-4" />} title="Read only">
                Access is set by the President.
              </Callout>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border text-footnote font-semibold text-fg-muted">
                  <th className="px-5 py-2.5 font-semibold">Board member</th>
                  {GRID_AREAS.map((c) => (
                    <th key={c} className="px-2 py-2.5 text-center font-semibold">
                      {CAPABILITY_LABEL[c]}
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
                        <p className="text-body font-medium text-fg">{a.name}</p>
                        <p className="text-footnote text-fg-muted">{ROLE_LABEL[a.role]}</p>
                      </td>
                      {GRID_AREAS.map((c) => (
                        <td key={c} className="px-2 py-2 text-center">
                          <AccessControl
                            level={accessLevel(a, c)}
                            disabled={!isPresident || a.role === "president"}
                            label={`${a.name}: ${CAPABILITY_LABEL[c]}`}
                            onChange={(level) => {
                              setCapability(a.id, c, level);
                              // setCapability gives no answer to wait for; a refused
                              // signed-in write is reported by the write itself.
                              notify(accessSaid(a.name, c, level), "ok");
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-5 py-3 text-footnote text-fg-subtle">
            <span className="inline-flex items-center gap-1.5"><Minus className="size-3.5" aria-hidden /> No access</span>
            <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" aria-hidden /> Can see</span>
            <span className="inline-flex items-center gap-1.5"><Pencil className="size-3.5" aria-hidden /> Can change</span>
            <span className="basis-full leading-relaxed">
              Press a box to change it. The President&apos;s own row is locked on purpose: an
              association that can strip its President of access has no way back in.
            </span>
          </div>
        </Card>
        ) : null}

        {/* Every board action, as the database recorded it. Written by
            triggers, so nothing can skip it; nobody can delete a row. */}
        {isRemote ? (
          <Card>
            <CardHeader
              title="Activity"
              subtitle="Who did what, newest first. Kept for as long as the association exists."
              icon={<History className="size-4" />}
            />
            <ActivityList rows={community.activity ?? []} />
          </Card>
        ) : null}
      </section>

      <section id="amenities" className="scroll-mt-32 space-y-4 lg:scroll-mt-24">
        <SectionTitle>Amenities and forms</SectionTitle>
        {/* Amenities */}
        <Card>
          <CardHeader
            title="Amenities"
            subtitle="Owners can book these from Requests"
          />
          {amenities.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-border px-5 py-3 last:border-b-0"
            >
              {/* 12rem for the name and its rules before the switch and the
                  bin wrap under, so a phone never gets a word per line. */}
              <div className="min-w-[12rem] flex-1">
                <p className="truncate text-body font-medium text-fg">{a.name}</p>
                <p className="truncate text-footnote text-fg-muted">{a.detail}</p>
                {a.reservable ? (
                  <AmenityRules
                    amenity={a}
                    onChange={(rules) => patchAmenity(a.id, { rules })}
                  />
                ) : null}
              </div>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <label className="mt-0.5 flex items-center gap-1.5 text-footnote text-fg-muted">
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
          <form
            className="flex items-center gap-2 border-t border-border px-5 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              addAmenity();
            }}
          >
            <input
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
              placeholder="Add an amenity"
              aria-label="New amenity name"
              className={cn(fieldClass, "min-w-0 flex-1")}
            />
            <Button type="submit" variant="secondary" size="md" className="shrink-0" disabled={!newAmenity.trim()}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </form>
        </Card>

        {/* Architectural forms */}
        <Card>
          <CardHeader
            title="Home change forms"
            subtitle="Upload your own forms. The label is what residents see."
            icon={<FileText className="size-4" />}
          />
          {/* One list, not two columns: side by side, the badge wrapped
              under every label longer than three words. */}
          <div className="divide-y divide-border">
            {forms.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-medium text-fg">{f.label}</p>
                    <Badge tone={f.source === "baseline" ? "neutral" : "brand"}>{f.source === "baseline" ? "Standard" : "Yours"}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-footnote text-fg-muted">{f.fileName}</p>
                  <p className="text-footnote text-fg-subtle">
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
          <form
            className="flex items-center gap-2 border-t border-border px-5 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              addForm();
            }}
          >
            <input
              value={newFormLabel}
              onChange={(e) => setNewFormLabel(e.target.value)}
              placeholder="Label residents see, like Paint color request"
              aria-label="New form label"
              className={cn(fieldClass, "min-w-0 flex-1")}
            />
            <Button type="submit" variant="secondary" size="md" className="shrink-0" disabled={!newFormLabel.trim()}>
              <Upload className="size-3.5" />
              Upload
            </Button>
          </form>
        </Card>
      </section>
      </div>
      </div>

          {/* Folded. Deleting the association sat one scroll below the dues
              amount, open, on a page a treasurer visits monthly. */}
          <details id="leaving" className="group scroll-mt-32 lg:scroll-mt-24">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-card border border-border bg-surface px-5 py-3.5 text-body font-medium text-fg shadow-card transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <span>
                Leaving and closing
                <span className="ml-2 text-footnote font-normal text-fg-muted">
                  Hand over the presidency, leave, cancel, or delete
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
            </summary>
            <DangerZone />
          </details>
      </div>
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
 *
 * Four things a treasurer can see here, in the order they happen:
 *
 *   1. Nothing yet. A "before you start" card names the three things to have
 *      on the desk, then one button. Stripe's form asks for exactly those,
 *      because the connect route prefilled the rest.
 *   2. Stripe needs one more thing. The requirement paths Stripe sends come
 *      back as plain sentences (src/lib/stripe/requirements.ts); Continue
 *      reopens the form on that page.
 *   3. Stripe is checking. Every form is in and Stripe is verifying, which
 *      usually takes minutes. This row asks again every ten seconds so the
 *      treasurer sees it flip without reloading.
 *   4. Live, with the bank the dues pay out to.
 */
type OnboardingStatus =
  | { name: "loading" }
  | { name: "error" }
  | { name: "none" }
  | { name: "needs"; needs: string[] }
  | { name: "checking" }
  | { name: "live"; payout: { bank: string; last4: string } | null };

/**
 * The address owners reach when they reply to an email from the association.
 *
 * Blank is allowed and means emails tell owners not to reply. A typo is
 * refused here, with a reason, because a reply to a bad address is lost with
 * no one told. "Saved" is said only once the write resolved true, so a seat
 * the database refused is not told it worked.
 */
export function ContactEmailRow({
  value,
  save,
}: {
  value: string;
  save: (next: string) => boolean | Promise<boolean>;
}) {
  const { notify } = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <SettingRow
      title="Board contact email"
      description="Owners who reply to an email from the association reach this address. Leave it blank and emails say not to reply."
    >
      <DraftField
        value={value}
        onCommit={(next) => {
          if (next) {
            const checked = checkNewEmail(next, "");
            if (!checked.ok) {
              setProblem(checked.message);
              return;
            }
          }
          setProblem(null);
          void Promise.resolve(save(next)).then((ok) => {
            if (ok) notify(next ? "Saved. Replies go to that address." : "Saved. Emails now say not to reply.", "ok");
          });
        }}
        placeholder="board@maplecourt.org"
        aria-label="Board contact email"
        className={cn(fieldClass, "w-64 max-w-full")}
      />
      {problem ? (
        <p role="alert" className="mt-1.5 text-footnote text-danger">
          {problem}
        </p>
      ) : null}
    </SettingRow>
  );
}

/**
 * A text field that keeps what is being typed to itself and saves once, when
 * the field is left (or on Enter, for a single line).
 *
 * These fields used to save on every keystroke. For a real association the
 * value on screen is the loaded record, which only moves after the write and
 * a full re-read, so each key was put back to the old text before the next
 * one landed: typing a carrier's name saved a letter or two of it, and every
 * key was its own write and its own line in the activity record.
 *
 * When the saved value changes underneath (the save landed, or the person
 * switched association) the draft follows it, but never while the field is
 * being typed in: an earlier save landing must not wipe the words typed
 * since. That is done while rendering, not in an effect, so there is no
 * frame showing the last association's text.
 */
export function DraftField({
  value,
  onCommit,
  multiline = false,
  ...rest
}: {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  "aria-label": string;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [typing, setTyping] = useState(false);
  if (value !== seen && !typing) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    setTyping(false);
    // What is typed stays on screen until the saved value next moves, which
    // for a real association is when the write has been read back.
    setSeen(value);
    const next = draft.trim();
    if (next !== draft) setDraft(next);
    if (next !== value) onCommit(next);
  };
  return multiline ? (
    <textarea
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setTyping(true)}
      onBlur={commit}
    />
  ) : (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setTyping(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={commit}
    />
  );
}

const CHECKING_POLL_MS = 10_000;

function StripeOnboardingRow({ associationId }: { associationId: string }) {
  const [status, setStatus] = useState<OnboardingStatus>({ name: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/stripe/connect?associationId=${encodeURIComponent(associationId)}`,
        );
        if (!response.ok) throw new Error();
        const data: {
          accountId: string | null;
          chargesEnabled: boolean;
          detailsSubmitted: boolean;
          needs?: string[];
          payout: { bank: string; last4: string } | null;
        } = await response.json();
        if (cancelled) return;
        if (!data.accountId) setStatus({ name: "none" });
        else if (data.chargesEnabled) setStatus({ name: "live", payout: data.payout ?? null });
        else if (data.needs?.length || !data.detailsSubmitted)
          setStatus({ name: "needs", needs: data.needs?.length ? data.needs : ["a few more details"] });
        else setStatus({ name: "checking" });
      } catch {
        if (!cancelled) setStatus({ name: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [associationId, refresh]);

  // While Stripe verifies, ask again every ten seconds. The interval only
  // exists in that one state, so a live or untouched row makes no requests.
  useEffect(() => {
    if (status.name !== "checking") return;
    const id = window.setInterval(() => setRefresh((n) => n + 1), CHECKING_POLL_MS);
    return () => window.clearInterval(id);
  }, [status.name]);

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

  if (status.name === "none") {
    return (
      <div className="border-b border-border px-5 py-4 last:border-b-0">
        <p className="text-body font-medium text-fg">Accepting payments</p>
        <p className="mt-0.5 text-footnote leading-snug text-fg-muted">
          Residents can pay dues here once the association is connected to Stripe.
        </p>
        <p className="mt-4 text-body font-semibold text-fg">Before you start, have these ready</p>
        <ul className="mt-2 space-y-2.5">
          {[
            { icon: FileText, text: "The association's EIN letter from the IRS" },
            {
              icon: Landmark,
              text: "The bank's routing and account numbers, or a login to online banking",
            },
            {
              icon: IdCard,
              text: "The president's or treasurer's date of birth and the last four digits of their Social Security number",
            },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-body leading-relaxed text-fg">{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-body leading-relaxed text-fg-muted">
          Stripe handles the payments. Your HOAsis never sees these numbers.
        </p>
        <Button
          variant="primary"
          size="lg"
          className="mt-4 w-full sm:w-auto"
          onClick={openOnboarding}
          disabled={redirecting}
        >
          {redirecting ? "Opening Stripe…" : "Start with Stripe"}
        </Button>
      </div>
    );
  }

  const description =
    status.name === "live"
      ? status.payout
        ? `Payments are live. Dues pay out to ${status.payout.bank} ••${status.payout.last4}.`
        : "Payments are live. Dues settle to the association's own bank account."
      : status.name === "needs"
        ? `Stripe needs ${status.needs.length === 1 ? "one more thing" : "a few more things"}: ${joinNeeds(status.needs)}.`
        : status.name === "checking"
          ? "Stripe is checking your details, usually a few minutes."
          : status.name === "error"
            ? "Stripe did not answer. Try again in a moment."
            : "Connect the association to Stripe so residents can pay dues here";

  return (
    <SettingRow title="Accepting payments" description={description}>
      {status.name === "loading" ? (
        <span className="text-footnote text-fg-subtle">Checking…</span>
      ) : status.name === "live" ? (
        <Badge tone="ok">Payments are live</Badge>
      ) : status.name === "checking" ? (
        <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-fg-muted">
          <Hourglass className="size-3.5" aria-hidden />
          Checking
        </span>
      ) : status.name === "error" ? (
        <Button variant="secondary" size="sm" onClick={() => setRefresh((n) => n + 1)}>
          Try again
        </Button>
      ) : (
        <Button variant="primary" size="sm" onClick={openOnboarding} disabled={redirecting}>
          {redirecting ? "Opening…" : "Continue setup"}
        </Button>
      )}
    </SettingRow>
  );
}

/**
 * The grid's columns. Compliance is a page that is switched off for launch,
 * so a column for it would grant access to nothing.
 */
const GRID_AREAS = GRANTABLE.filter((c) => c !== "compliance" || moduleOn("compliance"));

/** A seat's capabilities, in the words on the sidebar. */
const SECTION_NAME: Partial<Record<Capability, string>> = {
  finances: "Finances",
  vendors: "Vendors",
  requests: "Requests",
  communications: "Messages",
  voting: "Meetings",
  documents: "Documents",
  forum: "Community",
  settings: "Settings",
};

function accessSaid(who: string, c: Capability, level: AccessLevel): string {
  const area = CAPABILITY_LABEL[c];
  if (level === "change") return `${who} can now change ${area}.`;
  if (level === "view") return `${who} can now see ${area}.`;
  return `${who} can no longer see ${area}.`;
}

function sectionNames(capabilities: Capability[]): string[] {
  return capabilities.map((c) => SECTION_NAME[c]).filter((n): n is string => Boolean(n));
}

/**
 * One cell of the permissions grid: none, see, change. One press moves it
 * along, so a President never learns a widget; the icon says which it is
 * and the label reads the same aloud.
 */
function AccessControl({
  level,
  disabled,
  label,
  onChange,
}: {
  level: AccessLevel;
  disabled?: boolean;
  label: string;
  onChange: (level: AccessLevel) => void;
}) {
  const words: Record<AccessLevel, string> = { none: "no access", view: "can see", change: "can change" };
  const Icon = level === "change" ? Pencil : level === "view" ? Eye : Minus;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${words[level]}`}
      title={words[level]}
      onClick={() => onChange(NEXT_ACCESS[level])}
      className={cn(
        "press inline-flex size-9 items-center justify-center rounded-lg border transition-colors",
        level === "change" && "border-primary bg-primary text-primary-fg",
        level === "view" && "border-primary/40 bg-primary-soft text-primary",
        level === "none" && "border-border text-fg-subtle hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

const ACTIVITY_PAGE = 20;

function ActivityList({ rows }: { rows: Activity[] }) {
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  if (rows.length === 0) {
    return (
      <p className="px-5 py-6 text-center text-callout text-fg-muted">
        Nothing recorded yet. Appointing a board member, approving a bill or changing a setting
        will show here.
      </p>
    );
  }
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.slice(0, shown).map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3">
            <span className="min-w-[14rem] flex-1 text-body text-fg">{r.summary}</span>
            <span className="text-footnote text-fg-muted">
              {r.actorName}
              <span className="text-fg-subtle"> · </span>
              <span className="tnum">{formatDate(r.at.slice(0, 10), "medium")}</span>
              <span className="tnum text-fg-subtle"> {clockTime(r.at.slice(11, 16))}</span>
            </span>
          </li>
        ))}
      </ul>
      {rows.length > shown ? (
        <div className="border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + ACTIVITY_PAGE)}>
            Show earlier
          </Button>
        </div>
      ) : null}
    </>
  );
}
