"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Map as MapIcon, Plus, Trash2, Users } from "lucide-react";
import { Button, Callout, Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { STATES } from "@/lib/data/library";
import {
  emptyDraft,
  otherHomes,
  unitCount,
  type CommunityDraft,
  type DraftHousehold,
} from "@/lib/data/new-community";
import {
  expandPhases,
  firstPhase,
  lotsInPhase,
  nextPhase,
  phaseProblems,
  type LotPhase,
} from "@/lib/lots";
import { BankStep } from "./bank-step";
import { SituationStep } from "./situation-step";
import { AccountStep } from "./account-step";
import {
  clearPendingDraft,
  pendingDraftStore,
  restoreDraft,
} from "@/lib/pending-draft";
import { cn, money } from "@/lib/utils";
import { wordingFor } from "@/lib/wording";

/**
 * Setting up an association.
 *
 * Three questions, because an association needs exactly three things before it
 * can take a dollar: who it is and what a home owes, which homes there are, and
 * where the money lands. Officers, documents, budgets, reserves and amenities
 * are all real, and every one of them can wait until somebody is logged in and
 * already collecting.
 *
 * The homes step is the one that has to be fast, and it is not a roster: in a
 * community still being built there are no residents to import, and in an
 * established one there is no reason to retype a list that already exists
 * somewhere. Either way the homes are generated from numbered ranges, which
 * both kinds of association already know, and owners are attached one at a
 * time afterwards.
 */

/**
 * Cheap questions first, the long one third, the highest friction one last.
 *
 * "Situation" sits before "Homes" because it takes twenty seconds and it
 * changes what the rest of setup contains. Connecting a bank is the one people
 * leave to go and fetch a statement for, so it stays at the end where leaving
 * does the least damage.
 */
const STEPS = [
  { id: "association", label: "Association", blurb: "Who you are and what a home pays" },
  { id: "situation", label: "Your place", blurb: "What kind of community this is" },
  { id: "homes", label: "Homes", blurb: "Every home and its number" },
  { id: "bank", label: "Bank", blurb: "Where dues land" },
] as const;

/**
 * Whether the last screen asks for an account.
 *
 * Somebody already signed in has one. Everybody else used to reach the end,
 * press a button, and get an association that existed in their browser and
 * nowhere else, with nothing on screen to suggest otherwise.
 */

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
  // Setup finished before they had an account, held through the round trip
  // to their email. Offered back rather than resumed silently, because
  // quietly restoring somebody's half-finished work is its own surprise.
  const pending = useSyncExternalStore(
    (fn) => pendingDraftStore.subscribe(fn),
    () => pendingDraftStore.getSnapshot(),
    () => null,
  );
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const [done, setDone] = useState<{ id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [askingForAccount, setAskingForAccount] = useState(false);

  const canResume = Boolean(auth.user) && Boolean(pending) && !resumeDismissed && step === 0;

  const patch = (next: Partial<CommunityDraft>) => setDraft((d) => ({ ...d, ...next }));
  const complete = useMemo(() => stepComplete(draft), [draft]);

  /**
   * Every step change goes through here so the transition is one motion:
   * the new section rises in (the `key` below remounts it through
   * `animate-rise`) and the page returns to the top of the wizard, which
   * matters after the homes step has been scrolled three phases deep.
   */
  const top = useRef<HTMLDivElement>(null);
  const goTo = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  /**
   * A signed in person founds a real association. Anyone else builds one in
   * their own browser, which is what makes the product explorable without an
   * account and keeps evaluation data out of the database.
   */
  async function finish(withDraft: CommunityDraft) {
    setFailure(null);
    if (!auth.user) {
      // Not an account yet. Ask, rather than quietly building a copy that
      // only this browser will ever see.
      setAskingForAccount(true);
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

  // Straight to the plan rather than the dashboard. A board that lands on an
  // empty workspace has to work out what to do next; one that lands on a plan
  // is told, in the order that gets money moving first.
  if (done) return <FinishedPanel draft={draft} onOpen={() => router.push("/start/plan")} />;

  if (askingForAccount) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
        <AccountStep
          draft={draft}
          onExplore={() => {
            setAskingForAccount(false);
            setDone({ id: createCommunity(draft).id });
          }}
          onSignedIn={() => {
            setAskingForAccount(false);
            void finish(draft);
          }}
        />
      </div>
    );
  }

  return (
    <div ref={top} className="mx-auto w-full max-w-xl scroll-mt-6 px-5 py-10 sm:py-14">
      <ol className="flex items-stretch gap-2" aria-label="Setup progress">
        {STEPS.map((s, index) => (
          <li key={s.id} className="flex-1">
            <button
              type="button"
              disabled={index > step && !complete.slice(0, index).every(Boolean)}
              onClick={() => goTo(index)}
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
                  "inline-flex items-center gap-1 text-[13px] font-medium",
                  index === step ? "text-fg" : "text-fg-subtle",
                )}
              >
                {index < step && complete[index] ? (
                  <Check className="size-3 text-ok" strokeWidth={3} />
                ) : null}
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {canResume && pending ? (
        <Callout
          tone="ok"
          className="mt-6"
          icon={<Check className="size-4" />}
          title={`Pick up where you left off with ${pending.draft.name || "your association"}`}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setDraft(restoreDraft(pending));
                  clearPendingDraft();
                  setStep(STEPS.length - 1);
                }}
              >
                Restore it
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearPendingDraft();
                  setResumeDismissed(true);
                }}
              >
                Start over
              </Button>
            </div>
          }
        >
          Everything you entered before confirming your email is still here, including{" "}
          {pending.draft.households.length + 1} homes.
        </Callout>
      ) : null}

      <p className="mt-6 text-[13px] font-semibold text-fg-muted">
        Step {step + 1} of {STEPS.length} · {STEPS[step].blurb}
      </p>

      {/* Keyed by step so each section mounts fresh and rises in. */}
      <div key={step} className="animate-rise mt-4">
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
          onClick={() => goTo(Math.max(0, step - 1))}
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
            onClick={() => goTo(step + 1)}
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

/**
 * The homes, generated from numbered ranges rather than imported from a roster.
 *
 * This screen used to be written for a builder and shown to everybody: take
 * them from the plat, who is building it, unsold, none sold yet. A board that
 * has run their own association for fifteen years was being asked to name the
 * developer of a community that finished before they moved in. It read as the
 * wrong product.
 *
 * So it reads the two answers from the previous screen. `wordingFor` decides
 * whether these are lots, units or homes, and whether a builder exists at all;
 * everything below follows from that. What gets stored is identical either
 * way.
 *
 * Every home exists from the first day, sold or not, because an unsold one
 * still owes an assessment and still counts toward a quorum. A setup flow that
 * only creates the occupied ones produces a budget that is short and vote
 * thresholds that are wrong, and both failures are silent.
 */
function HomesStep({ draft, patch }: StepProps) {
  const w = wordingFor(draft.propertyType, draft.origin);
  const phases = draft.phases?.length ? draft.phases : [firstPhase(w.group)];
  const prefix = draft.lotPrefix ?? "";
  const problems = phaseProblems(phases, w.Home);
  const lots = expandPhases(phases, prefix);

  const [namingUnit, setNamingUnit] = useState<string | null>(null);
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  /**
   * How many lots to draw.
   *
   * A subdivision is commonly eighty or ninety lots and almost all of them are
   * unsold during setup, so the full list is scenery a builder has to scroll
   * past to reach the button. It is still reachable, because somebody naming a
   * buyer needs to find their lot.
   */
  const [shown, setShown] = useState(12);

  /**
   * Rebuilds the homes whenever the ranges change.
   *
   * Buyers already recorded against a lot survive, because a builder editing
   * Phase 3 must not lose the four families who closed last month.
   */
  function setPhases(next: LotPhase[], nextPrefix = prefix) {
    const known = new Map(draft.households.map((h) => [h.unit, h]));
    const households: DraftHousehold[] = expandPhases(next, nextPrefix).map(
      (unit) => known.get(unit) ?? { name: "", email: "", unit },
    );
    patch({ phases: next, lotPrefix: nextPrefix, households });
  }

  function editPhase(id: string, change: Partial<LotPhase>) {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }

  function saveBuyer(unit: string) {
    patch({
      households: draft.households.map((h) =>
        h.unit === unit ? { ...h, name: buyer.name.trim(), email: buyer.email.trim() } : h,
      ),
    });
    setNamingUnit(null);
    setBuyer({ name: "", email: "" });
  }

  const mine = draft.founder.unit.trim();
  const sold = otherHomes(draft).filter((h) => h.name.trim()).length;

  return (
    <Section
      title={
        draft.origin === "builder"
          ? "Which homes will be in the community?"
          : "Which homes are in the community?"
      }
      detail={
        draft.origin === "builder"
          ? `Give the number ranges from your site plan. Every ${w.home} gets a balance and a vote from day one, whether or not it has sold.`
          : draft.origin === "handover"
            ? `Give the number ranges, including any the builder still owns. Every ${w.home} gets a balance and a vote.`
            : `Give the number ranges you already use. Every ${w.home} gets a balance and a vote, and owner names can come now or later.`
      }
    >
      <div className="rounded-card border border-border bg-surface-2 p-4">
        <p className="mb-3 text-[13px] font-semibold text-fg-muted">You</p>
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
            placeholder={w.Home}
            aria-label={`Your ${w.home}`}
            className={input}
          />
        </div>
        <p className="mt-2 text-[13px] text-fg-subtle">
          You become President and can appoint the rest of the board later.
        </p>
      </div>

      {/* Only asked where there is one. An association that has run itself
          since 2004 has no builder to name, and being asked for one is what
          made this screen feel like somebody else's product. */}
      {w.fromBuilder ? (
        <Field
          label={draft.origin === "builder" ? "Who is building it?" : "Who built it?"}
          hint={`Put against every ${w.home} that has not sold yet, because whoever owns it still owes the assessment on it.`}
        >
          <input
            value={draft.builderName ?? ""}
            onChange={(e) => patch({ builderName: e.target.value })}
            placeholder="Ridgeline Homes"
            aria-label="Builder name"
            className={input}
          />
        </Field>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label="What goes before the number"
            hint="Optional. It is printed as part of every number."
          >
            <input
              value={prefix}
              onChange={(e) => setPhases(phases, e.target.value)}
              placeholder={w.numberExample}
              aria-label="What goes before the number"
              className={cn(input, "w-32")}
            />
          </Field>
          <p className="pb-1 text-[13px] text-fg-subtle">
            {lots.length > 0
              ? `First one is ${lots[0]}`
              : `For example ${w.numberExample}, Building B or A-`}
          </p>
        </div>

        <Card className="divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[1fr_5rem_5rem_4.5rem_2rem] items-center gap-2 bg-surface-2 px-3.5 py-2 text-[13px] font-semibold text-fg-muted">
            <span>{w.group}</span>
            <span>First</span>
            <span>Last</span>
            <span className="text-right">Homes</span>
            <span />
          </div>
          {phases.map((phase) => {
            const problem = problems.find((p) => p.phaseId === phase.id);
            return (
              <div key={phase.id}>
                <div className="grid grid-cols-[1fr_5rem_5rem_4.5rem_2rem] items-center gap-2 px-3.5 py-2.5">
                  <input
                    value={phase.label}
                    onChange={(e) => editPhase(phase.id, { label: e.target.value })}
                    aria-label={`Name of ${phase.label}`}
                    className={cn(input, "h-9")}
                  />
                  <input
                    type="number"
                    min={1}
                    value={Number.isFinite(phase.from) ? phase.from : ""}
                    onChange={(e) =>
                      editPhase(phase.id, { from: Number.parseInt(e.target.value, 10) })
                    }
                    aria-label={`${phase.label} first lot`}
                    className={cn(input, "h-9 tnum")}
                  />
                  <input
                    type="number"
                    min={1}
                    value={Number.isFinite(phase.to) && phase.to > 0 ? phase.to : ""}
                    onChange={(e) =>
                      editPhase(phase.id, { to: Number.parseInt(e.target.value, 10) })
                    }
                    aria-label={`${phase.label} last lot`}
                    className={cn(input, "h-9 tnum")}
                  />
                  <span className="tnum text-right text-[15px] font-medium text-fg-muted">
                    {problem ? "—" : lotsInPhase(phase)}
                  </span>
                  {phases.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove ${phase.label}`}
                      onClick={() => setPhases(phases.filter((p) => p.id !== phase.id))}
                      className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
                {/* A phase with a problem creates nothing rather than creating
                    half of something. Two Lot 44s bills one home twice. */}
                {problem ? (
                  <p className="px-3.5 pb-2.5 text-[13px] leading-relaxed text-warn">
                    {problem.message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </Card>

        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setPhases([...phases, nextPhase(phases, w.group)])}
        >
          <Plus className="size-3.5" />
          Add another {w.group.toLowerCase()}
        </Button>
      </div>

      {lots.length > 0 ? (
        <Card className="divide-y divide-border overflow-hidden">
          {draft.households.slice(0, shown).map((home) => {
            // The founder's own lot comes out of the plat like any other, and
            // it is already entered above. Offering to sell it to somebody
            // else here is how a builder ends up not owning their own home.
            const isMine = mine !== "" && home.unit === mine;
            return (
            <div key={home.unit} className="px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 truncate text-[13px] font-medium text-fg-subtle">
                  {home.unit}
                </span>
                <span className="min-w-0 flex-1">
                  {isMine ? (
                    <span className="block text-[15px] font-medium text-fg">
                      {draft.founder.name.trim() || "You"}
                      <span className="ml-1.5 text-[13px] font-normal text-fg-subtle">
                        yours
                      </span>
                    </span>
                  ) : home.name.trim() ? (
                    <>
                      <span className="block truncate text-[15px] font-medium text-fg">
                        {home.name}
                      </span>
                      {home.email ? (
                        <span className="block truncate text-[13px] text-fg-subtle">
                          {home.email}
                        </span>
                      ) : (
                        <span className="block text-[13px] text-warn">
                          No email, so no invitation
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="block text-[15px] text-fg-subtle">
                      {w.fromBuilder
                        ? `Not sold yet${draft.builderName?.trim() ? `, ${draft.builderName.trim()}` : ""}`
                        : "No owner listed"}
                    </span>
                  )}
                </span>
                {isMine ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      setNamingUnit(namingUnit === home.unit ? null : home.unit);
                      setBuyer({ name: home.name, email: home.email });
                    }}
                    className="shrink-0 text-[13px] font-medium text-brand hover:underline"
                  >
                    {home.name.trim() ? "Edit" : w.fromBuilder ? "It has sold" : "Add the owner"}
                  </button>
                )}
              </div>

              {namingUnit === home.unit && !isMine ? (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={buyer.name}
                    onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                    placeholder={w.fromBuilder ? "Buyer name" : "Owner name"}
                    aria-label={`Owner of ${home.unit}`}
                    autoFocus
                    className={cn(input, "h-9")}
                  />
                  <input
                    type="email"
                    value={buyer.email}
                    onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
                    placeholder="Email"
                    aria-label={`Email for ${home.unit}`}
                    className={cn(input, "h-9")}
                  />
                  <Button variant="secondary" size="sm" onClick={() => saveBuyer(home.unit)}>
                    Save
                  </Button>
                </div>
              ) : null}
            </div>
            );
          })}
          {draft.households.length > shown ? (
            <button
              type="button"
              onClick={() => setShown(draft.households.length)}
              className="w-full px-3.5 py-3 text-left text-[13px] font-medium text-brand transition-colors hover:bg-surface-2"
            >
              Show the other {draft.households.length - shown} {w.homes}
            </button>
          ) : null}
        </Card>
      ) : null}

      <p className="flex items-center gap-2 text-[13px] text-fg-muted">
        <MapIcon className="size-3.5 shrink-0" />
        {pluralHomes(unitCount(draft))}
        {w.fromBuilder
          ? sold > 0
            ? `, ${sold} sold`
            : ", none sold yet"
          : sold > 0
            ? `, ${sold} with an owner listed`
            : ", no owners listed yet"}
        {draft.duesCents > 0 ? (
          <>
            {" · "}
            {money(draft.duesCents * unitCount(draft), { cents: false })} per {cadenceNoun(draft)}
          </>
        ) : null}
      </p>

      <Callout
        tone="info"
        icon={<Users className="size-4" />}
        title={w.fromBuilder ? "Buyers can wait" : "Owner names can wait"}
      >
        {w.fromBuilder ? (
          <>
            You do not need names now. Add a buyer as each home closes, or invite them from
            the roster later. Until then the {w.home} sits against{" "}
            {draft.builderName?.trim() || "the builder"}, which is who owes the assessment on
            it.
          </>
        ) : (
          <>
            You do not need them now. Add owners here, or invite everyone from the roster
            once you are in. A {w.home} with nobody on it still has a balance and a vote, so
            nothing is missing from your budget while you fill them in.
          </>
        )}
      </Callout>
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
        See what is next
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
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

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
