"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { STATES } from "@/lib/data/library";
import {
  DEFAULT_ROLE_CAPABILITIES,
  emptyDraft,
  type CommunityDraft,
  type DraftBoardMember,
  type DraftHousehold,
} from "@/lib/data/new-community";
import { cn, money } from "@/lib/utils";

/**
 * Setting up an association.
 *
 * Four steps, in the order a board can actually answer them: who you are, what
 * you charge, who lives here, and who else runs it. Nothing here is optional
 * theatre. Every field either appears on a screen straight afterwards or
 * changes how money is calculated.
 *
 * The roster step is the one that matters. An association's membership register
 * already exists before anyone signs up, so onboarding is about getting that
 * list in rather than waiting for residents to find us.
 */

const STEPS = ["Association", "Assessments", "Households", "Board"] as const;

const CADENCES = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "annually", label: "Annually" },
] as const;

const ROLES = [
  { id: "vice-president", label: "Vice President" },
  { id: "treasurer", label: "Treasurer" },
  { id: "secretary", label: "Secretary" },
] as const;

export function SetupWizard() {
  const { createCommunity } = useAppState();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CommunityDraft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);

  const patch = (next: Partial<CommunityDraft>) => setDraft((d) => ({ ...d, ...next }));

  const complete = useMemo(() => stepComplete(draft), [draft]);
  const canAdvance = complete[step];
  const onLastStep = step === STEPS.length - 1;

  function finish() {
    setSubmitting(true);
    createCommunity(draft);
    router.push("/admin");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <ol className="flex items-center gap-1.5" aria-label="Setup progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              // Going back is always allowed. Going forward is not, because a
              // later step reads answers from an earlier one.
              disabled={index > step && !complete.slice(0, index).every(Boolean)}
              onClick={() => setStep(index)}
              className={cn(
                "flex w-full flex-col gap-1.5 rounded-lg py-1 text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <span
                className={cn(
                  "h-1 w-full rounded-full",
                  index <= step ? "bg-brand" : "bg-border-2",
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-medium",
                  index === step ? "text-fg" : "text-fg-subtle",
                )}
              >
                {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-7">
        {STEPS[step] === "Association" ? <AssociationStep draft={draft} patch={patch} /> : null}
        {STEPS[step] === "Assessments" ? <AssessmentStep draft={draft} patch={patch} /> : null}
        {STEPS[step] === "Households" ? <HouseholdStep draft={draft} patch={patch} /> : null}
        {STEPS[step] === "Board" ? <BoardStep draft={draft} patch={patch} /> : null}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="md"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {onLastStep ? (
          <Button variant="primary" size="md" onClick={finish} disabled={!canAdvance || submitting}>
            <Check className="size-4" />
            {submitting ? "Setting up" : "Create the association"}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
          >
            Continue
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

interface StepProps {
  draft: CommunityDraft;
  patch: (next: Partial<CommunityDraft>) => void;
}

function AssociationStep({ draft, patch }: StepProps) {
  return (
    <Section
      title="What is the association called?"
      detail="This is the name residents see when they sign in."
    >
      <Field label="Association name">
        <input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Oak Ridge Homeowners Association"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City">
          <input
            value={draft.city}
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="Brier"
            className={inputClass}
          />
        </Field>
        <Field label="State" hint="Sets which statutory guidance applies.">
          <select
            value={draft.state}
            onChange={(e) => {
              const found = STATES.find((s) => s.code === e.target.value);
              patch({ state: e.target.value, stateName: found?.name ?? "" });
            }}
            className={inputClass}
          >
            <option value="">Select a state</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Homes in the association" hint="Used for quorum and collection rates.">
        <input
          type="number"
          min={1}
          value={draft.unitCount || ""}
          onChange={(e) => patch({ unitCount: Number(e.target.value) })}
          placeholder="24"
          className={inputClass}
        />
      </Field>

      <hr className="border-border" />

      <Field label="Your name" hint="You become President and hold every capability.">
        <input
          value={draft.founder.name}
          onChange={(e) => patch({ founder: { ...draft.founder, name: e.target.value } })}
          placeholder="Priya Venkatesan"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your email">
          <input
            type="email"
            value={draft.founder.email}
            onChange={(e) => patch({ founder: { ...draft.founder, email: e.target.value } })}
            placeholder="you@example.com"
            className={inputClass}
          />
        </Field>
        <Field label="Your unit">
          <input
            value={draft.founder.unit}
            onChange={(e) => patch({ founder: { ...draft.founder, unit: e.target.value } })}
            placeholder="1"
            className={inputClass}
          />
        </Field>
      </div>
    </Section>
  );
}

function AssessmentStep({ draft, patch }: StepProps) {
  const perYear = draft.duesCadence === "monthly" ? 12 : draft.duesCadence === "quarterly" ? 4 : 1;
  const annual = draft.duesCents * perYear * (draft.unitCount || 0);

  return (
    <Section
      title="What does each home pay?"
      detail="This drives every balance, statement, and delinquency report."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assessment per home">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-fg-subtle">
              $
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.duesCents ? draft.duesCents / 100 : ""}
              onChange={(e) => patch({ duesCents: Math.round(Number(e.target.value) * 100) })}
              placeholder="30.00"
              className={cn(inputClass, "pl-7")}
            />
          </div>
        </Field>
        <Field label="How often">
          <select
            value={draft.duesCadence}
            onChange={(e) => patch({ duesCadence: e.target.value as CommunityDraft["duesCadence"] })}
            className={inputClass}
          >
            {CADENCES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Billed on day">
          <select
            value={draft.dueDay}
            onChange={(e) => patch({ dueDay: Number(e.target.value) })}
            className={inputClass}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {ordinal(d)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Late after day" hint="The last day autopay can be scheduled.">
          <select
            value={draft.lateAfterDay}
            onChange={(e) => patch({ lateAfterDay: Number(e.target.value) })}
            className={inputClass}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {ordinal(d)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {annual > 0 ? (
        <Card className="bg-surface-2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            Annual assessment income
          </p>
          <p className="tnum mt-1 text-[26px] font-semibold leading-none tracking-[-0.02em] text-fg">
            {money(annual, { cents: false })}
          </p>
          <p className="mt-1.5 text-[12px] text-fg-muted">
            {draft.unitCount} homes at {money(draft.duesCents)} {draft.duesCadence}. This becomes
            your first budget line.
          </p>
        </Card>
      ) : null}
    </Section>
  );
}

function HouseholdStep({ draft, patch }: StepProps) {
  const [entry, setEntry] = useState<DraftHousehold>({ name: "", email: "", unit: "" });
  const ready = entry.name.trim() && entry.unit.trim();
  const taken = new Set([draft.founder.unit, ...draft.households.map((h) => h.unit)]);
  const remaining = Math.max(0, draft.unitCount - 1 - draft.households.length);

  function add() {
    if (!ready || taken.has(entry.unit.trim())) return;
    patch({
      households: [
        ...draft.households,
        { name: entry.name.trim(), email: entry.email.trim(), unit: entry.unit.trim() },
      ],
    });
    setEntry({ name: "", email: "", unit: "" });
  }

  return (
    <Section
      title="Who lives here?"
      detail="Your own household is already counted. Add the rest, or add them later from the Homeowners tab."
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_5rem]">
        <input
          value={entry.name}
          onChange={(e) => setEntry({ ...entry, name: e.target.value })}
          placeholder="Household name"
          aria-label="Household name"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={inputClass}
        />
        <input
          type="email"
          value={entry.email}
          onChange={(e) => setEntry({ ...entry, email: e.target.value })}
          placeholder="Email for the invite"
          aria-label="Household email"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={inputClass}
        />
        <input
          value={entry.unit}
          onChange={(e) => setEntry({ ...entry, unit: e.target.value })}
          placeholder="Unit"
          aria-label="Unit"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={inputClass}
        />
      </div>

      {entry.unit.trim() && taken.has(entry.unit.trim()) ? (
        <p className="text-[12px] text-danger">Unit {entry.unit.trim()} is already on the roster.</p>
      ) : null}

      <Button variant="secondary" size="sm" onClick={add} disabled={!ready}>
        <Plus className="size-3.5" />
        Add household
      </Button>

      <RosterList
        rows={[
          { name: `${draft.founder.name || "You"}`, unit: draft.founder.unit, note: "President" },
          ...draft.households.map((h) => ({ name: h.name, unit: h.unit, note: h.email })),
        ]}
        onRemove={(index) =>
          index === 0
            ? undefined
            : patch({ households: draft.households.filter((_, i) => i !== index - 1) })
        }
      />

      {draft.unitCount > 0 ? (
        <p className="text-[12px] text-fg-muted">
          {remaining > 0
            ? `${remaining} more to reach ${draft.unitCount}. You can finish setup without them.`
            : "Every home on the roster."}
        </p>
      ) : null}
    </Section>
  );
}

function BoardStep({ draft, patch }: StepProps) {
  const candidates = draft.households.filter(
    (h) => !draft.board.some((b) => b.unit === h.unit),
  );

  function addRole(household: DraftHousehold, role: DraftBoardMember["role"]) {
    patch({
      board: [
        ...draft.board,
        {
          ...household,
          role,
          capabilities: DEFAULT_ROLE_CAPABILITIES[role],
        },
      ],
    });
  }

  return (
    <Section
      title="Who else runs the association?"
      detail="Give an office to anyone on the roster. You can change what each one can do afterwards."
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-fg">
              {draft.founder.name || "You"}
            </span>
            <span className="text-[11px] text-fg-subtle">Unit {draft.founder.unit}</span>
          </span>
          <Badge tone="brand">President</Badge>
        </div>

        {draft.board.map((member) => (
          <div
            key={member.unit}
            className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-fg">{member.name}</span>
              <span className="text-[11px] text-fg-subtle">Unit {member.unit}</span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone="neutral">{ROLES.find((r) => r.id === member.role)?.label}</Badge>
              <button
                type="button"
                aria-label={`Remove ${member.name} from the board`}
                onClick={() => patch({ board: draft.board.filter((b) => b.unit !== member.unit) })}
                className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>

      {candidates.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-2 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            Add an officer
          </p>
          {candidates.map((household) => (
            <div key={household.unit} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                {household.name}
                <span className="text-fg-subtle"> · Unit {household.unit}</span>
              </span>
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => addRole(household, role.id)}
                  className="rounded-md border border-border-2 px-2 py-1 text-[11px] font-medium text-fg hover:bg-surface-2"
                >
                  {role.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-fg-muted">
          {draft.households.length
            ? "Everyone on the roster already holds an office."
            : "Add households first, or skip this and appoint officers later."}
        </p>
      )}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[14px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand";

function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">{title}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{detail}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

function RosterList({
  rows,
  onRemove,
}: {
  rows: { name: string; unit: string; note?: string }[];
  onRemove: (index: number) => void;
}) {
  if (!rows.length) return null;
  return (
    <Card className="divide-y divide-border overflow-hidden">
      {rows.map((row, index) => (
        <div key={`${row.unit}-${index}`} className="flex items-center gap-3 px-3.5 py-2.5">
          <span className="w-12 shrink-0 text-[11px] font-medium text-fg-subtle">
            Unit {row.unit}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-fg">
              {row.name || "Unnamed household"}
            </span>
            {row.note ? (
              <span className="block truncate text-[11px] text-fg-subtle">{row.note}</span>
            ) : null}
          </span>
          {index > 0 ? (
            <button
              type="button"
              aria-label={`Remove ${row.name}`}
              onClick={() => onRemove(index)}
              className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/** Which steps hold enough to move past. Index matches STEPS. */
function stepComplete(draft: CommunityDraft): boolean[] {
  return [
    Boolean(
      draft.name.trim() &&
        draft.city.trim() &&
        draft.state &&
        draft.unitCount > 0 &&
        draft.founder.name.trim() &&
        draft.founder.email.trim() &&
        draft.founder.unit.trim(),
    ),
    draft.duesCents > 0,
    // A one home association is legal, if unusual, so an empty roster is fine.
    true,
    true,
  ];
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}
