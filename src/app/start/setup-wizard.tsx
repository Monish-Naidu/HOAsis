"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Map as MapIcon, Plus, Trash2, Users } from "lucide-react";
import { Button, Callout, Card, fieldClass, textareaClass } from "@/components/ui/primitives";
import { QuestionFlow, useFlowPosition, type FlowQuestion } from "@/components/app/question-flow";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { US_STATES } from "@/lib/data/library";
import {
  defaultHomeNaming,
  draftDuesTotal,
  placeFounder,
  draftOwnDuesCount,
  emptyDraft,
  founderHomeType,
  finalizeDraft,
  founderLabel,
  founderUnit,
  homesAnswered,
  otherHomes,
  unitCount,
  type CommunityDraft,
  type DraftHousehold,
  type HomeNaming,
  type PropertyType,
  draftNameProblem,
  draftOwnDuesProblem,
} from "@/lib/data/new-community";
import {
  expandPhases,
  firstPhase,
  lotsInPhase,
  nextPhase,
  phaseProblems,
  rebuildLotHomes,
  sortParked,
  type LotPhase,
} from "@/lib/lots";
import { HOME_TYPE_LABEL, homeTypesOf, isMixed } from "@/lib/home-types";
import { OriginPicker, PropertyPicker, SpacesPicker } from "./situation-step";
import { AccountStep, CheckEmailPanel } from "./account-step";
import { RosterImport } from "./roster-import";
import {
  MONTHS,
  booksOf,
  extrasOf,
  householdsNeedingBooks,
  nextDueOnOrAfter,
  wallToday,
  withBooks,
  type Books,
} from "./books";
import { importRoster, setBooksStart } from "@/lib/roster/apply";
import { connectLinkedAccount } from "@/lib/payments/bank-accounts";
import { SameNameNote } from "@/components/app/same-name-note";
import {
  clearPendingDraft,
  pendingDraftStore,
  restoreDraft,
  savePendingDraft,
} from "@/lib/pending-draft";
import {
  HOME_NUMBER_MESSAGE,
  MAX_ASSOCIATION_NAME,
  associationNameProblem,
  duesProblem,
  emailProblem,
  lateFeeAmountProblem,
  lateFeeDaysProblem,
  pasteSummary,
  rangeEndProblem,
  sortPastedAddresses,
} from "@/lib/input-checks";
import { cn, money } from "@/lib/utils";
import { wordingFor, type Wording } from "@/lib/wording";
import {
  clearProgress,
  forgetRead,
  parseProgress,
  readProgressOnce,
  saveProgress,
  type WizardProgress,
} from "./wizard-progress";

/**
 * Setting up an association, one question at a time.
 *
 * An account first, so the person exists before any of the work does and a
 * board that leaves halfway is a lead rather than nothing. Then a few short
 * questions, each on its own screen: what the association is called, where
 * it is, who is setting it up, what kind of homes, what a home pays, what is
 * shared, which homes exist, when billing starts. Officers, documents,
 * budgets, reserves and amenities are all real, and every one of them can
 * wait until somebody is logged in and already collecting; the plan asks
 * for them afterwards, the same way. So does turning on online payments:
 * nothing here connects a bank or says payments are on.
 *
 * Anything that legitimately has no answer (nothing shared) has a labelled
 * way past it. Nobody is made to invent an answer to move on.
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
  | "origin"
  | "property"
  | "dues"
  | "spaces"
  | "you"
  | "homes"
  | "books";

const CADENCES = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "annually", label: "Annually" },
] as const;

/**
 * Which questions exist, in order.
 *
 * Somebody already signed in has an account, so they never see that screen.
 */
function questionIds(signedIn: boolean): QuestionId[] {
  return [
    ...(signedIn ? [] : (["account"] as const)),
    "name",
    "place",
    // Who is setting this up comes first of the community questions: it
    // sets the words on every screen after it.
    "origin",
    // Kinds of home before dues, so a mixed community can say what each
    // kind pays on the dues screen instead of being asked twice.
    "property",
    "dues",
    "spaces",
    "you",
    "homes",
    // Last, because it talks about balances that come in with the homes.
    // It ends in Create.
    "books",
  ];
}

/** Nothing to subscribe to: the saved progress is read once, see `readProgressOnce`. */
const noSubscription = () => () => {};
/** What the server and the hydrating client see, before storage can be read. */
const NOT_READ = "not-read";

/**
 * The wizard, with its answers carried across a reload.
 *
 * The page is prerendered, so the first render cannot know what this tab
 * saved. It renders the empty wizard with saving held off; once hydrated,
 * the saved progress is read, and if there is any the wizard remounts on it
 * once. Saving starts only after that read, so the empty first render can
 * never overwrite the answers it is about to restore.
 */
export function SetupWizard() {
  const raw = useSyncExternalStore(noSubscription, readProgressOnce, () => NOT_READ);
  const hydrated = raw !== NOT_READ;
  const restored = hydrated ? parseProgress(raw) : null;
  return (
    <WizardQuestions key={restored ? "restored" : "fresh"} restored={restored} persist={hydrated} />
  );
}

function WizardQuestions({
  restored,
  persist,
}: {
  restored: WizardProgress | null;
  persist: boolean;
}) {
  const { createCommunity, createRemoteAssociation } = useAppState();
  const auth = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<CommunityDraft>(() => restored?.draft ?? emptyDraft());
  const signedIn = Boolean(auth.user);
  const ids = questionIds(signedIn);

  const flow = useFlowPosition(restored?.current ?? (signedIn ? "name" : "account"));
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
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(
    restored?.awaitingConfirmation ?? false,
  );
  // Chose to look around without an account. Ends in a browser-only copy.
  const [exploring, setExploring] = useState(restored?.exploring ?? false);
  // Finished with the confirmation still outstanding; the draft is held.
  const [sentToEmail, setSentToEmail] = useState(false);

  // Every answer, and where the reader is, written as it changes so a reload
  // lands back on the same question with the same answers. Writing to
  // storage only; nothing here sets state.
  useEffect(() => {
    if (!persist || sentToEmail) return;
    saveProgress({ draft, current, exploring, awaitingConfirmation });
  }, [persist, sentToEmail, draft, current, exploring, awaitingConfirmation]);
  // The next visit to /start reads storage afresh rather than this visit's
  // first read.
  useEffect(() => forgetRead, []);

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
        // The pending draft holds it from here, through the email round trip.
        savePendingDraft(finalizeDraft({ ...draft, bankAccount: undefined }), draft.founder.email.trim());
        clearProgress();
        setSentToEmail(true);
        return;
      }
      if (exploring) {
        // The look-around copy has the one account its Finances screens need,
        // plainly named. It is not connected to anything: money goes through
        // Stripe, set up after founding.
        createCommunity(
          finalizeDraft({
            ...draft,
            bankAccount: connectLinkedAccount(
              { institution: "Operating account", mask: "", kind: "operating" },
              wallToday(),
            ),
          }),
        );
        clearProgress();
        router.push("/start/plan");
        return;
      }
      flow.jump("account");
      return;
    }
    setBusy(true);
    try {
      // No bank from this wizard, even one left in a draft saved by an older
      // version of it.
      const final = finalizeDraft({ ...draft, bankAccount: undefined });
      const associationId = await createRemoteAssociation(final);
      // The fiscal year, the first bill, and what each home owed: none of it
      // is a founding parameter, so it lands right after, keyed by the
      // labels create_association just gave the homes. A failure here is
      // not a failed founding; the association exists and Homeowners can
      // redo the balances. Refounding on retry would make two.
      try {
        const today = wallToday();
        const books = booksOf(draft, today);
        await setBooksStart(associationId, {
          fiscalYearStart: books.fiscalYearStart,
          // The date the question showed, whether or not the board touched
          // it, so the record says exactly what they were told.
          billingStartsOn:
            books.billingStartsOn ??
            nextDueOnOrAfter(today, draft.dueDay, draft.duesCadence, books.fiscalYearStart),
        });
        const rows = householdsNeedingBooks(final);
        if (rows.length) {
          await importRoster(
            associationId,
            rows.map((h) => ({
              line: 0,
              name: h.name,
              email: h.email,
              unit: h.unit,
              address: h.address ?? "",
              phone: h.phone ?? "",
              openingBalanceCents: h.openingBalanceCents,
              problems: [],
            })),
            books.openingAsOf,
          );
        }
      } catch (error) {
        console.error("[hoasis] books follow-up after founding failed", error);
      }
      clearProgress();
      // Straight to the plan rather than the dashboard. A board that lands on
      // an empty workspace has to work out what to do next; one that lands
      // on a plan is asked, in the order that gets money moving first.
      router.push("/start/plan");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The association could not be created. Try again.");
      setBusy(false);
    }
  }

  const w = wordingFor(homeTypesOf(draft), draft.origin);
  const byNumber = (draft.homeNaming ?? defaultHomeNaming(draft)) === "numbers";

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
        canContinue: Boolean(draft.name.trim()) && !draftNameProblem(draft),
        body: (
          <Field label="Association name" error={associationNameProblem(draft.name)}>
            <input
              value={draft.name}
              maxLength={MAX_ASSOCIATION_NAME}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Oak Ridge Homeowners Association"
              className={cn(input, "h-12 text-headline")}
              autoFocus
            />
            <SameNameNote name={draft.name} />
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
        group: "Your community",
        title: "What does each home pay?",
        detail: isMixed(draft)
          ? "The regular dues. Kinds of home can pay different amounts."
          : "The regular dues. Special assessments and anything else come later.",
        enterContinues: true,
        canContinue:
          duesProblem(draft.duesCents) === null &&
          (!draft.duesByType || homeTypesOf(draft).every((t) => duesProblem(draft.duesByType?.[t] ?? 0) === null)) &&
          !draftOwnDuesProblem(draft) &&
          lateFeeAnswered(draft),
        body: (
          <div className="flex flex-col gap-4">
            <DuesMode draft={draft} patch={patch} />
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_7rem]">
            {draft.duesByType ? null : (
            <DollarField
              label={draft.duesByHome ? "Most homes pay" : "Each home pays"}
              hint={
                draft.duesByHome
                  ? "A range or a home that pays something else is set when you list the homes."
                  : undefined
              }
              cents={draft.duesCents}
              onCents={(cents) => patch({ duesCents: cents ?? 0 })}
              problem={(cents) => (cents === undefined ? null : duesProblem(cents))}
              placeholder="45.00"
              autoFocus
            />
            )}
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
          <LateFee draft={draft} patch={patch} />
          </div>
        ),
      },
      property: {
        id: "property",
        group: "Your community",
        title: "What kind of homes?",
        detail:
          "Pick every kind you have. It decides who insures the buildings and whether a reserve study is a legal duty.",
        canContinue: homeTypesOf(draft).length > 0,
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
        detail: "This sets the words on every screen after this one.",
        canContinue: Boolean(
          draft.origin && (draft.origin !== "existing" || draft.previously),
        ),
        body: <OriginPicker draft={draft} patch={patch} />,
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
        // Where homes are entered by number, the founder's number is what
        // places them among those homes, so everybody gives one. A blank
        // one made the founder an extra home. A builder gives only the
        // number. Everywhere else the address is what the founder knows,
        // and the number is optional because plenty of communities never
        // numbered anything.
        canContinue: Boolean(
          draft.founder.name.trim() &&
            draft.founder.email.trim() &&
            emailProblem(draft.founder.email) === null &&
            (byNumber ? draft.founder.unit.trim() : true) &&
            (w.fromBuilder ? true : draft.founder.address?.trim()),
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
            <Field
              label="Your email"
              error={draft.founder.email.trim() ? emailProblem(draft.founder.email) : null}
            >
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
                <FounderNumber draft={draft} patch={patch} w={w} required autoFocus />
                <FounderAddress draft={draft} patch={patch} w={w} />
              </>
            ) : (
              <>
                <FounderAddress draft={draft} patch={patch} w={w} autoFocus />
                <FounderNumber draft={draft} patch={patch} w={w} required={byNumber} />
              </>
            )}
          </div>
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
          (draft.homeNaming ?? defaultHomeNaming(draft)) === "addresses"
            ? `List each ${w.home} by its address. Owner names and emails can come now or later, and every ${w.home} gets a balance and a vote either way.`
            : draft.origin === "builder"
              ? `Give the number ranges from your site plan. Every ${w.home} gets a balance and a vote from day one, whether or not it has sold.`
              : draft.origin === "handover"
                ? `Give the number ranges, including any the builder still owns. Every ${w.home} gets a balance and a vote.`
                : `Give the number ranges you already use. Every ${w.home} gets a balance and a vote, and owner names can come now or later.`,
        // Ranges must produce at least one home, and no row with an owner or
        // a balance may be left outside them unanswered: creating the
        // association drops those rows (`homesAnswered`).
        canContinue: homesAnswered(draft),
        body: <HomesStep draft={draft} patch={patch} />,
      },
      books: {
        id: "books",
        group: "Money",
        title: "When should billing start?",
        detail: "The date of the first bill sent from here, and the month your budget year starts.",
        continueLabel: busy ? "Creating" : "Create the association",
        onContinue: () => void finish(),
        body: <BooksStep draft={draft} patch={patch} />,
      },
    };
    return byId;
    // Bodies close over the draft and the handlers; rebuilding them on every
    // render is the honest dependency, and cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, awaitingConfirmation, busy, signedIn, w.home, w.Home, byNumber]);

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
      onSkip={forward}
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
                    flow.jump("books");
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
  const w = wordingFor(homeTypesOf(draft), draft.origin);
  const naming = draft.homeNaming ?? defaultHomeNaming(draft);

  function setNaming(next: HomeNaming) {
    if (next === naming) return;
    // Switching ways of naming homes starts the list over. Rows built from
    // ranges are not addresses and addresses are not ranges; carrying one
    // into the other produces a roster nobody typed. The rows parked
    // outside the ranges go with them, for the same reason.
    patch({
      homeNaming: next,
      households: [],
      parkedHouseholds: undefined,
      phases: undefined,
      lotPrefix: undefined,
    });
  }

  const modes = (
    <div
      className="inline-flex w-fit gap-1 rounded-xl bg-surface-2 p-1"
      role="radiogroup"
      aria-label="How homes are named"
    >
      {(
        [
          { id: "addresses", label: "By address" },
          { id: "numbers", label: `By ${w.home} number` },
        ] as { id: HomeNaming; label: string }[]
      ).map((mode) => (
        <button
          key={mode.id}
          type="button"
          role="radio"
          aria-checked={naming === mode.id}
          onClick={() => setNaming(mode.id)}
          className={cn(
            "rounded-lg px-3.5 py-2 text-body font-medium transition-colors",
            naming === mode.id ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );

  // The spreadsheet a board already keeps, either way the homes are named.
  const importer = <RosterImport draft={draft} patch={patch} homeWord={w.home} />;

  if (naming === "addresses") {
    // Rows parked while this list went by number. The switch above clears
    // them, but the naming also follows the kinds of home and the origin
    // until it is pressed, so going Back can land here with rows still
    // parked. Creating the association drops them, so they are shown and
    // Continue waits (`homesAnswered`).
    const parked = draft.parkedHouseholds ?? [];
    return (
      <div className="flex flex-col gap-5">
        {modes}
        {importer}
        <AddressList draft={draft} patch={patch} w={w} />
        {parked.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-footnote leading-relaxed text-warn">
              {parked.length} {parked.length === 1 ? "row" : "rows"} from your file{" "}
              {parked.length === 1 ? "is" : "are"} not on this list (
              {parked
                .slice(0, 3)
                .map((h) => h.unit)
                .join(", ")}
              {parked.length > 3 ? ` and ${parked.length - 3} more` : ""}).{" "}
              {parked.length === 1 ? "It was" : "They were"} set aside while {w.homes} went by
              number. Add any that belong to the list above.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => patch({ parkedHouseholds: undefined })}
              >
                Leave {parked.length === 1 ? "this" : "these"} out
              </Button>
              <span className="text-footnote text-fg-muted">
                Leave {parked.length === 1 ? "it" : "them"} out to continue.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {modes}
      {importer}
      <RangesStep draft={draft} patch={patch} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The books                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Where the books start.
 *
 * Three dates, and the daily dues run reads two of them. The fiscal year
 * decides when quarters and years begin. The first bill is the first due
 * date this product bills; a board that imports on the 10th with balances
 * that already hold this month's dues picks next month, and nothing is
 * billed twice. The as-of date is the day the opening balances are true,
 * which is the day the treasurer read them off the old books.
 */
function BooksStep({ draft, patch }: StepProps) {
  const today = wallToday();
  const books = booksOf(draft, today);
  const set = (next: Partial<Books>) => patch(withBooks(draft, { ...books, ...next }));
  const fyMonth = Number(books.fiscalYearStart.slice(0, 2)) || 1;
  const suggested = nextDueOnOrAfter(today, draft.dueDay, draft.duesCadence, books.fiscalYearStart);
  const existing = draft.origin === "existing";
  // The homes question came first, so a balance column may already be in.
  const hasBalances = draft.households.some((h) => extrasOf(h).openingBalanceCents !== undefined);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="First bill goes out on"
          hint="We suggest the next due date. Pick a later one if owners were already billed for that period."
        >
          <input
            type="date"
            value={books.billingStartsOn ?? suggested}
            min={today}
            onChange={(e) => set({ billingStartsOn: e.target.value || null })}
            className={input}
            autoFocus
          />
        </Field>
        <Field label="Budget year starts in" hint="Most associations use January.">
          <select
            value={fyMonth}
            onChange={(e) => set({ fiscalYearStart: `${String(e.target.value).padStart(2, "0")}-01` })}
            className={input}
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        {existing ? (
          <Field
            label="Date of the balances you are bringing over"
            hint="The day you read what each home owes from your old records."
          >
            <input
              type="date"
              value={books.openingAsOf}
              max={today}
              onChange={(e) => set({ openingAsOf: e.target.value || today })}
              className={input}
            />
          </Field>
        ) : null}
      </div>
      {existing ? (
        <Callout tone="info" title="Opening balances">
          {hasBalances
            ? "Balances came in with your spreadsheet"
            : "You can enter what each home owes after setup, under Homeowners."}
        </Callout>
      ) : null}
    </div>
  );
}

/**
 * Homes as a plain list of addresses.
 *
 * The founder's own home is the first row and comes from the previous
 * screen. Every other row is an address with an owner if the board knows
 * one. The address is the register key, because a community that never
 * numbered its homes has nothing else to key on, and inventing numbers for
 * them is a roster nobody recognises.
 */
function AddressList({ draft, patch, w }: StepProps & { w: Wording }) {
  const types = homeTypesOf(draft);
  const mixed = types.length > 1;
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const mine = founderUnit(draft);
  const rows = draft.households;
  // One more column for the amount, only while the board bills by home.
  const byHome = Boolean(draft.duesByHome);
  const cols = byHome
    ? "sm:grid-cols-[1.4fr_1fr_1fr_7rem_2rem]"
    : "sm:grid-cols-[1.4fr_1fr_1fr_2rem]";

  function setRows(next: DraftHousehold[]) {
    patch({ households: next });
  }

  function editRow(index: number, change: Partial<DraftHousehold>) {
    setRows(
      rows.map((row, i) => {
        if (i !== index) return row;
        const merged = { ...row, ...change };
        // The address is the key, so they move together.
        if (change.address !== undefined) merged.unit = change.address;
        return merged;
      }),
    );
  }

  function addRow() {
    setRows([...rows, { name: "", email: "", unit: "", address: "" }]);
  }

  function addPasted() {
    // Compared ignoring case and repeated spaces, against the founder's
    // number and address too, and against the paste itself. What was left
    // out is counted and said, so nothing disappears without a word.
    const sorted = sortPastedAddresses(pasted, [
      ...rows.map((r) => r.unit),
      mine,
      draft.founder.address ?? "",
    ]);
    const fresh = sorted.added.map((address) => ({ name: "", email: "", unit: address, address }));
    setRows([...rows.filter((r) => r.unit.trim() !== ""), ...fresh]);
    setPasteNote(pasteSummary(sorted));
    setPasted("");
    setPasting(false);
  }

  const listed = otherHomes(draft).length;
  const named = otherHomes(draft).filter((h) => h.name.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="divide-y divide-border overflow-hidden">
        <div className={cn("hidden items-center gap-2 bg-surface-2 px-3.5 py-2 text-footnote font-semibold text-fg-muted sm:grid", cols)}>
          <span>Address</span>
          <span>Owner</span>
          <span>Email</span>
          {byHome ? <span>Pays</span> : null}
          <span />
        </div>
        <div className={cn("grid grid-cols-1 items-center gap-2 px-3.5 py-2.5", cols)}>
          <span className="truncate text-body font-medium text-fg">
            {draft.founder.address?.trim() || mine || `Your ${w.home}`}
          </span>
          <span className="truncate text-body text-fg">
            {draft.founder.name.trim() || "You"}
            <span className="ml-1.5 text-footnote text-fg-subtle">yours</span>
          </span>
          <span className="truncate text-footnote text-fg-subtle">{draft.founder.email}</span>
          {byHome ? <span /> : null}
          <span />
          {mixed ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:col-span-full">
              <TypeChips
                types={types}
                value={draft.founder.homeType ?? types[0]}
                onChange={(homeType) => patch({ founder: { ...draft.founder, homeType } })}
                label="Kind of home, yours"
              />
            </div>
          ) : null}
        </div>
        {rows.map((row, index) => (
          <div key={index} className={cn("grid grid-cols-1 items-center gap-2 px-3.5 py-2.5", cols)}>
            <label className="block">
              {/* The column headers hide on a phone; the words come back here. */}
              <span className="mb-1 block text-footnote font-semibold text-fg-muted sm:hidden">Address</span>
              <input
                value={row.address ?? row.unit}
                onChange={(e) => editRow(index, { address: e.target.value })}
                placeholder="1430 Willow Creek Lane"
                aria-label={`Address of home ${index + 1}`}
                autoComplete="off"
                autoFocus={index === rows.length - 1 && !row.address}
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-footnote font-semibold text-fg-muted sm:hidden">Owner</span>
              <input
                value={row.name}
                onChange={(e) => editRow(index, { name: e.target.value })}
                placeholder="Owner name"
                aria-label={`Owner of home ${index + 1}`}
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-footnote font-semibold text-fg-muted sm:hidden">Email</span>
              <input
                type="email"
                value={row.email}
                onChange={(e) => editRow(index, { email: e.target.value })}
                placeholder="Email"
                aria-label={`Email for home ${index + 1}`}
                className={input}
              />
            </label>
            {byHome ? (
              <label className="block">
                <span className="mb-1 block text-footnote font-semibold text-fg-muted sm:hidden">Pays</span>
                <OwnAmount
                  label={`Dues for home ${index + 1}`}
                  value={row.duesCents}
                  fallback={draft.duesCents}
                  onChange={(duesCents) => editRow(index, { duesCents })}
                />
              </label>
            ) : null}
            <button
              type="button"
              aria-label={`Remove home ${index + 1}`}
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              className="justify-self-end rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
            {mixed ? (
              <div className="flex flex-wrap items-center gap-1.5 sm:col-span-full">
                <TypeChips
                  types={types}
                  value={row.homeType ?? types[0]}
                  onChange={(homeType) => editRow(index, { homeType })}
                  label={`Kind of home ${index + 1}`}
                />
              </div>
            ) : null}
          </div>
        ))}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={addRow}>
          <Plus className="size-3.5" />
          Add a {w.home}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPasting((v) => !v)}>
          Paste a list
        </Button>
      </div>
      {pasteNote ? (
        <p role="status" className="text-footnote text-fg-muted">
          {pasteNote}
        </p>
      ) : null}

      {pasting ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            placeholder={"One address per line\n1430 Willow Creek Lane\n1432 Willow Creek Lane"}
            aria-label="Addresses, one per line"
            className={textareaClass}
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={!pasted.trim()} onClick={addPasted}>
              Add these
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-2 text-footnote text-fg-muted">
        <MapIcon className="size-3.5 shrink-0" />
        {pluralHomes(listed + 1)}
        {named > 0 ? `, ${named} with an owner listed` : ", owners can come later"}
        {draft.duesCents > 0 ? (
          <>
            {" · "}
            {money(draftDuesTotal(draft), { cents: false })} per {cadenceNoun(draft)}
            <OwnDuesNote draft={draft} />
          </>
        ) : null}
      </p>
      <MixLine draft={draft} />

      <Callout tone="info" icon={<Users className="size-4" />} title="You can stop here">
        Your own {w.home} is already on the list. Add the rest now, or add owners one at a
        time from Homeowners once you are in. Nothing is lost by moving on.
      </Callout>
    </div>
  );
}

function RangesStep({ draft, patch }: StepProps) {
  const types = homeTypesOf(draft);
  const mixed = types.length > 1;
  const w = wordingFor(types, draft.origin);
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
   * Phase 3 must not lose the four families who closed last month. This runs
   * on every keystroke, and retyping "44" as "48" passes through "4", so a
   * row with details that no range covers for the moment is parked on the
   * draft and comes back when one does (`rebuildLotHomes`).
   */
  function setPhases(next: LotPhase[], nextPrefix = prefix) {
    const rebuilt = rebuildLotHomes<DraftHousehold>({
      phases: next,
      prefix: nextPrefix,
      previousPrefix: prefix,
      households: draft.households,
      parked: draft.parkedHouseholds,
      fallbackType: types[0],
    });
    patch({
      phases: next,
      lotPrefix: nextPrefix,
      households: rebuilt.households,
      parkedHouseholds: rebuilt.parked.length ? rebuilt.parked : undefined,
    });
  }

  /** A new range starts as a kind no range has yet, since that is usually why it was added. */
  function nextType(): PropertyType | undefined {
    if (!mixed) return undefined;
    const used = new Set(phases.map((p) => p.homeType ?? types[0]));
    return types.find((t) => !used.has(t)) ?? phases[phases.length - 1]?.homeType ?? types[0];
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

  // The printed label, so the founder's own "Lot 12" row is recognised as
  // theirs and does not offer "It has sold".
  const mine = founderLabel(draft);
  // "Not sold yet" is the builder's own word. A turnover board's neighbours
  // and an established association's unnamed homes are not the builder's.
  const builderSetting = draft.origin === "builder";
  // Counted as the association will be made: a founder whose number is in no
  // range takes the first free home rather than adding one.
  const sold = otherHomes(placeFounder(draft)).filter((h) => h.name.trim()).length;
  // Rows with an owner or a balance that no range covers yet. Said out loud,
  // because they are not homes until one does, and split by whether a range
  // can still bring them back so neither line promises what cannot happen.
  const parked = draft.parkedHouseholds ?? [];
  const { waiting, unplaced } = sortParked({ parked, phases, prefix });
  const labels = (rows: DraftHousehold[]) =>
    `${rows
      .slice(0, 3)
      .map((h) => h.unit)
      .join(", ")}${rows.length > 3 ? ` and ${rows.length - 3} more` : ""}`;

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
          <p className="pb-1 text-footnote text-fg-subtle">
            {lots.length > 0
              ? `First one is ${lots[0]}`
              : `For example ${w.numberExample}, Building B or A-`}
          </p>
        </div>

        <Card className="divide-y divide-border overflow-hidden">
          {/* The column heads, from a tablet up. On a phone each range is two
              rows, the name and then first, last and count, each field with
              its own small label: five columns in 335px left the name field
              25px wide. */}
          <div className="hidden grid-cols-[1fr_5rem_5rem_4.5rem_2rem] items-center gap-2 bg-surface-2 px-3.5 py-2 text-footnote font-semibold text-fg-muted sm:grid">
            <span>{w.group}</span>
            <span>First</span>
            <span>Last</span>
            <span className="text-right">Homes</span>
            <span />
          </div>
          {phases.map((phase) => {
            const problem = problems.find((p) => p.phaseId === phase.id);
            // A range with a problem creates nothing, so it counts nothing.
            const count = problem ? 0 : lotsInPhase(phase);
            return (
              <div key={phase.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_2rem] items-end gap-2 px-3.5 py-2.5 sm:grid-cols-[1fr_5rem_5rem_4.5rem_2rem] sm:items-center">
                  <input
                    value={phase.label}
                    onChange={(e) => editPhase(phase.id, { label: e.target.value })}
                    aria-label={`Name of ${phase.label}`}
                    className={cn(input, "col-span-3 h-9 font-medium sm:col-span-1 sm:font-normal")}
                  />
                  <label className="order-3 min-w-0 sm:order-none">
                    <span className="mb-1 block text-caption font-medium text-fg-subtle sm:hidden">
                      First
                    </span>
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
                  </label>
                  <label className="order-4 min-w-0 sm:order-none">
                    <span className="mb-1 block text-caption font-medium text-fg-subtle sm:hidden">
                      Last
                    </span>
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
                  </label>
                  <span className="tnum order-5 flex h-9 items-center justify-end whitespace-nowrap text-body font-medium text-fg-muted sm:order-none">
                    {count}
                    <span className="ml-1 sm:hidden">{count === 1 ? w.home : w.homes}</span>
                  </span>
                  {phases.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove ${phase.label}`}
                      onClick={() => setPhases(phases.filter((p) => p.id !== phase.id))}
                      className="order-2 flex size-8 items-center justify-center self-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-danger sm:order-none"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : (
                    <span className="order-2 sm:order-none" />
                  )}
                </div>
                {rangeEndProblem(phase) ? (
                  <p className="px-3.5 pb-2.5 text-footnote leading-relaxed text-fg-muted">
                    {rangeEndProblem(phase)}
                  </p>
                ) : null}
                {draft.duesByHome ? (
                  <div className="flex flex-wrap items-center gap-2 px-3.5 pb-2.5">
                    <span className="text-footnote text-fg-subtle">Each home in this range pays</span>
                    <div className="w-28">
                      <OwnAmount
                        label={`Each home in this range pays, ${phase.label}`}
                        value={phase.duesCents}
                        fallback={draft.duesCents}
                        compact
                        onChange={(duesCents) => editPhase(phase.id, { duesCents })}
                      />
                    </div>
                    <span className="text-footnote text-fg-subtle">
                      {phase.duesCents ? "" : "Blank means the usual amount."}
                    </span>
                  </div>
                ) : null}
                {mixed ? (
                  <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5">
                    <span className="mr-1 text-footnote text-fg-subtle">These are</span>
                    <TypeChips
                      types={types}
                      value={phase.homeType ?? types[0]}
                      onChange={(homeType) => editPhase(phase.id, { homeType })}
                      label={`Kind of home in ${phase.label}`}
                    />
                  </div>
                ) : null}
                {/* A phase with a problem creates nothing rather than creating
                    half of something. Two Lot 44s bills one home twice. */}
                {problem ? (
                  <p className="px-3.5 pb-2.5 text-footnote leading-relaxed text-warn">
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
          onClick={() => setPhases([...phases, nextPhase(phases, w.group, nextType())])}
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
            const isMine = mine !== "" && home.unit.trim() === mine;
            return (
            <div key={home.unit} className="px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 truncate text-footnote font-medium text-fg-subtle sm:w-20">
                  {home.unit}
                  {mixed ? (
                    <span className="block truncate text-caption font-normal">
                      {HOME_TYPE_LABEL[home.homeType ?? types[0]].short}
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  {isMine ? (
                    <span className="block text-body font-medium text-fg">
                      {draft.founder.name.trim() || "You"}
                      <span className="ml-1.5 text-footnote font-normal text-fg-subtle">
                        yours
                      </span>
                    </span>
                  ) : home.name.trim() ? (
                    <>
                      <span className="block truncate text-body font-medium text-fg">
                        {home.name}
                      </span>
                      {home.email ? (
                        <span className="block truncate text-footnote text-fg-subtle">
                          {home.email}
                        </span>
                      ) : (
                        <span className="block text-footnote text-warn">
                          No email, so no invitation
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="block truncate text-body text-fg-subtle">
                      {builderSetting ? "Not sold yet" : "No owner listed"}
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
                    className="shrink-0 text-footnote font-medium text-primary hover:underline"
                  >
                    {home.name.trim() ? "Edit" : builderSetting ? "It has sold" : "Add the owner"}
                  </button>
                )}
              </div>

              {namingUnit === home.unit && !isMine ? (
                <form
                  className="mt-2.5 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveBuyer(home.unit);
                  }}
                >
                  <Field label={builderSetting ? "Buyer name" : "Owner name"}>
                    <input
                      value={buyer.name}
                      onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                      placeholder={builderSetting ? "Buyer name" : "Owner name"}
                      aria-label={`Owner of ${home.unit}`}
                      autoFocus
                      className={input}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={buyer.email}
                      onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
                      placeholder="Email"
                      aria-label={`Email for ${home.unit}`}
                      className={input}
                    />
                  </Field>
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
              className="w-full px-3.5 py-3 text-left text-footnote font-medium text-primary transition-colors hover:bg-surface-2"
            >
              Show the other {draft.households.length - shown} {w.homes}
            </button>
          ) : null}
        </Card>
      ) : null}

      {parked.length > 0 ? (
        <div className="flex flex-col gap-2">
          {waiting.length > 0 ? (
            <p className="text-footnote leading-relaxed text-warn">
              {waiting.length} {waiting.length === 1 ? w.home : w.homes} with details on{" "}
              {waiting.length === 1 ? "it matches" : "them match"} no range yet ({labels(waiting)}
              ). {waiting.length === 1 ? "It is kept, and comes" : "They are kept, and come"} back
              when a range covers {waiting.length === 1 ? "it" : "them"}.
            </p>
          ) : null}
          {/* These never return on their own, so the line does not say they
              will. A word before the number does match once it is typed
              above, which is the one thing a board can do about it here. */}
          {unplaced.length > 0 ? (
            <p className="text-footnote leading-relaxed text-warn">
              {unplaced.length} {unplaced.length === 1 ? "row" : "rows"} with details cannot be
              matched to a {w.home} ({labels(unplaced)}). The label is not a number as this list
              prints them, or another row already has that number. If your list puts a word before
              the number, type it above.
            </p>
          ) : null}
          {/* Creating the association drops whatever is still here, so
              Continue waits until every row is covered or the board says so. */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => patch({ parkedHouseholds: undefined })}
            >
              Leave {parked.length === 1 ? "this" : "these"} out
            </Button>
            <span className="text-footnote text-fg-muted">
              Cover {parked.length === 1 ? "it" : "them"} with a range or leave{" "}
              {parked.length === 1 ? "it" : "them"} out to continue.
            </span>
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-2 text-footnote text-fg-muted">
        <MapIcon className="size-3.5 shrink-0" />
        {pluralHomes(unitCount(draft))}
        {builderSetting
          ? sold > 0
            ? `, ${sold} sold`
            : ", none sold yet"
          : sold > 0
            ? `, ${sold} with an owner listed`
            : ", no owners listed yet"}
        {draft.duesCents > 0 ? (
          <>
            {" · "}
            {money(draftDuesTotal(draft), { cents: false })} per {cadenceNoun(draft)}
            <OwnDuesNote draft={draft} />
          </>
        ) : null}
      </p>
      <MixLine draft={draft} />

      <Callout
        tone="info"
        icon={<Users className="size-4" />}
        title={builderSetting ? "Buyers can wait" : "Owner names can wait"}
      >
        {builderSetting ? (
          <>
            You do not need names now. Add a buyer as each home closes. Until then the{" "}
            {w.home} is billed to the builder.
          </>
        ) : (
          <>
            You do not need them now. Add owners here, or invite everyone from Homeowners
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

/**
 * One kind of home out of the community's kinds, as a row of small pills.
 *
 * Pills rather than a select because there are at most three answers and a
 * builder sets forty of these; one tap each is the whole job.
 */
function TypeChips({
  types,
  value,
  onChange,
  label,
}: {
  types: PropertyType[];
  value: PropertyType;
  onChange: (next: PropertyType) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "h-8 rounded-full border px-3 text-footnote font-medium transition-colors",
            value === t
              ? "border-primary bg-primary-soft text-primary"
              : "border-border-2 text-fg-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {HOME_TYPE_LABEL[t].many}
        </button>
      ))}
    </div>
  );
}

/**
 * How dues are set: one amount, one per kind, or one per home.
 *
 * Starts as one amount for everybody, which is still the common answer.
 * Kinds are offered only where more than one was picked. "Different by
 * home" is for a building where a larger unit pays more: the amount below
 * stays what most homes pay, and the homes step takes the exceptions. The
 * three are exclusive; each switch clears the others' answers so nothing
 * stale is billed.
 */
function DuesMode({ draft, patch }: StepProps) {
  const types = homeTypesOf(draft);
  const mixed = types.length > 1;
  const mode: "same" | "kind" | "home" = draft.duesByHome ? "home" : draft.duesByType ? "kind" : "same";
  function setAmount(t: PropertyType, cents: number) {
    const next = { ...(draft.duesByType ?? {}), [t]: cents };
    // The association's own amount is the first kind's, so a home whose
    // kind somehow went missing is still billed something sensible.
    patch({ duesByType: next, duesCents: next[types[0]] ?? 0 });
  }
  const choices = [
    { id: "same" as const, label: "Same for every home" },
    ...(mixed ? [{ id: "kind" as const, label: "Different by kind" }] : []),
    { id: "home" as const, label: "Different by home" },
  ];
  function choose(next: "same" | "kind" | "home") {
    if (next === "same") patch({ duesByType: undefined, duesByHome: undefined });
    else if (next === "home") patch({ duesByType: undefined, duesByHome: true });
    else
      patch({
        duesByHome: undefined,
        duesByType: Object.fromEntries(
          types.map((t) => [t, draft.duesCents]),
        ) as CommunityDraft["duesByType"],
      });
  }
  return (
    <div className="flex flex-col gap-3">
      <div
        className="inline-flex w-fit flex-wrap gap-1 rounded-xl bg-surface-2 p-1"
        role="radiogroup"
        aria-label="Do homes pay the same"
      >
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={mode === choice.id}
            onClick={() => choose(choice.id)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-body font-medium transition-colors",
              mode === choice.id ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {mode === "home" ? (
        <p className="text-footnote text-fg-subtle">For buildings where a larger unit pays more.</p>
      ) : null}
      {mode === "kind" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {types.map((t, i) => (
            <DollarField
              key={t}
              label={`${HOME_TYPE_LABEL[t].many} pay`}
              cents={draft.duesByType?.[t]}
              onCents={(cents) => setAmount(t, cents ?? 0)}
              problem={(cents) => (cents === undefined ? null : duesProblem(cents))}
              placeholder="45.00"
              autoFocus={i === 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * An optional amount on a range or a row, blank meaning "the usual". Shown
 * only when the board bills by home.
 */
function OwnAmount({
  label,
  value,
  fallback,
  onChange,
  compact,
}: {
  label: string;
  value?: number;
  fallback: number;
  onChange: (cents: number | undefined) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState(value ? String(value / 100) : "");
  const shown = shownDollars(text, value);
  const cents = typedCents(shown);
  // Blank is "the usual" and says nothing. A zero or a runaway number is
  // kept as typed and named, and Continue waits (`draftOwnDuesProblem`).
  const problem = cents === undefined ? null : duesProblem(cents);
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-fg-subtle">
          $
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={shown}
          onChange={(e) => {
            setText(e.target.value);
            onChange(typedCents(e.target.value));
          }}
          placeholder={fallback > 0 ? String(fallback / 100) : "Usual"}
          aria-label={label}
          aria-invalid={problem ? true : undefined}
          className={cn(input, "tnum pl-7", compact && "h-9")}
        />
      </div>
      {problem ? (
        <span role="alert" className="mt-1 block text-footnote leading-snug text-danger">
          {problem}
        </span>
      ) : null}
    </div>
  );
}

/** What was typed in a dollar field as cents, or undefined while it is blank. */
function typedCents(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const cents = Math.round(Number(text) * 100);
  return Number.isFinite(cents) ? cents : undefined;
}

/**
 * What a dollar field shows: the text as typed while it still means what the
 * draft holds, so "0" is kept instead of erased, and the draft's own amount
 * when something else changed it (switching modes, restoring a saved draft).
 */
function shownDollars(text: string, cents: number | undefined): string {
  if ((typedCents(text) ?? 0) === (cents ?? 0)) return text;
  return cents ? String(cents / 100) : "";
}

/**
 * A labelled dollar amount that keeps what was typed and says what is wrong
 * with it under the field. Blank reaches `onCents` as undefined.
 */
function DollarField({
  label,
  hint,
  cents,
  onCents,
  problem,
  placeholder,
  autoFocus,
}: {
  label: string;
  hint?: string;
  cents?: number;
  onCents: (cents: number | undefined) => void;
  problem: (cents: number | undefined) => string | null;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(cents ? String(cents / 100) : "");
  const shown = shownDollars(text, cents);
  return (
    <Field label={label} hint={hint} error={problem(typedCents(shown))}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-fg-subtle">
          $
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={shown}
          onChange={(e) => {
            setText(e.target.value);
            onCents(typedCents(e.target.value));
          }}
          placeholder={placeholder}
          className={cn(input, "pl-7")}
          autoFocus={autoFocus}
        />
      </div>
    </Field>
  );
}

/** "3 pay their own amount", under the totals while billing by home. */
function OwnDuesNote({ draft }: { draft: CommunityDraft }) {
  const n = draftOwnDuesCount(draft);
  if (!draft.duesByHome || n === 0) return null;
  return <> ({n} at their own amount)</>;
}

/**
 * Whether the late fee answer is complete.
 *
 * No fee is the starting answer and needs nothing. A fee needs an amount and
 * a number of days the notice can fall on (`policyWithLateFee`).
 */
function lateFeeAnswered(draft: CommunityDraft): boolean {
  const fee = draft.lateFee;
  if (!fee?.charge) return true;
  return lateFeeAmountProblem(fee.cents) === null && lateFeeDaysProblem(fee.days) === null;
}

/**
 * The late fee, asked rather than assumed.
 *
 * Starts on "No late fee". Choosing to charge one opens an amount and the
 * days after the due date, with the usual $25 and 30 days filled in to
 * change. Whatever is chosen becomes the collections policy at Create.
 */
function LateFee({ draft, patch }: StepProps) {
  const fee = draft.lateFee ?? { charge: false, cents: 0, days: 30 };
  const set = (next: Partial<NonNullable<CommunityDraft["lateFee"]>>) =>
    patch({ lateFee: { ...fee, ...next } });
  return (
    <div className="flex flex-col gap-3">
      <div>
        {/* A plain label: a <label> around two buttons would press the first. */}
        <span className="mb-1.5 block text-footnote font-medium text-fg">Late fee</span>
        <div
          className="inline-flex w-fit gap-1 rounded-xl bg-surface-2 p-1"
          role="radiogroup"
          aria-label="Late fee"
        >
          {[
            { id: false, label: "No late fee" },
            { id: true, label: "Charge a late fee" },
          ].map((mode) => (
            <button
              key={String(mode.id)}
              type="button"
              role="radio"
              aria-checked={fee.charge === mode.id}
              onClick={() =>
                mode.id === fee.charge
                  ? undefined
                  : patch({
                      lateFee: mode.id
                        ? { charge: true, cents: fee.cents > 0 ? fee.cents : 25_00, days: fee.days }
                        : { ...fee, charge: false },
                    })
              }
              className={cn(
                "rounded-lg px-3.5 py-2 text-body font-medium transition-colors",
                fee.charge === mode.id ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <span className="mt-1 block text-footnote text-fg-subtle">
          Use what your governing documents say. You can change it later in Finances, Collections.
        </span>
      </div>
      {fee.charge ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DollarField
            label="Amount"
            cents={fee.cents}
            onCents={(cents) => set({ cents: cents ?? 0 })}
            problem={lateFeeAmountProblem}
            placeholder="25.00"
          />
          <Field label="Days after the due date" error={lateFeeDaysProblem(fee.days)}>
            <input
              type="number"
              min={2}
              max={365}
              step={1}
              value={Number.isFinite(fee.days) ? fee.days : ""}
              onChange={(e) => set({ days: Number.parseInt(e.target.value, 10) })}
              placeholder="30"
              className={input}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

/** "20 townhomes and 20 condos", under the homes list of a mixed community. */
function MixLine({ draft: entered }: { draft: CommunityDraft }) {
  // The founder placed as creation will place them, so the mix adds up to
  // the homes typed and their home is the kind its range says it is.
  const draft = placeFounder(entered);
  const types = homeTypesOf(draft);
  if (types.length < 2) return null;
  const founderType = founderHomeType(draft);
  const counts = types.map((t) => ({
    t,
    n:
      otherHomes(draft).filter((h) => (h.homeType ?? types[0]) === t).length +
      (founderType === t ? 1 : 0),
  }));
  return (
    <p className="-mt-3 flex flex-wrap gap-x-3 gap-y-1 pl-5.5 text-footnote text-fg-subtle">
      {counts.map(({ t, n }) => (
        <span key={t}>
          <span className="tnum font-medium text-fg-muted">{n}</span>{" "}
          {(n === 1 ? HOME_TYPE_LABEL[t].one : HOME_TYPE_LABEL[t].many).toLowerCase()}
          {draft.duesByType?.[t] ? ` at ${money(draft.duesByType[t] ?? 0, { cents: false })}` : ""}
        </span>
      ))}
    </p>
  );
}

const input =
  fieldClass;

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
  required,
}: StepProps & { w: Wording; autoFocus?: boolean; required?: boolean }) {
  // A required field is faulted once it has been left empty, not while the
  // person is still on their way to it.
  const [touched, setTouched] = useState(false);
  const hint = w.fromBuilder
    ? draft.origin === "builder"
      ? `As it appears on the site plan. The ${w.homes} on the next screen are numbered the same way.`
      : `As it appears on the plat or your records. The ${w.homes} on the next screen are numbered the same way.`
    : `As it appears on your records. The ${w.homes} on the next screen are numbered the same way.`;
  return (
    <Field
      label={required ? `${w.Home} number` : `${w.Home} number, if you use them`}
      hint={required ? hint : "Leave it blank if homes go by address. Otherwise, as it appears on your records."}
      error={required && touched && !draft.founder.unit.trim() ? HOME_NUMBER_MESSAGE : null}
    >
      <input
        value={draft.founder.unit}
        onBlur={() => setTouched(true)}
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
        placeholder="1428 Willow Creek Lane"
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
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  // The hint sits outside the label so it never becomes part of the field's
  // accessible name.
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-footnote font-medium text-fg">{label}</span>
        {children}
      </label>
      {hint ? <span className="mt-1 block text-footnote text-fg-subtle">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1 block text-footnote leading-snug text-danger">
          {error}
        </span>
      ) : null}
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
