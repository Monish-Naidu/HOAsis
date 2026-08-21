"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSearch,
  FileText,
  Hammer,
  PartyPopper,
  Paperclip,
} from "lucide-react";
import { Button, Callout, Card, SectionTitle } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import type { HomeRequest, RequestKind } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

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
  const { amenities, forms, addRequest, requests: allRequests } = useAppState();
  const owner = useCurrentOwner();
  const [reference, setReference] = useState("");
  const [kind, setKind] = useState<(typeof kinds)[number]["id"] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amenityId, setAmenityId] = useState("");
  const [formId, setFormId] = useState("");
  const [done, setDone] = useState(false);

  const chosen = kinds.find((k) => k.id === kind);
  const selectedAmenity = amenities.find((a) => a.id === amenityId);
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
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">Request submitted</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">Reference {reference}</p>
          <Link
            href="/resident/requests"
            className="mt-5 flex h-10 items-center justify-center rounded-lg bg-brand text-[13px] font-medium text-brand-fg"
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
        ? `${selectedAmenity.name}. ${body.trim()}`
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
      submittedDate: "2026-08-21",
      attachments:
        kind === "architectural" && selectedForm
          ? [{ name: selectedForm.fileName, size: selectedForm.size }]
          : [],
      thread: [
        {
          id: `rt-${seq}-1`,
          at: "2026-08-21",
          actor: owner.members[0],
          actorRole: "resident",
          body: detail || title.trim(),
          kind: "note",
        },
        {
          id: `rt-${seq}-2`,
          at: "2026-08-21",
          actor: "HOAsis",
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
    <div className="animate-rise space-y-6">
      <Link
        href="/resident/requests"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        Cancel
      </Link>

      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">New request</h1>
        
      </div>

      <section>
        <SectionTitle>Type</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {kinds.map(({ id, label, hint, icon: Icon }) => (
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
              <p className="text-[13px] font-semibold text-fg">{label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{hint}</p>
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
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[14px] text-fg outline-none"
            >
              <option value="">Select an amenity</option>
              {reservable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.maxHours ? ` (up to ${a.maxHours} hours)` : ""}
                </option>
              ))}
            </select>
            {reservable.length === 0 ? (
              <p className="mt-2 text-[12px] text-fg-muted">
                The board has not made any amenities reservable yet.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-fg-subtle">
                The board sets which amenities can be reserved and for how long.
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
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[14px] text-fg outline-none"
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
                    <p className="truncate text-[13px] font-medium text-fg">
                      {selectedForm.fileName}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
                      {selectedForm.description}
                    </p>
                    <p className="mt-1 text-[11px] text-fg-subtle">
                      {selectedForm.size} · updated {formatDate(selectedForm.updatedDate, "long")}
                      {selectedForm.source === "uploaded" ? " · uploaded by the board" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-border-2 px-2 py-1 text-[11px] font-medium text-fg hover:bg-surface"
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
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
              className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
          <label className="block p-4">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Description
            </span>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's going on, where, and since when?"
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
            />
          </label>
          <button
            type="button"
            className="flex w-full items-center gap-2 p-4 text-left text-[13px] font-medium text-fg-muted hover:bg-surface-2"
          >
            <Paperclip className="size-3.5" />
            Add photos or documents
          </button>
        </Card>
      </section>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!ready}
        onClick={submit}
      >
        Submit request
      </Button>
      
    </div>
  );
}
