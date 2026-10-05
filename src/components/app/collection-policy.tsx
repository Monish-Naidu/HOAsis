"use client";

import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { Button, fieldClass } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import {
  DEFAULT_COLLECTION_POLICY,
  policyFor,
  policyProblems,
  type CollectionPolicy,
} from "@/lib/collections";
import { cn, money } from "@/lib/utils";

/**
 * The board's collections policy, where the board can change it.
 *
 * PayHOA and AppFolio both lead with a late fee engine the board configures;
 * ours ran on a default nobody could edit. The ladder itself is unchanged.
 * What the board sets here is the days each rung falls on, the fee the
 * notice carries, and the shortest plan it will accept, and every screen
 * that reads the policy (the ladder, the resident's pay page) reads this.
 *
 * Read-only by default. The numbers are shown as a sentence, because that is
 * how the policy is written in the bylaws and how a treasurer checks it.
 */
export function CollectionPolicyCard() {
  const { community, can, updateSettings } = useAppState();
  const { notify } = useToast();
  const saved = policyFor(community.settings);
  const [draft, setDraft] = useState<CollectionPolicy>(saved);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const problems = policyProblems(draft);
  const isDefault = !community.settings.collectionPolicy;

  const set = (patch: Partial<CollectionPolicy>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    if (problems.length || saving) return;
    // Held until the write is back. A seat that may not change settings used
    // to be told "saved" and "nothing was changed" in the same breath.
    setSaving(true);
    const ok = await updateSettings({ collectionPolicy: draft });
    setSaving(false);
    // A refusal has already been said by the write itself, and the form
    // stays open with what was typed.
    if (!ok) return;
    setEditing(false);
    notify("Collections policy saved", "ok");
  }

  return (
    // Folded by default: the policy is read once a year and changed less
    // often, and open it pushed the dues table off the bottom of the page.
    // A link to #collections-policy still lands on it, and it opens itself
    // while being edited.
    <details
      id="collections-policy"
      open={editing || undefined}
      className="group mt-6 min-w-0 scroll-mt-32 rounded-card border border-border bg-surface shadow-card lg:scroll-mt-24"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold tracking-[-0.01em] text-fg">
            Collections policy
          </span>
          <span className="mt-0.5 block text-footnote leading-snug text-fg-muted">
            {isDefault
              ? "The default steps. Change the days or the fee to match your bylaws."
              : "Your steps. Every household runs the same ones."}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
      </summary>
      {can("finances") && !editing ? (
        <div className="flex justify-end px-5 pb-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(saved);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
      ) : null}

      {editing ? (
        <div className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DayField label="Reminder" value={draft.reminderDay} onChange={(v) => set({ reminderDay: v })} />
            <DayField label="Formal notice" value={draft.lateNoticeDay} onChange={(v) => set({ lateNoticeDay: v })} />
            <DayField label="Final notice" value={draft.demandDay} onChange={(v) => set({ demandDay: v })} />
            <DayField label="Attorney" value={draft.counselDay} onChange={(v) => set({ counselDay: v })} />
            <label className="block">
              <span className="mb-1.5 block text-footnote font-medium text-fg">Late fee</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-fg-subtle">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.lateFeeCents / 100}
                  onChange={(e) => set({ lateFeeCents: Math.round(Number(e.target.value) * 100) })}
                  aria-label="Late fee"
                  className={cn(field, "pl-7")}
                />
              </div>
              <span className="mt-1 block text-footnote text-fg-subtle">Charged once, with the notice</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-footnote font-medium text-fg">Shortest plan</span>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={draft.minimumPlanMonths}
                  onChange={(e) => set({ minimumPlanMonths: Number.parseInt(e.target.value, 10) })}
                  aria-label="Shortest payment plan in months"
                  className={cn(field, "pr-16")}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-footnote text-fg-subtle">
                  months
                </span>
              </div>
              <span className="mt-1 block text-footnote text-fg-subtle">Offered with the final notice</span>
            </label>
          </div>

          {problems.length ? (
            <ul className="mt-3 space-y-1 text-footnote text-warn" role="alert">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => void save()}
              disabled={problems.length > 0 || saving}
            >
              {saving ? "Saving" : "Save policy"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {!isDefault ? (
              <Button
                variant="ghost"
                size="md"
                className="ml-auto"
                onClick={() => setDraft(DEFAULT_COLLECTION_POLICY)}
              >
                Back to the default
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ol className="grid gap-x-6 gap-y-2 px-5 pb-5 sm:grid-cols-2">
          <Rung day={saved.reminderDay} label="Friendly reminder" detail="The amount and how to pay" />
          <Rung
            day={saved.lateNoticeDay}
            label="Formal notice"
            detail={saved.lateFeeCents > 0 ? `Carries the ${money(saved.lateFeeCents)} late fee` : "No late fee"}
          />
          <Rung
            day={saved.demandDay}
            label="Final notice"
            detail={`Offers a plan of at least ${saved.minimumPlanMonths} months`}
          />
          <Rung day={saved.counselDay} label="Attorney" detail="With every notice attached" />
        </ol>
      )}
    </details>
  );
}

const field =
  cn(fieldClass, "tnum");

function DayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-footnote font-medium text-fg">{label}</span>
      <div className="relative">
        <input
          type="number"
          min={1}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
          aria-label={`${label} day`}
          className={cn(field, "pr-24")}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-footnote text-fg-subtle">
          days past due
        </span>
      </div>
    </label>
  );
}

function Rung({ day, label, detail }: { day: number; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="tnum mt-0.5 w-14 shrink-0 text-footnote font-semibold text-fg-muted">
        Day {day}
      </span>
      <span className="min-w-0">
        <span className="block text-body font-medium text-fg">{label}</span>
        <span className="block text-footnote text-fg-subtle">{detail}</span>
      </span>
    </li>
  );
}
