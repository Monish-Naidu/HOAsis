"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Plus, Printer, ShieldQuestion, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Segmented, Select, textareaClass } from "@/components/ui/primitives";
import { EvidenceViewer } from "@/components/app/evidence-viewer";
import { NoticeLetter } from "@/components/app/notice-letter";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import type { Owner, Violation } from "@/lib/types";
import { cn, daysFromToday, formatDate, relativeDays, todayIsoDate } from "@/lib/utils";
import { useHomeLabel } from "@/components/app/use-home-label";

/**
 * Notices, the simple version.
 *
 * A board tells a home that something needs fixing, the home fixes it, the
 * board closes it. Two lists and three actions. The full enforcement queue
 * with neighbour reports, city notices, the stage ladder and reporting
 * patterns still exists behind `enforcement-full` in `lib/modules.ts`; this
 * is what a board sees until they ask for it.
 *
 * What survives from the full version is the part that protects the home:
 * the owner sees exactly these photographs, can say it is fixed, and the
 * board still closes it themselves.
 */

type Tab = "open" | "resolved";

const INPUT =
  cn(textareaClass, "mt-1.5");
const LABEL = "text-footnote font-semibold text-fg-muted";


export function NoticesBoard() {
  // `?open=` from search lands on one notice, expanded, on the right list.
  return (
    <Suspense fallback={null}>
      <Notices />
    </Suspense>
  );
}

function Notices() {
  const placeLabel = useHomeLabel();
  const { community, addNotice, setViolationStage } = useAppState();
  const { notify } = useToast();
  const params = useSearchParams();
  const linked = community.violations.find((v) => v.id === params.get("open"));
  const [tab, setTab] = useState<Tab>(linked?.stage === "cured" ? "resolved" : "open");
  const [openId, setOpenId] = useState<string | null>(linked?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState<Violation | null>(null);

  const today = todayIsoDate();
  const open = community.violations
    .filter((v) => v.stage !== "cured")
    // The owner's word that it is fixed is the board's next job, so it goes
    // to the top. A notice sent today comes next, so the one just sent is
    // seen to have landed rather than sitting under twenty older ones. Then
    // oldest first, because the oldest has waited longest.
    .sort(
      (a, b) =>
        Number(Boolean(b.ownerFixedDate)) - Number(Boolean(a.ownerFixedDate)) ||
        Number(b.openedDate === today) - Number(a.openedDate === today) ||
        a.openedDate.localeCompare(b.openedDate),
    );
  const resolved = community.violations
    .filter((v) => v.stage === "cured")
    .sort((a, b) => (b.resolvedDate ?? b.nextActionDate).localeCompare(a.resolvedDate ?? a.nextActionDate));
  const rows = tab === "open" ? open : resolved;
  const counts = { open: open.length, resolved: resolved.length };

  function resolve(violation: Violation) {
    setViolationStage(violation.id, "cured");
    notify(`Notice for ${placeLabel(violation.unit)} marked resolved.`);
    setOpenId(null);
  }

  return (
    <>
      <PageHeader
        title="Notices"
        description="Notices to homes. Send, print, and close them here."
        action={
          creating ? undefined : (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New notice
            </Button>
          )
        }
      />

      {creating ? (
        <NewNotice
          owners={community.owners}
          onCancel={() => setCreating(false)}
          onSave={(input) => {
            try {
              addNotice(input);
              notify(`Notice sent to ${placeLabel(input.unit)}.`);
              setCreating(false);
              setTab("open");
            } catch (error) {
              notify(error instanceof Error ? error.message : "The notice was not sent. Check the details and try again.", "warn");
            }
          }}
        />
      ) : null}

      <Segmented
        label="Which notices"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setOpenId(null);
        }}
        options={[
          { value: "open", label: "Open", count: counts.open },
          { value: "resolved", label: "Resolved", count: counts.resolved },
        ]}
      />

      <Card className="mt-4">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ShieldQuestion className="size-6" />}
            title={tab === "open" ? "Nothing open" : "Nothing resolved yet"}
            description={
              tab === "open"
                ? "When a home needs to fix something, send a notice. It shows up here and on their side."
                : "Resolved notices are listed here with the day they closed."
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {rows.map((v) => (
              <NoticeRow
                key={v.id}
                violation={v}
                open={openId === v.id}
                onToggle={() => setOpenId(openId === v.id ? null : v.id)}
                onResolve={resolve}
                onPrint={setPrinting}
              />
            ))}
          </div>
        )}
      </Card>

      {printing ? <NoticeLetter violation={printing} onClose={() => setPrinting(null)} /> : null}
    </>
  );
}

function NoticeRow({
  violation,
  open,
  onToggle,
  onResolve,
  onPrint,
}: {
  violation: Violation;
  open: boolean;
  onToggle: () => void;
  onResolve: (violation: Violation) => void;
  onPrint: (violation: Violation) => void;
}) {
  const placeLabel = useHomeLabel();
  const resolved = violation.stage === "cured";
  const fixed = !resolved && Boolean(violation.ownerFixedDate);

  return (
    <div id={`vio-${violation.id}`} className="scroll-mt-32 lg:scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-semibold text-fg">{placeLabel(violation.unit)}</span>
            <span className="text-footnote text-fg-muted">{violation.ownerName}</span>
            {fixed ? (
              <Badge tone="ok" dot={false}>
                <Check className="size-2.5" />
                Owner says fixed
              </Badge>
            ) : null}
            {resolved ? <Badge tone="neutral">Resolved</Badge> : null}
          </div>
          <p className={cn("mt-0.5 text-body text-fg-muted", !open && "line-clamp-1")}>
            {violation.rule}
            {violation.fix ? ` · ${violation.fix}` : ""}
          </p>
          <p className="mt-0.5 text-footnote text-fg-subtle">
            {resolved
              ? `Resolved ${formatDate(violation.resolvedDate ?? violation.nextActionDate)}`
              : // A relative age only while it is recent. "1688 days ago" is a
                // number to decode; the date, with its year, is not.
                daysFromToday(violation.openedDate) >= -60
                ? `Sent ${formatDate(violation.openedDate)} · ${relativeDays(violation.openedDate)}`
                : `Sent ${formatDate(violation.openedDate)}`}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-fg-subtle transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border bg-surface-2/60 px-5 py-4">
          {fixed ? (
            <div className="rounded-lg border border-ok/25 bg-ok-soft px-3 py-2.5 text-footnote leading-relaxed">
              <p className="flex items-center gap-1.5 font-semibold text-ok">
                <Check className="size-3.5" />
                Owner says fixed {formatDate(violation.ownerFixedDate!, "medium")}
              </p>
              <p className="mt-0.5 text-fg-muted">
                {violation.ownerFixedNote ? `"${violation.ownerFixedNote}" ` : ""}
                Check it, then mark the notice resolved if it is.
              </p>
            </div>
          ) : null}

          {/* The words the owner reads on their side and on the letter. */}
          {violation.fix ? (
            <div>
              <p className="text-footnote font-semibold text-fg-muted">What needs fixing</p>
              <p className="mt-0.5 text-body leading-relaxed text-fg">{violation.fix}</p>
            </div>
          ) : null}

          {violation.ruleCitation ? (
            <p className="text-footnote text-fg-subtle">Rule: {violation.ruleCitation}</p>
          ) : null}

          {/* Only a photo with a file is shown. A grey frame holding a sentence
              about a picture that does not exist is not evidence of anything. */}
          {violation.photos.some((p) => p.src) ? (
            <EvidenceViewer photos={violation.photos.filter((p) => p.src)} />
          ) : null}

          {!resolved ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* Secondary: New notice is the page's one filled button. */}
              <Button variant="secondary" size="sm" onClick={() => onResolve(violation)}>
                <Check className="size-3.5" />
                Mark resolved
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onPrint(violation)}>
                <Printer className="size-3.5" />
                Print letter
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NewNotice({
  owners,
  onCancel,
  onSave,
}: {
  owners: Owner[];
  onCancel: () => void;
  onSave: (input: {
    ownerId: string;
    ownerName: string;
    unit: string;
    rule: string;
    fix?: string;
    ruleCitation?: string;
  }) => void;
}) {
  const placeLabel = useHomeLabel();
  const [ownerId, setOwnerId] = useState("");
  const [rule, setRule] = useState("");
  const [what, setWhat] = useState("");
  const [citation, setCitation] = useState("");
  const owner = owners.find((o) => o.id === ownerId);
  const ready = Boolean(owner) && rule.trim().length > 1 && what.trim().length > 3;
  const sorted = [...owners].sort((a, b) =>
    a.unit.localeCompare(b.unit, undefined, { numeric: true }),
  );

  return (
    <Card as="form" onSubmit={(e) => e.preventDefault()} className="mb-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-body font-semibold text-fg">New notice</p>
          <p className="mt-0.5 text-footnote leading-relaxed text-fg-muted">
            The home sees it the moment you send it, with the same words you write here.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-4" />
          Cancel
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Which home</span>
          <Select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            autoFocus
            aria-label="Which home"
            className="mt-1.5 w-full"
          >
            <option value="">Choose a home</option>
            {sorted.map((o) => (
              <option key={o.id} value={o.id}>
                {placeLabel(o.unit)} · {o.displayName}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className={LABEL}>The rule, in a few words</span>
          <input
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            aria-label="The rule"
            placeholder="Trash bins"
            maxLength={80}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Which section, if you want to name it</span>
          <input
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            aria-label="Rule"
            placeholder="CC&Rs 7.2, or leave blank"
            className={INPUT}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={LABEL}>What needs fixing</span>
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            rows={3}
            aria-label="What needs fixing"
            placeholder="Trash cans are out front on non-collection days. Please keep them behind the fence."
            className={INPUT}
          />
        </label>
      </div>
      <div className="mt-4">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!ready}
          onClick={() =>
            owner &&
            onSave({
              ownerId: owner.id,
              ownerName: owner.displayName,
              unit: owner.unit,
              rule,
              fix: what,
              ruleCitation: citation,
            })
          }
        >
          Send notice
        </Button>
      </div>
    </Card>
  );
}
