"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload, Users } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { STATES } from "@/lib/data/library";
import {
  emptyDraft,
  unitCount,
  type CommunityDraft,
  type DraftHousehold,
} from "@/lib/data/new-community";
import { BankStep } from "./bank-step";
import { SituationStep } from "./situation-step";
import { cn, money } from "@/lib/utils";

/**
 * Setting up an association.
 *
 * Three questions, because an association needs exactly three things before it
 * can take a dollar: who it is and what a home owes, which homes there are, and
 * where the money lands. Officers, documents, budgets, reserves and amenities
 * are all real, and every one of them can wait until somebody is logged in and
 * already collecting.
 *
 * The roster step is the one that has to be fast. A board arrives holding a
 * spreadsheet or an email chain, so it accepts a pasted list as readily as it
 * accepts typing, and the roster is the unit count rather than a second number
 * that has to agree with it.
 */

/**
 * Cheap questions first, the long one third, the highest friction one last.
 *
 * "Situation" sits before "Homes" because it takes twenty seconds and it
 * changes what the rest of setup contains. Typing a roster is the longest
 * step, and connecting a bank is the one people leave to fetch a statement
 * for, so it stays at the end where leaving does the least damage.
 */
const STEPS = [
  { id: "association", label: "Association", blurb: "Who you are and what a home pays" },
  { id: "situation", label: "Your place", blurb: "What kind of community this is" },
  { id: "homes", label: "Homes", blurb: "Who lives here" },
  { id: "bank", label: "Bank", blurb: "Where dues land" },
] as const;

const CADENCES = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "annually", label: "Annually" },
] as const;

export function SetupWizard() {
  const { createCommunity, createRemoteAssociation } = useAppState();
  const auth = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CommunityDraft>(emptyDraft);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const patch = (next: Partial<CommunityDraft>) => setDraft((d) => ({ ...d, ...next }));
  const complete = useMemo(() => stepComplete(draft), [draft]);

  /**
   * A signed in person founds a real association. Anyone else builds one in
   * their own browser, which is what makes the product explorable without an
   * account and keeps evaluation data out of the database.
   */
  async function finish(withDraft: CommunityDraft) {
    setFailure(null);
    if (!auth.user) {
      setDone({ id: createCommunity(withDraft).id });
      return;
    }
    setBusy(true);
    try {
      setDone({ id: await createRemoteAssociation(withDraft) });
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Could not create the association",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) return <FinishedPanel draft={draft} onOpen={() => router.push("/admin")} />;

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <ol className="flex items-stretch gap-2" aria-label="Setup progress">
        {STEPS.map((s, index) => (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              disabled={index > step && !complete.slice(0, index).every(Boolean)}
              onClick={() => setStep(index)}
              className="flex w-full flex-col gap-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                className={cn(
                  "h-1 w-full rounded-full transition-colors",
                  index <= step ? "bg-brand" : "bg-border-2",
                )}
              />
              <span
                className={cn(
                  "text-[13px] font-medium",
                  index === step ? "text-fg" : "text-fg-subtle",
                )}
              >
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {step === 0 ? <AssociationStep draft={draft} patch={patch} /> : null}
        {step === 1 ? <SituationStep draft={draft} patch={patch} /> : null}
        {step === 2 ? <HomesStep draft={draft} patch={patch} /> : null}
        {step === 3 ? (
          <BankStep
            associationName={draft.name}
            account={draft.bankAccount}
            onConnect={(bankAccount) => patch({ bankAccount })}
            onClear={() => patch({ bankAccount: undefined })}
          />
        ) : null}
      </div>

      {failure ? (
        <p className="mt-6 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger" role="status">
          {failure}
        </p>
      ) : null}

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

        {step === STEPS.length - 1 ? (
          <div className="flex items-center gap-2">
            {!draft.bankAccount ? (
              // Connecting a bank is the point of this screen, but refusing to
              // let a board finish without one strands anybody whose treasurer
              // holds the account details. The checklist asks again.
              <Button variant="ghost" size="md" onClick={() => void finish(draft)} disabled={busy}>
                Skip for now
              </Button>
            ) : null}
            <Button variant="primary" size="md" onClick={() => void finish(draft)} disabled={busy}>
              <Check className="size-4" />
              {busy ? "Creating" : "Create the association"}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="md"
            onClick={() => setStep((s) => s + 1)}
            disabled={!complete[step]}
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
/* Step 1: the association                                                    */
/* -------------------------------------------------------------------------- */

interface StepProps {
  draft: CommunityDraft;
  patch: (next: Partial<CommunityDraft>) => void;
}

function AssociationStep({ draft, patch }: StepProps) {
  return (
    <Section title="Your association" detail="The name residents see, and what each home pays.">
      <Field label="Association name">
        <input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Oak Ridge Homeowners Association"
          className={input}
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City">
          <input
            value={draft.city}
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="Brier"
            className={input}
          />
        </Field>
        <Field label="State">
          <select
            value={draft.state}
            onChange={(e) => {
              const found = STATES.find((s) => s.code === e.target.value);
              patch({ state: e.target.value, stateName: found?.name ?? "" });
            }}
            className={input}
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

      <hr className="border-border" />

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
        <Field label="Each home pays">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-fg-subtle">
              $
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.duesCents ? draft.duesCents / 100 : ""}
              onChange={(e) => patch({ duesCents: Math.round(Number(e.target.value) * 100) })}
              placeholder="45.00"
              className={cn(input, "pl-7")}
            />
          </div>
        </Field>
        <Field label="How often">
          <select
            value={draft.duesCadence}
            onChange={(e) =>
              patch({ duesCadence: e.target.value as CommunityDraft["duesCadence"] })
            }
            className={input}
          >
            {CADENCES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due on">
          <select
            value={draft.dueDay}
            onChange={(e) => patch({ dueDay: Number(e.target.value) })}
            className={input}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {ordinal(d)}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2: the roster                                                         */
/* -------------------------------------------------------------------------- */

function HomesStep({ draft, patch }: StepProps) {
  const [entry, setEntry] = useState<DraftHousehold>({ name: "", email: "", unit: "" });
  const [bulk, setBulk] = useState("");
  const [pasting, setPasting] = useState(false);

  const taken = new Set([draft.founder.unit.trim(), ...draft.households.map((h) => h.unit)]);
  const canAdd = entry.name.trim() && entry.unit.trim() && !taken.has(entry.unit.trim());

  function add() {
    if (!canAdd) return;
    patch({
      households: [
        ...draft.households,
        { name: entry.name.trim(), email: entry.email.trim(), unit: entry.unit.trim() },
      ],
    });
    setEntry({ name: "", email: "", unit: "" });
  }

  function importPasted() {
    const parsed = parseRoster(bulk).filter((h) => !taken.has(h.unit));
    if (!parsed.length) return;
    patch({ households: [...draft.households, ...parsed] });
    setBulk("");
    setPasting(false);
  }

  const preview = pasting ? parseRoster(bulk) : [];

  return (
    <Section
      title="Who lives here?"
      detail="Start with your own home. Every household gets a balance, a login, and a vote."
    >
      <div className="rounded-card border border-border bg-surface-2 p-4">
        <p className="mb-3 text-[13px] font-semibold text-fg-muted">
          You
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_5.5rem]">
          <input
            value={draft.founder.name}
            onChange={(e) => patch({ founder: { ...draft.founder, name: e.target.value } })}
            placeholder="Your name"
            aria-label="Your name"
            className={input}
          />
          <input
            type="email"
            value={draft.founder.email}
            onChange={(e) => patch({ founder: { ...draft.founder, email: e.target.value } })}
            placeholder="Your email"
            aria-label="Your email"
            className={input}
          />
          <input
            value={draft.founder.unit}
            onChange={(e) => patch({ founder: { ...draft.founder, unit: e.target.value } })}
            placeholder="Unit"
            aria-label="Your unit"
            className={input}
          />
        </div>
        <p className="mt-2 text-[13px] text-fg-subtle">
          You become President and can appoint the rest of the board later.
        </p>
      </div>

      {pasting ? (
        <div className="flex flex-col gap-3">
          <Field
            label="Paste your roster"
            hint="One household per line: name, email, unit. Any order, and a header row is fine."
          >
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={7}
              autoFocus
              placeholder={"Marcus Bell, marcus@example.com, 2\nYuki Tanaka, yuki@example.com, 3"}
              className={cn(input, "h-auto py-2 font-mono text-[13px] leading-relaxed")}
            />
          </Field>
          {/* A board leaving a manager has a file, not a clipboard. Making
              them open it, select all and paste is three steps we can remove. */}
          <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border border-border-2 bg-surface px-3 text-[15px] font-medium text-fg transition-colors hover:bg-surface-2">
            <Upload className="size-4" />
            Choose a CSV instead
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setBulk(await file.text());
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={importPasted} disabled={!preview.length}>
              Add {preview.length ? pluralHomes(preview.length) : "households"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPasting(false)}>
              Cancel
            </Button>
            {bulk.trim() && !preview.length ? (
              <span className="text-[13px] text-warn">
                No lines read as a household yet. Each needs a name and a unit.
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_5.5rem]">
            <input
              value={entry.name}
              onChange={(e) => setEntry({ ...entry, name: e.target.value })}
              placeholder="Household name"
              aria-label="Household name"
              onKeyDown={(e) => e.key === "Enter" && add()}
              className={input}
            />
            <input
              type="email"
              value={entry.email}
              onChange={(e) => setEntry({ ...entry, email: e.target.value })}
              placeholder="Email"
              aria-label="Household email"
              onKeyDown={(e) => e.key === "Enter" && add()}
              className={input}
            />
            <input
              value={entry.unit}
              onChange={(e) => setEntry({ ...entry, unit: e.target.value })}
              placeholder="Unit"
              aria-label="Household unit"
              onKeyDown={(e) => e.key === "Enter" && add()}
              className={input}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={add} disabled={!canAdd}>
              <Plus className="size-3.5" />
              Add household
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPasting(true)}>
              Paste a list instead
            </Button>
            {entry.unit.trim() && taken.has(entry.unit.trim()) ? (
              <span className="text-[13px] text-danger">
                Unit {entry.unit.trim()} is already on the roster.
              </span>
            ) : null}
          </div>
        </div>
      )}

      {draft.households.length ? (
        <Card className="divide-y divide-border overflow-hidden">
          {draft.households.map((h, index) => (
            <div key={h.unit} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="w-14 shrink-0 text-[13px] font-medium text-fg-subtle">
                Unit {h.unit}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-fg">{h.name}</span>
                {h.email ? (
                  <span className="block truncate text-[13px] text-fg-subtle">{h.email}</span>
                ) : (
                  <span className="block text-[13px] text-warn">No email, so no invitation</span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Remove ${h.name}`}
                onClick={() =>
                  patch({ households: draft.households.filter((_, i) => i !== index) })
                }
                className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </Card>
      ) : null}

      <p className="flex items-center gap-2 text-[13px] text-fg-muted">
        <Users className="size-3.5 shrink-0" />
        {pluralHomes(unitCount(draft))} on the roster
        {draft.duesCents > 0 ? (
          <>
            {" · "}
            {money(draft.duesCents * unitCount(draft), { cents: false })} per {cadenceNoun(draft)}
          </>
        ) : null}
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Finished                                                                   */
/* -------------------------------------------------------------------------- */

function FinishedPanel({ draft, onOpen }: { draft: CommunityDraft; onOpen: () => void }) {
  const homes = unitCount(draft);
  return (
    <div className="animate-rise mx-auto w-full max-w-xl px-5 py-14">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
        <Check className="size-6" strokeWidth={2.5} />
      </span>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg">
        {draft.name} is ready to collect.
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
        {pluralHomes(homes)} on the register, {money(draft.duesCents)} {draft.duesCadence} each.
      </p>

      <Card className="mt-6 divide-y divide-border overflow-hidden">
        <Done label={`${pluralHomes(homes)} added`} detail="Each has a balance and a login" />
        <Done
          label={`${money(draft.duesCents)} ${draft.duesCadence} assessment`}
          detail={`Billed on the ${ordinal(draft.dueDay)}`}
        />
        {draft.bankAccount ? (
          <Done
            label={`${draft.bankAccount.institution} ••${draft.bankAccount.mask} connected`}
            detail="Dues land here"
          />
        ) : (
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-warn" />
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-fg">No bank connected yet</span>
              <span className="block text-[13px] text-fg-muted">
                Dues have nowhere to land until you add one. It is the first item on your dashboard.
              </span>
            </span>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <p className="text-[15px] font-semibold text-fg">Next: invite your neighbors</p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          Every household has an invitation link on the Homeowners tab. Copy it and send it
          however you already reach people.
        </p>
      </Card>

      <Button variant="primary" size="lg" className="mt-6 w-full" onClick={onOpen}>
        Open {draft.name}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function Done({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-fg">{label}</span>
        <span className="block text-[13px] text-fg-muted">{detail}</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

const input =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand";

export function Section({
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
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.028em] text-fg">
          {title}
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{detail}</p>
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
      <span className="mb-1.5 block text-[13px] font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[13px] text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Parsing and validation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Reads a pasted roster.
 *
 * Boards arrive with a spreadsheet column, an email chain, or a list someone
 * typed in Notes, so this takes commas or tabs, tolerates a header row, and
 * finds the email wherever it sits rather than demanding a fixed column order.
 * Anything it cannot read is dropped rather than guessed at, and the count it
 * reports is what will actually be added.
 */
/**
 * Splits one line into cells, respecting quotes.
 *
 * A roster exported from anywhere real contains at least one "Smith, John",
 * and splitting that on the comma produces a household called Smith living in
 * unit John. Quoted fields are the difference between an import that works on
 * the file a board actually has and one that works on a file we made up.
 */
function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (ch === "," || ch === "\t" || ch === ";")) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += ch;
  }
  cells.push(cell.trim());
  return cells.filter(Boolean);
}

/** Words that mean this row names columns rather than a person. */
const HEADER_WORDS =
  /^(name|household|owner|owners?[ _-]?name|unit|unit[ _-]?#|lot|address|email|e-?mail|phone|resident|member)$/i;

/**
 * Turns a pasted or uploaded roster into households.
 *
 * Deliberately forgiving about column order, separators and headers, because
 * the file a board has came out of whatever their manager used and will not
 * match any format we specify. What it will reliably contain is a name, a
 * number that is the unit, and sometimes an email, so those are found by shape
 * rather than by position.
 */
export function parseRoster(text: string): DraftHousehold[] {
  const seen = new Set<string>();
  const rows: DraftHousehold[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const cells = splitCells(line);
    if (cells.length < 2) continue;

    // A header names columns. Checking every cell rather than only the first
    // catches "Unit, Owner, Email", which starts with a word we would
    // otherwise mistake for data.
    if (cells.filter((c) => HEADER_WORDS.test(c)).length >= 2) continue;

    const email = cells.find((c) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) ?? "";
    const rest = cells.filter((c) => c !== email);
    // The unit is the last cell that looks like a unit number, which is what a
    // unit is and a name never is.
    const unit =
      [...rest].reverse().find((c) => /^[a-z]?[-#]?\d+[a-z]?$/i.test(c)) ??
      rest[rest.length - 1];
    const name = rest.filter((c) => c !== unit).join(" ").trim();

    if (!name || !unit || seen.has(unit)) continue;
    seen.add(unit);
    rows.push({ name, email, unit });
  }

  return rows;
}

/** Which steps hold enough to move past. Index matches STEPS. */
function stepComplete(draft: CommunityDraft): boolean[] {
  return [
    Boolean(draft.name.trim() && draft.city.trim() && draft.state && draft.duesCents > 0),
    // Both single-answer questions. The two multi-selects are legitimately
    // empty for plenty of associations, so they are not required.
    Boolean(draft.propertyType && draft.origin),
    Boolean(
      draft.founder.name.trim() && draft.founder.email.trim() && draft.founder.unit.trim(),
    ),
    // A board can finish without a bank, and is asked again on the plan.
    true,
  ];
}

function pluralHomes(n: number): string {
  return `${n} ${n === 1 ? "home" : "homes"}`;
}

function cadenceNoun(draft: CommunityDraft): string {
  return draft.duesCadence === "monthly"
    ? "month"
    : draft.duesCadence === "quarterly"
      ? "quarter"
      : "year";
}

export function ordinal(n: number): string {
  const suffix =
    n % 10 === 1 && n !== 11
      ? "st"
      : n % 10 === 2 && n !== 12
        ? "nd"
        : n % 10 === 3 && n !== 13
          ? "rd"
          : "th";
  return `${n}${suffix}`;
}
