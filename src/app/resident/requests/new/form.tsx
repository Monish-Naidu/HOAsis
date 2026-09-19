"use client";

import { useState } from "react";
import { formatSize } from "@/lib/documents";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, Download, FileSearch, FileText, Hammer, Paperclip, PartyPopper, X } from "lucide-react";
import { Button, Callout, Card, SectionTitle } from "@/components/ui/primitives";
import { SlotPicker } from "@/components/app/slot-picker";
import { formatMinute, rulesFor } from "@/lib/bookings";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import type { HomeRequest, RequestKind } from "@/lib/types";
import { cn, formatDate, money, todayIsoDate } from "@/lib/utils";
import { moduleOn } from "@/lib/modules";

const kinds = [
  {
    id: "maintenance",
    label: "Maintenance",
    hint: "Something broken in a common area",
    icon: Hammer,
    clock: "No statutory clock. Most are triaged within 2 business days.",
  },
  {
    id: "architectural",
    label: "Architectural",
    hint: "Change to your home's exterior",
    icon: ClipboardList,
    clock: "CC&Rs Art. VII §3: the committee must answer within 30 days.",
  },
  {
    id: "records",
    label: "Records",
    hint: "Inspect association records",
    icon: FileSearch,
    clock: "Association policy: the board responds within 10 business days.",
    // A statutory records request is not a month-one homeowner action.
    module: "request-records" as const,
  },
  {
    id: "amenity",
    label: "Amenity",
    hint: "Reserve the clubhouse or a court",
    icon: PartyPopper,
    clock: "Reservations are confirmed or declined within 3 days.",
  },
] as const;

export function NewRequestForm() {
  const { amenities, forms, addRequest, community, requests: allRequests } = useAppState();
  const owner = useCurrentOwner();
  const [reference, setReference] = useState("");
  const [kind, setKind] = useState<(typeof kinds)[number]["id"] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amenityId, setAmenityId] = useState("");
  const [formId, setFormId] = useState("");
  const [done, setDone] = useState(false);
  // What the owner attached: names and sizes, which is what the board sees on
  // the request. The bytes themselves wait for request storage.
  const [files, setFiles] = useState<{ name: string; size: string }[]>([]);

  const chosen = kinds.find((k) => k.id === kind);
  const selectedAmenity = amenities.find((a) => a.id === amenityId);
  const [slot, setSlot] = useState<{
    date: string;
    startMinute: number;
    endMinute: number;
  } | null>(null);
  const reservable = amenities.filter((a) => a.reservable);
  const selectedForm = forms.find((f) => f.id === formId);
  const ready =
    Boolean(kind) &&
    Boolean(title.trim()) &&
    (kind !== "amenity" || Boolean(amenityId)) &&
    (kind !== "architectural" || Boolean(formId));

  if (done) {
    return (
      <div className="animate-rise space-y-5">
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">Request submitted</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">Reference {reference}</p>
          <Link
            href="/resident/requests"
            className="mt-5 flex h-10 items-center justify-center rounded-lg bg-brand text-[15px] font-medium text-brand-fg"
          >
            Track it
          </Link>
        </Card>
        {chosen ? (
          <Callout tone="info" title="Response clock started">
            {chosen.clock}
          </Callout>
        ) : null}
      </div>
    );
  }

  function submit() {
    if (!owner || !kind) return;
    const seq = 200 + allRequests.length;
    const ref = `REQ-2026-${seq}`;
    const detail =
      kind === "amenity" && selectedAmenity
        ? `${selectedAmenity.name}${
            slot
              ? `, ${formatDate(slot.date, "medium")} at ${formatMinute(slot.startMinute)}`
              : ""
          }${
            // The fee rides in the request itself, so the board's approval
            // and the owner's statement line say the same number.
            rulesFor(selectedAmenity).feeCents
              ? `, ${money(rulesFor(selectedAmenity).feeCents!)} booking fee`
              : ""
          }. ${body.trim()}`
        : kind === "architectural" && selectedForm
          ? `${selectedForm.label}. ${body.trim()}`
          : body.trim();

    const request: HomeRequest = {
      id: `req-${seq}`,
      reference: ref,
      kind: kind as RequestKind,
      title: title.trim(),
      summary: detail || title.trim(),
      ownerId: owner.id,
      ownerName: owner.displayName,
      unit: owner.unit,
      status: "submitted",
      submittedDate: todayIsoDate(),
      attachments: [
        ...(kind === "architectural" && selectedForm
          ? [{ name: selectedForm.fileName, size: selectedForm.size }]
          : []),
        ...files,
      ],
      thread: [
        {
          id: `rt-${seq}-1`,
          at: todayIsoDate(),
          actor: owner.members[0],
          actorRole: "resident",
          body: detail || title.trim(),
          kind: "note",
        },
        {
          id: `rt-${seq}-2`,
          at: todayIsoDate(),
          actor: "Your HOAsis",
          actorRole: "system",
          body: chosen ? chosen.clock : "Routed to the board.",
          kind: "status",
        },
      ],
    };
    addRequest(request);
    setReference(ref);
    setDone(true);
  }

  return (
    <form className="animate-rise space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Link
        href="/resident/requests"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        Cancel
      </Link>

      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">New request</h1>
        
      </div>

      <section>
        <SectionTitle>Type</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {kinds.filter((k) => moduleOn("module" in k ? k.module : undefined)).map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={cn(
                "rounded-card border p-3 text-left transition-colors",
                kind === id
                  ? "border-navy-700 bg-brand-soft dark:border-navy-300"
                  : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              <Icon className="mb-2 size-4 text-fg-muted" />
              <p className="text-[15px] font-semibold text-fg">{label}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{hint}</p>
            </button>
          ))}
        </div>
      </section>

      {chosen ? (
        <Callout tone="info" title={chosen.clock} />
      ) : null}

      {kind === "amenity" ? (
        <section>
          <SectionTitle>Which amenity</SectionTitle>
          <Card className="p-4">
            <select
              value={amenityId}
              onChange={(e) => setAmenityId(e.target.value)}
              aria-label="Amenity"
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            >
              <option value="">Select an amenity</option>
              {reservable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {reservable.length === 0 ? (
              <p className="mt-2 text-[13px] text-fg-muted">
                The board has not made any amenities reservable yet.
              </p>
            ) : selectedAmenity ? (
              // The rules are applied rather than described, so a resident
              // never picks a time they are not allowed to have.
              <div className="mt-3">
                <SlotPicker
                  amenity={selectedAmenity}
                  bookings={community.amenityBookings}
                  unit={owner?.unit ?? ""}
                  value={slot}
                  onChange={setSlot}
                />
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-fg-subtle">
                Pick one and we will show you what times are free.
              </p>
            )}
          </Card>
        </section>
      ) : null}

      {kind === "architectural" ? (
        <section>
          <SectionTitle>Which form</SectionTitle>
          <Card className="p-4">
            <select
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              aria-label="Architectural form"
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[15px] text-fg outline-none"
            >
              <option value="">Select a form</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            {selectedForm ? (
              <div className="mt-3 rounded-lg bg-surface-2 p-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-fg">
                      {selectedForm.fileName}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">
                      {selectedForm.description}
                    </p>
                    <p className="mt-1 text-[13px] text-fg-subtle">
                      {selectedForm.size} · updated {formatDate(selectedForm.updatedDate, "long")}
                      {selectedForm.source === "uploaded" ? " · uploaded by the board" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-border-2 px-2 py-1 text-[13px] font-medium text-fg hover:bg-surface"
                  >
                    <Download className="mr-1 inline size-3" />
                    Open
                  </button>
                </div>
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle>Details</SectionTitle>
        <Card className="divide-y divide-border">
          <label className="block p-4">
            <span className="mb-1.5 block text-[13px] font-semibold text-fg-muted">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
              className="w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
          <label className="block p-4">
            <span className="mb-1.5 block text-[13px] font-semibold text-fg-muted">
              Description
            </span>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's going on, where, and since when?"
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
          <label className="flex w-full cursor-pointer items-center gap-2 p-4 text-left text-[15px] font-medium text-fg-muted hover:bg-surface-2">
            <Paperclip className="size-3.5" />
            {files.length ? "Add another" : "Add photos or documents"}
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              aria-label="Add photos or documents"
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).map((f) => ({
                  name: f.name,
                  size: formatSize(f.size),
                }));
                e.target.value = "";
                if (picked.length) setFiles((all) => [...all, ...picked]);
              }}
            />
          </label>
          {files.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-fg">{f.name}</span>
                  <span className="shrink-0 text-fg-subtle">{f.size}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                    className="shrink-0 text-fg-subtle hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </section>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!ready}
        onClick={submit}
      >
        Submit request
      </Button>
    </form>
  );
}
