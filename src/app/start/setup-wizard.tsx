"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Map as MapIcon, Plus, Trash2, Users } from "lucide-react";
import { Button, Callout, Card } from "@/components/ui/primitives";
import { QuestionFlow, useFlowPosition, type FlowQuestion } from "@/components/app/question-flow";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { US_STATES } from "@/lib/data/library";
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
import { CollectsPicker, OriginPicker, PropertyPicker, SpacesPicker } from "./situation-step";
import { AccountStep, CheckEmailPanel } from "./account-step";
import {
  clearPendingDraft,
  pendingDraftStore,
  restoreDraft,
  savePendingDraft,
} from "@/lib/pending-draft";
import { cn, money } from "@/lib/utils";
import { wordingFor, type Wording } from "@/lib/wording";

/**
 * Setting up an association, one question at a time.
 *
 * An account first, so the person exists before any of the work does and a
 * board that leaves halfway is a lead rather than nothing. Then a dozen short
 * questions, each on its own screen: what the association is called, where
 * it is, what a home pays, what kind of homes, what is shared, who is setting
 * it up, which homes exist, where the money lands. An association needs
 * exactly those things before it can take a dollar. Officers, documents,
 * budgets, reserves and amenities are all real, and every one of them can
 * wait until somebody is logged in and already collecting; the plan asks
 * for them afterwards, the same way.
 *
 * Anything that legitimately has no answer (nothing shared, nothing billed
 * besides dues, no builder to name, no bank statement to hand) has a
 * labelled way past it. Nobody is made to invent an answer to move on.
 *
 * The homes question is the long one, and it is not a roster: in a
 * community still being built there are no residents to import, and in an
 * established one there is no reason to retype a list that already exists
 * somewhere. Either way the homes are generated from numbered ranges, which
 * both kinds of association already know, and owners are attached one at a
 * time afterwards.
 */

type QuestionId =
  | "account"
  | "name"
  | "place"
  | "dues"
  | "property"
  | "spaces"
  | "origin"
  | "collects"
  | "you"
  | "builder"
  | "homes"
  | "bank";

const CADENCES = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "annually", label: "Annually" },
] as const;

/**
 * Which questions exist, in order, for this reader.
 *
 * Somebody already signed in has an account, so they never see that screen.
 * Somebody who said the owners run the place has no builder to name.
 */
function questionIds(signedIn: boolean, draft: CommunityDraft): QuestionId[] {
  const w = wordingFor(draft.propertyType, draft.origin);
  return [
    ...(signedIn ? [] : (["account"] as const)),
    "name",
    "place",
    "dues",
    "property",
    "spaces",
    "origin",
    "collects",
    "you",
    ...(w.fromBuilder ? (["builder"] as const) : []),
    "homes",
    "bank",
  ];
}

export function SetupWizard() {
  const { createCommunity, createRemoteAssociation } = useAppState();
  const auth = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<CommunityDraft>(emptyDraft);
  const signedIn = Boolean(auth.user);
  const ids = questionIds(signedIn, draft);

  const flow = useFlowPosition(signedIn ? "name" : "account");
  // The account question vanishes when a session arrives; land on the first
  // real question rather than on nothing.
  const current = (ids.includes(flow.current as QuestionId) ? flow.current : ids[0]) as QuestionId;
  const index = ids.indexOf(current);

  // Setup finished before they had an account, held through the round trip
  // to their email. Offered back rather than resumed silently, because
  // quietly restoring somebody's half-finished work is its own surprise.
  const pending = useSyncExternalStore(
    (fn) => pendingDraftStore.subscribe(fn),
    () => pendingDraftStore.getSnapshot(),
    () => null,
  );
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Account created on the first step, email not yet confirmed. The account
  // question stays in the list so they can look back at it, but never asks
  // twice.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // Chose to look around without an account. Ends in a browser-only copy.
  const [exploring, setExploring] = useState(false);
  // Finished with the confirmation still outstanding; the draft is held.
  const [sentToEmail, setSentToEmail] = useState(false);

  const canResume = signedIn && Boolean(pending) && !resumeDismissed && current === "name";

  const patch = (next: Partial<CommunityDraft>) => setDraft((d) => ({ ...d, ...next }));

  function forward() {
    const next = ids[Math.min(index + 1, ids.length - 1)];
    // Somebody signed in never typed their name here. Carry it over from the
    // session so the "you" question opens already knowing who they are.
    if (next === "you" && auth.user) {
      const meta = auth.user.user_metadata as { full_name?: string } | undefined;
      patch({
        founder: {
          ...draft.founder,
          name: draft.founder.name || meta?.full_name || "",
          email: draft.founder.email || auth.user.email || "",
        },
      });
    }
    flow.go(next, "forward");
  }
  function back() {
    flow.go(ids[Math.max(index - 1, 0)], "back");
  }

  /**
   * Who founds what, at the end.
   *
   * Signed in: a real association. Account made this session but the email
   * not yet confirmed: the draft is held on the device and created the moment
   * they come back through the link. Looking around: a copy in this browser,
   * and the plan says so. Nobody reaches this without one of the three, and
   * if they somehow do, the account question asks again.
   */
  async function finish() {
    setFailure(null);
    if (!auth.user) {
      if (awaitingConfirmation) {
        savePendingDraft(draft, draft.founder.email.trim());
        setSentToEmail(true);
        return;
      }
      if (exploring) {
        createCommunity(draft);
        router.push("/start/plan");
        return;
      }
      flow.jump("account");
      return;
    }
    setBusy(true);
    try {
      await createRemoteAssociation(draft);
      // Straight to the plan rather than the dashboard. A board that lands on
      // an empty workspace has to work out what to do next; one that lands
      // on a plan is asked, in the order that gets money moving first.
      router.push("/start/plan");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not create the association");
      setBusy(false);
    }
  }

  const w = wordingFor(draft.propertyType, draft.origin);

  const questions = useMemo(() => {
    const byId: Record<QuestionId, FlowQuestion> = {
      account: {
        id: "account",
        group: "You",
        ownsFooter: true,
        body: (
          <AccountStep
            draft={draft}
            patch={patch}
            status={awaitingConfirmation ? "awaiting" : "none"}
            onExplore={() => {
              setExploring(true);
              forward();
            }}
            onCreated={(confirmationPending) => {
              setExploring(false);
              setAwaitingConfirmation(confirmationPending);
              forward();
            }}
            onContinue={forward}
          />
        ),
      },
      name: {
        id: "name",
        group: "Your association",
        title: "What is your association called?",
        detail: "The name residents see when they sign in, and the one on every notice.",
        enterContinues: true,
        canContinue: Boolean(draft.name.trim()),
        body: (
          <Field label="Association name">
            <input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Oak Ridge Homeowners Association"
              className={cn(input, "h-12 text-[17px]")}
              autoFocus
            />
          </Field>
        ),
      },
      place: {
        id: "place",
        group: "Your association",
        title: "Where is it?",
        detail: "The state decides which rules apply to you, so the library can show the right ones.",
        enterContinues: true,
        canContinue: Boolean(draft.city.trim() && draft.state),
        body: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City">
              <input
                value={draft.city}
                onChange={(e) => patch({ city: e.target.value })}
                placeholder="Brier"
                className={input}
                autoFocus
              />
            </Field>
            <Field label="State">
              <select
                value={draft.state}
                onChange={(e) => {
                  const found = US_STATES.find((st) => st.code === e.target.value);
                  patch({ state: e.target.value, stateName: found?.name ?? "" });
                }}
                className={input}
              >
                <option value="">Select a state</option>
                {US_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ),
      },
      dues: {
        id: "dues",
        group: "Your association",
        title: "What does each home pay?",
        detail: "The regular assessment. Special assessments and anything else come later.",
        enterContinues: true,
        canContinue: draft.duesCents > 0,
        body: (
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
                  autoFocus
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
        ),
      },
      property: {
        id: "property",
        group: "Your community",
        title: "What kind of homes?",
        detail:
          "This decides whether the association insures the buildings and whether a reserve study is a legal duty rather than good practice.",
        canContinue: Boolean(draft.propertyType),
        body: <PropertyPicker draft={draft} patch={patch} />,
      },
      spaces: {
        id: "spaces",
        group: "Your community",
        title: "Anything shared that owners use?",
        detail: "Pick what you have. Owners can reserve these once they are listed, and each one is something the reserves will one day replace.",
        skipLabel: "Nothing shared",
        onSkip: () => patch({ sharedSpaces: [] }),
        body: <SpacesPicker draft={draft} patch={patch} />,
      },
      origin: {
        id: "origin",
        group: "Your community",
        title: "Who is setting this up?",
        detail:
          "A builder standing the association up, owners taking it over from the builder, or owners who already run it. None of them asks you to export anything from wherever you are now.",
        canContinue: Boolean(
          draft.origin && (draft.origin !== "existing" || draft.previously),
        ),
        body: <OriginPicker draft={draft} patch={patch} />,
      },
      collects: {
        id: "collects",
        group: "Your community",
        title: "Anything billed besides dues?",
        detail: "Most associations bill one flat amount.",
        body: <CollectsPicker draft={draft} patch={patch} />,
      },
      you: {
        id: "you",
        group: "Homes",
        title: `Which ${w.home} is yours?`,
        detail: "You become President and can appoint the rest of the board later.",
        enterContinues: true,
        // The number keys the register, so everybody gives one. The address
        // is the other way round: an association that has been running for
        // years has one for every home, and a builder's lots may not have
        // theirs from the county yet. Requiring it there stalls the whole
        // setup on a fact nobody has.
        canContinue: Boolean(
          draft.founder.name.trim() &&
            draft.founder.email.trim() &&
            draft.founder.unit.trim() &&
            (w.fromBuilder || draft.founder.address?.trim()),
        ),
        body: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <input
                value={draft.founder.name}
                onChange={(e) => patch({ founder: { ...draft.founder, name: e.target.value } })}
                placeholder="Pat Founder"
                autoComplete="name"
                className={input}
              />
            </Field>
            <Field label="Your email">
              <input
                type="email"
                value={draft.founder.email}
                onChange={(e) => patch({ founder: { ...draft.founder, email: e.target.value } })}
                placeholder="you@example.com"
                autoComplete="email"
                className={input}
              />
            </Field>
            {/* Whichever field the founder actually knows comes first. */}
            {w.fromBuilder ? (
              <>
                <FounderNumber draft={draft} patch={patch} w={w} autoFocus />
                <FounderAddress draft={draft} patch={patch} w={w} />
              </>
            ) : (
              <>
                <FounderAddress draft={draft} patch={patch} w={w} autoFocus />
                <FounderNumber draft={draft} patch={patch} w={w} />
              </>
            )}
          </div>
        ),
      },
      builder: {
        id: "builder",
        group: "Homes",
        title: draft.origin === "builder" ? "Who is building it?" : "Who built it?",
        detail: `Put against every ${w.home} that has not sold yet, because whoever owns it still owes the assessment on it.`,
        enterContinues: true,
        skipLabel: "Not sure yet",
        onSkip: () => patch({ builderName: "" }),
        body: (
          <Field label="Builder name">
            <input
              value={draft.builderName ?? ""}
              onChange={(e) => patch({ builderName: e.target.value })}
              placeholder="Ridgeline Homes"
              className={cn(input, "h-12 text-[17px]")}
              autoFocus
            />
          </Field>
        ),
      },
      homes: {
        id: "homes",
        group: "Homes",
        title:
          draft.origin === "builder"
            ? "Which homes will be in the community?"
            : "Which homes are in the community?",
        detail:
          draft.origin === "builder"
            ? `Give the number ranges from your site plan. Every ${w.home} gets a balance and a vote from day one, whether or not it has sold.`
            : draft.origin === "handover"
              ? `Give the number ranges, including any the builder still owns. Every ${w.home} gets a balance and a vote.`
              : `Give the number ranges you already use. Every ${w.home} gets a balance and a vote, and owner names can come now or later.`,
        // At least one range that produces homes. Without it the plan asks
        // for the register again on the next screen, which reads as the same
        // question twice.
        canContinue: expandPhases(draft.phases ?? [], draft.lotPrefix ?? "").length > 0,
        body: <HomesStep draft={draft} patch={patch} />,
      },
      bank: {
        id: "bank",
        group: "Money",
        title: draft.bankAccount ? "Where dues land" : "Where should dues land?",
        detail: draft.bankAccount
          ? "Connected. You can change this any time in Money."
          : "An account in the association's name. Not a board member's personal account, which most states prohibit.",
        continueLabel: busy ? "Creating" : "Create the association",
        onContinue: () => void finish(),
        // Connecting a bank is the point of this screen, but refusing to let
        // a board finish without one strands anybody whose treasurer holds
        // the account details. The plan asks again.
        skipLabel: draft.bankAccount ? undefined : "Skip for now",
        onSkip: () => void finish(),
        body: (
          <BankStep
            associationName={draft.name}
            account={draft.bankAccount}
            onConnect={(bankAccount) => patch({ bankAccount })}
            onClear={() => patch({ bankAccount: undefined })}
            linked={!auth.user}
          />
        ),
      },
    };
    return byId;
    // Bodies close over the draft and the handlers; rebuilding them on every
    // render is the honest dependency, and cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, awaitingConfirmation, busy, signedIn, w.home, w.Home]);

  if (sentToEmail && !auth.user) {
    return <CheckEmailPanel draft={draft} email={draft.founder.email.trim()} />;
  }

  return (
    <QuestionFlow
      question={questions[current]}
      index={index}
      total={ids.length}
      direction={flow.direction}
      leaving={flow.leaving}
      onBack={index > 0 ? back : undefined}
      onContinue={forward}
      onSkip={() => {
        // Skipping the bank finishes; every other skip just moves on.
        if (current !== "bank") forward();
      }}
      busy={busy}
      failure={failure}
      above={
        canResume && pending ? (
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
                    flow.jump("bank");
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
        ) : null
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* The homes                                                                  */
/* -------------------------------------------------------------------------- */

interface StepProps {
  draft: CommunityDraft;
  patch: (next: Partial<CommunityDraft>) => void;
}

/* -------------------------------------------------------------------------- */
/* Ranges                                                         */
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
    <div className="flex flex-col gap-5">
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
                <form
                  className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveBuyer(home.unit);
                  }}
                >
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
                  <Button type="submit" variant="secondary" size="sm">
                    Save
                  </Button>
                </form>
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

const input =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand";

/**
 * The founder's number and address, ordered and worded by who is asking.
 *
 * Both live on the home record either way. What changes is which one is
 * required and which one can arrive later: a builder keys everything off the
 * plat and the county assigns addresses closer to closing, while an
 * association that is already running has addresses and may never have
 * numbered anything except a condominium.
 */
function FounderNumber({
  draft,
  patch,
  w,
  autoFocus,
}: StepProps & { w: Wording; autoFocus?: boolean }) {
  const hint = w.fromBuilder
    ? draft.origin === "builder"
      ? `As it appears on the site plan. The ${w.homes} on the next screen are numbered the same way.`
      : `As it appears on the plat or the register. The ${w.homes} on the next screen are numbered the same way.`
    : `As it appears on your register. The ${w.homes} on the next screen are numbered the same way.`;
  return (
    <Field label={`${w.Home} number`} hint={hint}>
      <input
        value={draft.founder.unit}
        onChange={(e) => patch({ founder: { ...draft.founder, unit: e.target.value } })}
        placeholder="12"
        className={input}
        autoFocus={autoFocus}
      />
    </Field>
  );
}

function FounderAddress({
  draft,
  patch,
  w,
  autoFocus,
}: StepProps & { w: Wording; autoFocus?: boolean }) {
  return (
    <Field
      label={w.fromBuilder ? "Your home address, if it has one" : "Your home address"}
      hint={
        w.fromBuilder
          ? "Optional until the county assigns it. Buyers can add theirs when they sign up."
          : undefined
      }
    >
      <input
        value={draft.founder.address ?? ""}
        onChange={(e) => patch({ founder: { ...draft.founder, address: e.target.value } })}
        placeholder="1428 Mehr Meadows Lane"
        autoComplete="street-address"
        className={input}
        autoFocus={autoFocus}
      />
    </Field>
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
  // The hint sits outside the label so it never becomes part of the field's
  // accessible name.
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-fg">{label}</span>
        {children}
      </label>
      {hint ? <span className="mt-1 block text-[13px] text-fg-subtle">{hint}</span> : null}
    </div>
  );
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
