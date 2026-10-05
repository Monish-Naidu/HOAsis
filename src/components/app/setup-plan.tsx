"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  PartyPopper,
  Upload,
} from "lucide-react";
import { Button, ButtonLink, Callout, Card, SuccessMark, fieldClass } from "@/components/ui/primitives";
import { AddBudgetLine } from "@/components/app/add-budget-line";
import { AddReserveComponent } from "@/components/app/add-reserve-component";
import { QuestionFlow, useFlowPosition, type FlowQuestion } from "@/components/app/question-flow";
import { useCoverPhotoUpload } from "@/components/app/community-hero";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { portingPlan } from "@/lib/porting";
import { useRemote } from "@/lib/data/remote-store";
import { DOCUMENT_ACCEPT } from "@/lib/documents";
import {
  buildPlan,
  profileFromCommunity,
  type PlanPhase,
  type PlanTask,
} from "@/lib/setup-plan";
import { BUILDER_KEYS, HANDOVER_KEYS, whereIs } from "@/lib/setup";
import { ADMIN_ROLES, ROLE_LABEL, type AccountRole } from "@/lib/types";
import { cn, money, pluralize } from "@/lib/utils";
import { HummingbirdArriving } from "@/components/app/hummingbird";
import { describeMix, duesVary, homesWithOwnDues, isMixed, totalDues } from "@/lib/home-types";
import { homeLabel } from "@/lib/wording";

/**
 * Finishing setup, one question at a time.
 *
 * The plan used to be a list with a form folded under each row. A list asks
 * the reader to choose where to start; this asks them one thing, takes the
 * answer, and moves on, the same way the founding questions did. Anything
 * that does not apply to this association was already left out by the
 * answers they gave, and anything that applies but does not exist yet ("we
 * do not pay any vendors") has a button that says exactly that.
 *
 * The plan is built from the association's records every time, so a task is
 * done the moment the thing exists and never because somebody ticked a box.
 * Skipping is remembered only for this visit; the overview under Getting
 * started keeps the honest count.
 */

/**
 * Each task, phrased as the question it answers, and the line under it when
 * the plan has nothing more specific to say about this association.
 */
const QUESTION: Record<string, { title: string; detail: string }> = {
  ein: {
    title: "Does the association have an EIN?",
    detail: "Free from the IRS. A bank will not open an account in the association's name without it.",
  },
  register: {
    title: "Is the association registered, with an agent named?",
    detail: "A nonprofit corporation with your state, and an agent who accepts legal papers for it.",
  },
  roster: {
    title: "Is every home listed, with its owner?",
    detail: "Every home, with the owner's name. A home with no owner has no balance and no vote.",
  },
  "opening-balances": {
    title: "What does each home owe today?",
    detail: "One figure per home, as of the day you switched. Nothing before that has to come across.",
  },
  payments: {
    title: "Can owners pay online yet?",
    detail: "Set up online payments. They are not on until Stripe approves the association.",
  },
  "first-bill": {
    title: "Is the first bill right?",
    detail: "The date it goes out and what each home is billed.",
  },
  invites: {
    title: "Have the owners been invited?",
    detail: "An email for every owner, then an invitation, so they can see their balance and pay.",
  },
  documents: {
    title: "Do you have the governing documents to hand?",
    detail: "CC&Rs, bylaws, and the rules. Owners can read them the moment they are here.",
  },
  budget: {
    title: "What does the association spend on?",
    detail: "One line per kind of expense turns the dues into a budget.",
  },
  insurance: {
    title: "Who insures the association?",
    detail: "Carrier, policy number and renewal date, kept where the next board can find them.",
  },
  reserves: {
    title: "What will wear out, and when?",
    detail: "Roofs, roads, the pool pump. One component is enough to start.",
  },
  "maintenance-matrix": {
    title: "Who fixes what?",
    detail: "Roof, siding, windows, decks, the line where the association stops.",
  },
  structural: {
    title: "Does the building owe an inspection?",
    detail: "Several states now require one on a schedule, with a funded reserve behind it.",
  },
  board: {
    title: "Who else is on the board?",
    detail: "Treasurer, secretary, vice president. You choose what each of them can reach.",
  },
  vendors: {
    title: "Who do you pay?",
    detail: "Landscaper, pool service, insurance agent. Anyone the association pays.",
  },
  amenities: {
    title: "What can owners reserve?",
    detail: "Pool, clubhouse, courts. Plenty of associations have none, which is a fine answer.",
  },
  photo: {
    title: "What does the neighborhood look like?",
    detail: "The picture owners see when they sign in. Any photo of the place does the job.",
  },
  billing: {
    title: "Is there a card on file?",
    detail: "Add a card before the free days end so nothing stops.",
  },
};

/**
 * Waits for the signed in person's own association before asking anything.
 *
 * /start/plan is often the first page of a visit: a reload, a bookmark, the
 * dashboard's link opened in a new tab. Nothing else on that page starts the
 * session, so the sample community rendered in its place, and a founder was
 * shown Willow Creek Estates' 88 homes as their plan. Keyed by the community as well,
 * because the questions asked are counted once, on the first render.
 */
export function SetupFlow({ welcome = false }: { welcome?: boolean }) {
  const auth = useAuth();
  const remote = useRemote();
  const { community } = useAppState();
  if (auth.loading || remote.status === "loading" || (auth.user && remote.status === "signed-out")) {
    return null;
  }
  return <SetupQuestions key={community.id} welcome={welcome} />;
}

function SetupQuestions({ welcome }: { welcome: boolean }) {
  const { community, dismissedSetupTasks, dismissSetupTask } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community), dismissedSetupTasks);
  // A step this association cannot do where it lives is listed in the
  // overview and never asked as a question.
  const tasks = plan.phases.flatMap((phase) => phase.tasks).filter((task) => !task.unavailable);
  const params = useSearchParams();
  const requested = params.get("task");
  const firstOpen = tasks.find((task) => !task.complete)?.key;

  const [stage, setStage] = useState<"welcome" | "questions" | "done">(
    welcome && !requested ? "welcome" : "questions",
  );
  const flow = useFlowPosition(
    requested && tasks.some((task) => task.key === requested)
      ? requested
      : (firstOpen ?? tasks[0]?.key ?? ""),
  );
  const index = Math.max(0, tasks.findIndex((task) => task.key === flow.current));
  const task = tasks[index];

  // The count shown is of questions actually being asked this visit: the
  // ones open when the flow started. Counting the finished ones too made
  // the number jump from 2 to 4 as the flow stepped over them.
  const [asked] = useState(() => tasks.filter((t) => !t.complete).map((t) => t.key));
  const askedIndex = asked.indexOf(flow.current);
  const shownIndex =
    askedIndex >= 0
      ? askedIndex
      : Math.max(0, asked.findIndex((key) => tasks.findIndex((t) => t.key === key) > index));

  // Forward lands on the next question still open. Nobody should have to
  // click through things the records already answer; Back still reaches them.
  function forward() {
    const next = tasks.slice(index + 1).find((t) => !t.complete);
    if (next) flow.go(next.key, "forward");
    else setStage("done");
  }
  function back() {
    const previous = tasks[index - 1];
    if (previous) flow.go(previous.key, "back");
    else if (welcome) setStage("welcome");
  }

  if (stage === "welcome") {
    return (
      <Welcome
        plan={plan}
        count={tasks.filter((t) => !t.complete).length}
        onStart={() => setStage("questions")}
      />
    );
  }

  if (stage === "done" || !task) {
    return (
      <Finished
        plan={plan}
        leftOpen={tasks.filter((t) => !t.complete)}
        onOpen={(key) => {
          // The flow is already mounted, so a link to ?task= would only
          // change the address bar. Land on the question directly.
          flow.jump(key);
          setStage("questions");
        }}
      />
    );
  }

  const phase = plan.phases.find((p) => p.tasks.includes(task));
  const question: FlowQuestion = {
    id: task.key,
    group: phase?.title ?? "Setting up",
    title: QUESTION[task.key]?.title ?? task.label,
    detail: task.because ?? QUESTION[task.key]?.detail ?? task.detail,
    canContinue: task.complete,
    skipLabel: task.complete ? undefined : "Skip for now",
    body: (
      <div className="flex flex-col gap-5">
        {task.complete ? (
          <p className="inline-flex items-center gap-1.5 text-body font-semibold text-ok">
            <Check className="size-4" strokeWidth={3} />
            Done
          </p>
        ) : (
          <TaskAction task={task} />
        )}

        {/* What the board said does not exist here ("we do not pay any
            vendors"). Recorded, so the overview stops counting it. A label
            that only means "later" is the skip button and is not repeated. */}
        {!task.complete &&
        task.optional &&
        task.dismissLabel &&
        !/later|not now/i.test(task.dismissLabel) ? (
          <button
            type="button"
            onClick={() => {
              dismissSetupTask(task.key);
              forward();
            }}
            className="w-fit text-footnote font-medium text-fg-muted underline underline-offset-2 hover:text-fg"
          >
            {task.dismissLabel}
          </button>
        ) : null}

        <details className="group rounded-lg bg-surface-2 px-4 py-3">
          <summary className="cursor-pointer select-none text-footnote font-semibold text-fg-muted marker:hidden [&::-webkit-details-marker]:hidden">
            Why this matters
          </summary>
          <p className="mt-2 max-w-[64ch] text-footnote leading-relaxed text-fg-muted">{task.why}</p>
        </details>
      </div>
    ),
  };

  return (
    <QuestionFlow
      question={question}
      index={shownIndex}
      total={Math.max(asked.length, 1)}
      direction={flow.direction}
      leaving={flow.leaving}
      onBack={index > 0 || welcome ? back : undefined}
      onContinue={forward}
      onSkip={forward}
      below={<WayOut />}
    />
  );
}

/** Always available. A plan that has to be finished before the product opens is a plan people abandon. */
function WayOut() {
  return (
    <p className="mt-10 text-center text-footnote text-fg-subtle">
      Come back to this any time from Getting started.{" "}
      <Link href="/board" className="font-medium text-accent hover:underline">
        Open the dashboard
      </Link>
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* The first and last screens                                                 */
/* -------------------------------------------------------------------------- */

type Plan = ReturnType<typeof buildPlan>;

/**
 * The first time a board sees the plan, straight out of the founding
 * questions. Says what exists, says what kind of first month this is, and
 * then asks the first question. `local` is the looking-around copy, said
 * plainly because it used to be indistinguishable from the real thing.
 */
function Welcome({ plan, count, onStart }: { plan: Plan; count: number; onStart: () => void }) {
  const { community, isRemote } = useAppState();
  const local = !isRemote && Boolean(community.profile);
  const name = community.settings.displayName;
  const homes = community.owners.length;
  const dues = community.association.duesCents;
  const cadence = community.association.duesCadence;
  // A mixed community names its kinds, and says so when they pay differently.
  const mix = describeMix(community.owners);
  const varies = duesVary(community.association, community.owners);

  return (
    <div className="animate-rise mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
        <PartyPopper className="size-6" />
      </span>
      <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[38px]">
        {local ? `${name} is set up in this browser.` : `${name} is live.`}
      </h1>
      <p className="mt-3 max-w-[52ch] text-headline leading-relaxed text-fg-muted">
        {pluralize(homes, "home")} on the register
        {isMixed(community.profile) && mix ? ` (${mix})` : ""}
        {dues > 0 && !varies ? `, ${money(dues)} ${cadence} each` : ""}.{" "}
        {plan.payments.sentence}
      </p>

      {local ? (
        <Callout tone="warn" className="mt-6" title="This is a copy in this browser only">
          It is not saved anywhere else and nobody else can sign in to it. Create an account when
          you are ready and the real one takes three minutes.
        </Callout>
      ) : null}

      <Card className="mt-6 divide-y divide-border overflow-hidden">
        <Done label={`${pluralize(homes, "home")} added`} detail="Each has a balance and a vote" />
        {dues > 0 ? (
          <Done
            label={
              varies
                ? `${money(totalDues(community.association, community.owners))} ${cadence} in dues`
                : `${money(dues)} ${cadence} dues`
            }
            detail={
              homesWithOwnDues(community.owners) > 0
                ? "Each home at what it pays"
                : varies
                  ? "Each kind of home at its own amount"
                  : "Billed to every home"
            }
          />
        ) : null}
        {plan.canTakePayments ? (
          <Done label="Online payments are on" detail="Owners can pay dues online" />
        ) : (
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-warn" />
            <span className="min-w-0">
              <span className="block text-body font-medium text-fg">Online payments are not on yet</span>
              <span className="block text-footnote text-fg-muted">
                {local
                  ? "A copy in this browser cannot take payments. Set it up for real to turn them on."
                  : "Owners cannot pay online until online payments are approved."}
              </span>
            </span>
          </div>
        )}
      </Card>

      <SituationIntro className="mt-8" />

      <p className="mt-8 text-body leading-relaxed text-fg-muted">
        {count === 0
          ? "Nothing is outstanding."
          : `${pluralize(count, "question")} left, one at a time. None of it is urgent, and anything that does not apply can be skipped.`}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={onStart}>
          See what is next
          <ArrowRight className="size-4" />
        </Button>
        <ButtonLink variant="ghost" size="lg" href="/board">
          Open the dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * One paragraph about the board's situation, above the one list. Only where
 * it says something the list does not: a builder's unsold lots, a turnover,
 * a manager holding the records. The steps it used to number are list items.
 */
function SituationIntro({ className }: { className?: string }) {
  const { community } = useAppState();
  const profile = profileFromCommunity(community);
  const plan = portingPlan(profile.origin, profile.previously);
  if (!plan?.introduces) return null;
  return (
    <div className={className}>
      <p className="text-headline font-semibold tracking-[-0.015em] text-fg">{plan.title}</p>
      <p className="mt-1 max-w-[64ch] text-body leading-relaxed text-fg-muted">{plan.lede}</p>
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
        <span className="block text-body font-medium text-fg">{label}</span>
        <span className="block text-footnote text-fg-muted">{detail}</span>
      </span>
    </div>
  );
}

/** The end. Either everything is done, or here is what was left for later. */
function Finished({
  plan,
  leftOpen,
  onOpen,
}: {
  plan: Plan;
  leftOpen: PlanTask[];
  onOpen: (key: string) => void;
}) {
  return (
    <div className="animate-rise mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <span className="mb-5 flex items-center gap-4">
        <HummingbirdArriving size={44} />
        {plan.allDone ? (
          <SuccessMark size={44} tone="primary" />
        ) : (
          <SuccessMark size={44} />
        )}
      </span>
      <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[38px]">
        {plan.allDone ? "Everything is set up" : "That is everything for now"}
      </h1>
      <p className="mt-3 max-w-[52ch] text-headline leading-relaxed text-fg-muted">
        {plan.allDone
          ? "Nothing outstanding. Setting up stays in the sidebar in case you add something later."
          : `${plan.done} of ${plan.total} done. ${plan.payments.sentence}`}
      </p>

      {leftOpen.length ? (
        <Card className="mt-6 divide-y divide-border overflow-hidden">
          {leftOpen.map((task) => (
            <div key={task.key} className="flex items-center gap-3 px-4 py-3">
              <span className="size-4 shrink-0 rounded-full border-2 border-border-2" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium text-fg">{task.label}</span>
                <span className="block truncate text-footnote text-fg-muted">{task.detail}</span>
              </span>
              <button
                type="button"
                onClick={() => onOpen(task.key)}
                className="shrink-0 text-footnote font-semibold text-accent hover:underline"
              >
                Do this
              </button>
            </div>
          ))}
        </Card>
      ) : null}

      <ButtonLink variant="primary" size="lg" className="mt-6" href="/board">
        Open the dashboard
        <ArrowRight className="size-4" />
      </ButtonLink>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The overview, under Getting started                                        */
/* -------------------------------------------------------------------------- */

/**
 * Where a board stands, for a visit that is not the first.
 *
 * Not a form. Every row says what it is, why it is here for this
 * association, and whether it is done; doing it happens in the flow, one
 * question at a time, which "Continue setting up" opens at the first open
 * question and any row opens at itself.
 */
export function SetupOverview() {
  const { community, dismissedSetupTasks } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community), dismissedSetupTasks);

  if (plan.allDone) {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <PartyPopper className="size-6" />
        </span>
        <p className="mt-3 text-headline font-semibold tracking-[-0.015em] text-fg">
          Everything is set up
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-body leading-relaxed text-fg-muted">
          Nothing outstanding. This page is here if you add something later.
          {plan.payments.ready ? "" : ` ${plan.payments.sentence}`}
        </p>
        <ButtonLink variant="primary" size="md" className="mt-4" href="/board">
          Open the dashboard
          <ArrowRight className="size-3.5" />
        </ButtonLink>
      </Card>
    );
  }

  const tasks = plan.phases.flatMap((phase) => phase.tasks);
  const firstOpen = tasks.find((task) => !task.complete)?.key;
  const remaining = plan.total - plan.done;

  return (
    <div className="space-y-6">
      <SituationIntro />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-headline font-semibold tracking-[-0.015em] text-fg">
              {plan.payments.headline}
            </p>
            <p className="mt-1 text-body leading-relaxed text-fg-muted">
              {plan.payments.ready
                ? `${pluralize(remaining, "thing")} left. None of it is urgent, and each one takes a minute.`
                : "Start at the top. Everything below it can wait."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="tnum text-body font-semibold text-fg-muted">
              {plan.done} of {plan.total}
            </p>
            <ButtonLink
              variant="primary"
              size="md"
              href={firstOpen ? `/start/plan?task=${firstOpen}` : "/start/plan"}
            >
              Continue setting up
              <ArrowRight className="size-3.5" />
            </ButtonLink>
          </div>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.round(plan.percent * 100)}%` }}
          />
        </div>
        {plan.skipped > 0 ? (
          <p className="mt-3 text-footnote text-fg-subtle">
            {plan.skipped} {plan.skipped === 1 ? "step does" : "steps do"} not apply to an
            association like yours, so we left {plan.skipped === 1 ? "it" : "them"} out.
          </p>
        ) : null}
      </Card>

      {plan.phases.map((phase) => (
        <PhaseRows key={phase.id} phase={phase} />
      ))}
    </div>
  );
}

function PhaseRows({ phase }: { phase: PlanPhase }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-headline font-semibold tracking-[-0.015em] text-fg">
          {phase.title}
          {phase.complete ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-footnote font-semibold text-ok">
              <Check className="size-3" strokeWidth={3} />
              Done
            </span>
          ) : null}
        </h2>
        <p className="tnum text-footnote text-fg-muted">
          {phase.done} of {phase.total}
        </p>
      </div>
      <p className="mb-3 text-body leading-relaxed text-fg-muted">{phase.outcome}</p>

      <Card className="divide-y divide-border">
        {phase.tasks.map((task) => {
          const situational = HANDOVER_KEYS.includes(task.key) || BUILDER_KEYS.includes(task.key);
          return (
          <div
            key={task.key}
            className={cn("flex items-start gap-3 px-4 py-3.5", task.complete && "opacity-70")}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                task.complete ? "border-ok bg-ok text-white" : "border-border-2 text-transparent",
              )}
              aria-hidden
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-body font-semibold text-fg",
                  task.complete && "line-through",
                )}
              >
                {task.label}
              </span>
              {situational ? (
                <>
                  <span className="mt-0.5 block text-footnote leading-relaxed text-fg-muted">
                    {task.detail}
                  </span>
                  {/* Order is the whole argument at a handover, so the reason a
                      step sits where it does is stated rather than implied. */}
                  <span className="mt-1.5 block border-l-2 border-border-2 pl-3 text-footnote leading-relaxed text-fg-muted">
                    {task.why}
                  </span>
                </>
              ) : (
                <span className="mt-0.5 block text-footnote leading-relaxed text-fg-muted">
                  {task.because ?? task.detail}
                </span>
              )}
            </span>
            {task.unavailable ? (
              <span className="mt-0.5 shrink-0 text-footnote font-medium text-fg-subtle">
                Not available here
              </span>
            ) : task.complete ? (
              <Link
                href={task.href || `/start/plan?task=${task.key}`}
                className="mt-0.5 shrink-0 text-footnote font-medium text-fg-subtle hover:text-fg"
              >
                Change
              </Link>
            ) : (
              <Link
                href={`/start/plan?task=${task.key}`}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-footnote font-semibold text-accent hover:underline"
              >
                Do this
                <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
          );
        })}
      </Card>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Answering, right here                                                      */
/* -------------------------------------------------------------------------- */

/** The screen a task's link opens, named the way the sidebar names it. */
function screenName(href: string): string {
  const names: Record<string, string> = {
    "/board/homeowners": "Homeowners",
    "/board/homeowners/opening-balances": "Opening balances",
    "/board/money": "Finances",
    "/board/documents": "Documents",
    "/board/settings": "Settings",
    "/board/reserves": "Reserve study",
    "/board/vendors": "Vendors",
    "/library": "the library",
  };
  return names[href.split("#")[0]] ?? "the screen";
}

/**
 * The address a question hands a board when it sends them into the product.
 *
 * `from=setup` says come back when this is done; `task` says come back to
 * this question, not the overview. Every link out of a question goes
 * through here so the return bar always knows where "back" is.
 */
export function setupLink(task: PlanTask, href = task.href): string {
  // A hash goes last, after the query, or the browser reads the query as part of it.
  const [path, hash] = href.split("#");
  return `${path}?from=setup&task=${encodeURIComponent(task.key)}${hash ? `#${hash}` : ""}`;
}

function GoThere({ task, secondary = false }: { task: PlanTask; secondary?: boolean }) {
  return (
    <ButtonLink href={setupLink(task)} variant={secondary ? "ghost" : "primary"} size="md">
      {secondary ? `Or open ${screenName(task.href)}` : `Open ${screenName(task.href)}`}
      <ArrowRight className="size-3.5" />
    </ButtonLink>
  );
}

/**
 * What can be done on the spot.
 *
 * A bank, a document, a budget line, a reserve component, a vendor, the
 * insurance, a household, an officer, an amenity and the photograph are each
 * one small form, so they are here. Inviting neighbours needs the roster and
 * links out with a way back.
 */
function TaskAction({ task }: { task: PlanTask }) {
  // Steps that happen outside the product: read, do, then say it is done.
  if (HANDOVER_KEYS.includes(task.key) || BUILDER_KEYS.includes(task.key)) {
    return <PaperworkInline task={task} />;
  }
  switch (task.key) {
    case "ein":
    case "register":
      return <PaperworkInline task={task} />;
    case "opening-balances":
    case "first-bill":
    case "billing":
      return <GoThere task={task} />;
    case "payments":
      return <PaymentsInline task={task} />;
    case "documents":
      return <DocumentInline task={task} />;
    case "maintenance-matrix":
      return (
        <DocumentInline
          task={task}
          hint="Upload it with a name like Maintenance responsibility matrix, or write one in Documents."
        />
      );
    case "structural":
      return <StructuralInline task={task} />;
    case "budget":
      return (
        <div className="space-y-3">
          <AddBudgetLine />
          <GoThere task={task} secondary />
        </div>
      );
    case "reserves":
      return (
        <div className="space-y-3">
          <AddReserveComponent />
          <GoThere task={task} secondary />
        </div>
      );
    case "vendors":
      return <VendorInline task={task} />;
    case "insurance":
      return <InsuranceInline task={task} />;
    case "roster":
      return <HouseholdInline task={task} />;
    case "invites":
      return <InvitesInline task={task} />;
    case "board":
      return <BoardInline task={task} />;
    case "amenities":
      return <AmenityInline task={task} />;
    case "photo":
      return <PhotoInline />;
    default:
      return <GoThere task={task} />;
  }
}

const field =
  fieldClass;

/** Paperwork happens outside the product. The detail says what, the link says where, "Done" says it is. */
function PaperworkInline({ task }: { task: PlanTask }) {
  const guide = task.href.startsWith("/library");
  return (
    <div className="space-y-3">
      <p className="text-body leading-relaxed text-fg-muted">{task.detail}</p>
      {task.href ? (
        guide ? (
          <ButtonLink href={task.href} variant="ghost" size="md">
            Read the guide
            <ArrowRight className="size-3.5" />
          </ButtonLink>
        ) : (
          <GoThere task={task} secondary />
        )
      ) : null}
    </div>
  );
}

/**
 * Stripe is connected in Settings, where the whole flow (verification, what
 * Stripe still needs, charges turned on) already lives. A copy in this
 * browser has no Stripe and says so.
 */
function PaymentsInline({ task }: { task: PlanTask }) {
  const { community } = useAppState();
  if (whereIs(community) === "browser-copy") {
    return (
      <div className="space-y-3">
        <p className="text-body leading-relaxed text-fg-muted">
          A copy in this browser cannot take payments. Set it up for real to turn them on.
        </p>
        <ButtonLink href="/signin" variant="primary" size="md">
          Set it up for real
          <ArrowRight className="size-3.5" />
        </ButtonLink>
      </div>
    );
  }
  const started = Boolean(community.association.stripeAccountId);
  return (
    <ButtonLink href={setupLink(task)} variant="primary" size="md">
      {started ? "Finish setting up online payments" : "Set up online payments"}
      <ArrowRight className="size-3.5" />
    </ButtonLink>
  );
}

function DocumentInline({ task, hint }: { task: PlanTask; hint?: string }) {
  const { uploadDocuments } = useAppState();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label
          aria-busy={busy}
          className="press inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-brand-gradient px-3.5 text-callout font-medium text-primary-fg shadow-sm hover:brightness-[1.06] aria-busy:opacity-70"
        >
          <Upload className="size-3.5" />
          {busy ? "Uploading" : "Upload a document"}
          <input
            type="file"
            multiple
            accept={DOCUMENT_ACCEPT}
            aria-label="Upload documents"
            disabled={busy}
            className="sr-only"
            onChange={async (event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (!files.length) return;
              setBusy(true);
              try {
                const outcome = await uploadDocuments(files, {
                  category: "Governing",
                  visibility: "members",
                });
                if (outcome.uploaded.length) {
                  notify(
                    `Uploaded ${outcome.uploaded.length === 1 ? outcome.uploaded[0] : `${outcome.uploaded.length} files`}. Owners can read it now.`,
                  );
                }
                for (const refused of outcome.rejected)
                  notify(`${refused.name}: ${refused.reason}`, "warn");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <GoThere task={task} secondary />
      </div>
      {hint ? <p className="text-footnote text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function StructuralInline({ task }: { task: PlanTask }) {
  return (
    <div className="space-y-3">
      <p className="text-body leading-relaxed text-fg-muted">
        Find out first, then file the report here. The library has your state&apos;s rule.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <GoThere task={task} />
      </div>
      <DocumentInline
        task={{ ...task, href: "/board/documents" }}
        hint="A report named with structural, milestone or inspection counts."
      />
    </div>
  );
}

function VendorInline({ task }: { task: PlanTask }) {
  const { community, addVendor } = useAppState();
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  function save() {
    if (!name.trim()) return;
    addVendor({
      id: `v-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: name.trim(),
      service: service.trim() || "Services",
      achEnabled: false,
      w9OnFile: false,
      ytdPaidCents: 0,
      defaultCategory: "Repairs & maintenance",
    });
    notify(`Added ${name.trim()}`);
    setName("");
    setService("");
  }
  return (
    <div className="space-y-3">
      {community.vendors.length ? (
        <p className="text-footnote text-fg-muted">
          On file: {community.vendors.map((v) => v.name).join(", ")}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cascade Grounds Co."
          aria-label="Vendor name"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={field}
        />
        <input
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Grounds and irrigation"
          aria-label="What they do"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={field}
        />
        <Button variant="primary" size="md" disabled={!name.trim()} onClick={save}>
          Add vendor
        </Button>
      </div>
      <GoThere task={task} secondary />
    </div>
  );
}

function InsuranceInline({ task }: { task: PlanTask }) {
  const { community, updateAssociation } = useAppState();
  const { notify } = useToast();
  const [carrier, setCarrier] = useState(community.association.insuranceCarrier ?? "");
  const [policy, setPolicy] = useState(community.association.insurancePolicyNo ?? "");
  const [expires, setExpires] = useState(community.association.insuranceExpiresOn ?? "");
  function save() {
    updateAssociation({
      insuranceCarrier: carrier.trim(),
      insurancePolicyNo: policy.trim() || undefined,
      insuranceExpiresOn: expires || undefined,
    });
    notify("Insurance recorded");
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (carrier.trim()) save();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="Carrier"
          aria-label="Insurance carrier"
          className={field}
        />
        <input
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
          placeholder="Policy number"
          aria-label="Policy number"
          className={field}
        />
        <input
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          aria-label="Renewal date"
          className={field}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={!carrier.trim()}>
          Save
        </Button>
        <GoThere task={task} secondary />
      </div>
    </form>
  );
}

function HouseholdInline({ task }: { task: PlanTask }) {
  const { addOwner } = useAppState();
  const { notify } = useToast();
  const [entry, setEntry] = useState({ name: "", email: "", unit: "" });
  function save() {
    try {
      const owner = addOwner(entry);
      notify(`Added ${owner.displayName}, home ${owner.unit}`);
      setEntry({ name: "", email: "", unit: "" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add that home. Check the details and try again.", "warn");
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
        <input
          value={entry.name}
          onChange={(e) => setEntry({ ...entry, name: e.target.value })}
          placeholder="Owner name"
          aria-label="Owner name"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={field}
        />
        <input
          type="email"
          value={entry.email}
          onChange={(e) => setEntry({ ...entry, email: e.target.value })}
          placeholder="Email"
          aria-label="Owner email"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={field}
        />
        <input
          value={entry.unit}
          onChange={(e) => setEntry({ ...entry, unit: e.target.value })}
          placeholder="Unit"
          aria-label="Unit"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={field}
        />
        <Button
          variant="primary"
          size="md"
          onClick={save}
          disabled={!entry.name.trim() || !entry.unit.trim()}
        >
          Add
        </Button>
      </div>
      <GoThere task={task} secondary />
    </div>
  );
}

/** Who still has no invitation or no email, and where to fix it. */
function InvitesInline({ task }: { task: PlanTask }) {
  return (
    <div className="space-y-3">
      <p className="text-body leading-relaxed text-fg-muted">{task.because ?? task.detail}</p>
      <GoThere task={task} />
    </div>
  );
}

/** Give a neighbour an office. Only people with a login can hold one. */
function BoardInline({ task }: { task: PlanTask }) {
  const { community, setAccountRole } = useAppState();
  const { notify } = useToast();
  const candidates = community.accounts.filter((a) => a.role !== "president");
  if (!candidates.length) {
    return (
      <div className="space-y-3">
        <p className="text-body leading-relaxed text-fg-muted">
          No one to appoint yet. Invite an owner by email. Once they sign in, you can make them a
          board member.
        </p>
        <GoThere task={{ ...task, href: "/board/homeowners" }} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Card className="divide-y divide-border overflow-hidden">
        {candidates.slice(0, 8).map((account) => (
          <label key={account.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-fg">{account.name}</span>
              <span className="block text-footnote text-fg-subtle">{homeLabel(community, account.unit)}</span>
            </span>
            <select
              value={account.role}
              aria-label={`${account.name}'s role`}
              onChange={(e) => {
                setAccountRole(account.id, e.target.value as AccountRole);
                notify(`${account.name} is now ${ROLE_LABEL[e.target.value as AccountRole]}`);
              }}
              className={cn(field, "h-9 w-40")}
            >
              <option value="resident">{ROLE_LABEL.resident}</option>
              {ADMIN_ROLES.filter((r) => r !== "president").map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </Card>
      <GoThere task={task} secondary />
    </div>
  );
}

function AmenityInline({ task }: { task: PlanTask }) {
  const { community, setAmenities } = useAppState();
  const { notify } = useToast();
  const [name, setName] = useState("");
  function add() {
    const label = name.trim();
    if (!label) return;
    setAmenities([
      ...community.amenities,
      {
        id: `am-${Date.now()}`,
        name: label,
        reservable: true,
        detail: "Added by the board",
        status: "open",
        maxHours: 4,
      },
    ]);
    notify(`Added ${label}`);
    setName("");
  }
  return (
    <div className="space-y-3">
      {community.amenities.length ? (
        <div className="flex flex-wrap gap-2">
          {community.amenities.map((a) => (
            <span
              key={a.id}
              className="rounded-full bg-surface-3 px-3 py-1 text-footnote font-medium text-fg-muted"
            >
              {a.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an amenity"
          aria-label="Amenity name"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className={field}
        />
        <Button variant="primary" size="md" disabled={!name.trim()} onClick={add}>
          Add
        </Button>
      </div>
      <GoThere task={task} secondary />
    </div>
  );
}

function PhotoInline() {
  const { community } = useAppState();
  const { busy, choose } = useCoverPhotoUpload();
  const input = useRef<HTMLInputElement>(null);
  const photo = community.settings.photoUrl;
  return (
    <div className="flex flex-wrap items-center gap-4">
      {photo ? (
        <span
          className="block h-20 w-32 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-border"
          style={{ backgroundImage: `url(${photo})` }}
          role="img"
          aria-label="Current cover photo"
        />
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label="Upload a cover photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void choose(file);
          e.target.value = "";
        }}
      />
      <Button variant="primary" size="md" disabled={busy} onClick={() => input.current?.click()}>
        <Camera className="size-4" />
        {busy ? "Uploading" : photo ? "Change the photo" : "Choose a photo"}
      </Button>
      <p className="w-full text-footnote text-fg-subtle">Any picture of the neighborhood does the job.</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The one line on the dashboard                                              */
/* -------------------------------------------------------------------------- */

/**
 * Says where the board is and what comes next, and goes to the overview. It
 * is not the list: a to-do list living permanently on the dashboard is how a
 * board learns to read past it. Gone the day everything is done.
 */
export function SetupPlanSummary() {
  const { community, dismissedSetupTasks } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community), dismissedSetupTasks);
  if (plan.allDone) return null;
  const next = plan
    .phases.flatMap((phase) => phase.tasks)
    .find((task) => !task.complete && !task.unavailable);

  // Straight into the next question. The overview stays one click away
  // under Getting started in the sidebar for anyone who wants the whole list.
  return (
    <Link
      href={next ? `/start/plan?task=${next.key}` : "/board/setup"}
      className="mb-5 flex items-center gap-4 rounded-card border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <Ring percent={plan.percent} done={plan.done} total={plan.total} />
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold tracking-[-0.015em] text-fg">
          Setting up: {plan.done} of {plan.total} done
        </span>
        <span className="mt-0.5 block truncate text-footnote leading-relaxed text-fg-muted">
          {next ? `Next: ${next.label}.` : ""}{" "}
          {plan.payments.sentence}
        </span>
      </span>
      <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-gradient px-3.5 text-footnote font-semibold text-primary-fg shadow-sm sm:inline-flex">
        Continue
        <ArrowRight className="size-3.5" />
      </span>
      <ArrowRight className="size-4 shrink-0 text-fg-subtle sm:hidden" aria-hidden />
    </Link>
  );
}

function Ring({ percent, done, total }: { percent: number; done: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex size-12 shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
        <circle cx="24" cy="24" r={r} className="fill-none stroke-surface-3" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          className="fill-none stroke-brand transition-all duration-500"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent)}
        />
      </svg>
      <span className="tnum absolute text-footnote font-semibold text-fg">
        {done}
        <span className="text-fg-subtle">/{total}</span>
      </span>
    </span>
  );
}


