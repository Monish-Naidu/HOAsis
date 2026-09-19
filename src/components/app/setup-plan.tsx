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
import { Button, ButtonLink, Callout, Card } from "@/components/ui/primitives";
import { BankConnect } from "@/components/app/bank-connect";
import { AddBudgetLine } from "@/components/app/add-budget-line";
import { AddReserveComponent } from "@/components/app/add-reserve-component";
import { PortingCard } from "@/components/app/porting-card";
import { QuestionFlow, useFlowPosition, type FlowQuestion } from "@/components/app/question-flow";
import { useCoverPhotoUpload } from "@/components/app/community-hero";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { DOCUMENT_ACCEPT } from "@/lib/documents";
import {
  buildPlan,
  profileFromCommunity,
  type PlanPhase,
  type PlanTask,
} from "@/lib/setup-plan";
import { ADMIN_ROLES, ROLE_LABEL, type AccountRole } from "@/lib/types";
import { cn, money, pluralize } from "@/lib/utils";
import { HummingbirdArriving } from "@/components/app/hummingbird";

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
  roster: {
    title: "Is every home on the register?",
    detail: "Every home, sold or not. A home that is not here has no balance and no vote.",
  },
  bank: {
    title: "Where should dues land?",
    detail: "An account in the association's name. Not a board member's personal account.",
  },
  invites: {
    title: "Can every household be reached?",
    detail: "An email for every household that has somebody in it, so they can see their balance and pay.",
  },
  documents: {
    title: "Do you have the governing documents to hand?",
    detail: "CC&Rs, bylaws, and the rules. Owners can read them the moment they are here.",
  },
  budget: {
    title: "What does the association spend on?",
    detail: "One line per kind of expense turns the assessments into a budget.",
  },
  insurance: {
    title: "Who insures the association?",
    detail: "Carrier, policy number, renewal date. You get told before it lapses.",
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
    detail: "Landscaper, pool service, anyone you write a check to.",
  },
  amenities: {
    title: "What can owners reserve?",
    detail: "Pool, clubhouse, courts. Plenty of associations have none, which is a fine answer.",
  },
  photo: {
    title: "What does the neighborhood look like?",
    detail: "The picture owners see when they sign in. Any photo of the place does the job.",
  },
};

export function SetupFlow({ welcome = false }: { welcome?: boolean }) {
  const { community, dismissedSetupTasks, dismissSetupTask } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community), dismissedSetupTasks);
  const tasks = plan.phases.flatMap((phase) => phase.tasks);
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
          <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ok">
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
            className="w-fit text-[13px] font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline"
          >
            {task.dismissLabel}
          </button>
        ) : null}

        <details className="group rounded-lg bg-surface-2 px-4 py-3">
          <summary className="cursor-pointer select-none text-[13px] font-semibold text-fg-muted marker:hidden [&::-webkit-details-marker]:hidden">
            Why this matters
          </summary>
          <p className="mt-2 max-w-[64ch] text-[13px] leading-relaxed text-fg-muted">{task.why}</p>
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
    <p className="mt-10 text-center text-[13px] text-fg-subtle">
      Come back to this any time from Getting started.{" "}
      <Link href="/board" className="font-medium text-accent hover:underline">
        Go to the dashboard
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
  const bank = community.bankAccounts.find((a) => a.kind === "operating");

  return (
    <div className="animate-rise mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
        <PartyPopper className="size-6" />
      </span>
      <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[38px]">
        {local ? `${name} is set up in this browser.` : `${name} is live.`}
      </h1>
      <p className="mt-3 max-w-[52ch] text-[17px] leading-relaxed text-fg-muted">
        {pluralize(homes, "home")} on the register
        {dues > 0 ? `, ${money(dues)} ${cadence} each` : ""}.{" "}
        {plan.canCollect
          ? "You can already take payments."
          : `${pluralize(plan.phases[0].total - plan.phases[0].done, "thing")} before you can take a payment.`}
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
          <Done label={`${money(dues)} ${cadence} assessment`} detail="Billed to every home" />
        ) : null}
        {bank ? (
          <Done label={`${bank.institution} ••${bank.mask} connected`} detail="Dues land here" />
        ) : (
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-warn" />
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-fg">No bank connected yet</span>
              <span className="block text-[13px] text-fg-muted">
                Dues have nowhere to land until you add one. It is the first question.
              </span>
            </span>
          </div>
        )}
      </Card>

      <PortingCard />

      <p className="mt-8 text-[15px] leading-relaxed text-fg-muted">
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
          Go to the dashboard
        </ButtonLink>
      </div>
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

/** The end. Either everything is done, or here is what was left for later. */
function Finished({ plan, leftOpen }: { plan: Plan; leftOpen: PlanTask[] }) {
  return (
    <div className="animate-rise mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <span className="mb-4 flex items-center gap-3">
        <HummingbirdArriving size={44} />
        <span className="flex size-9 items-center justify-center rounded-full bg-ok-soft text-ok">
          {plan.allDone ? <PartyPopper className="size-5" /> : <Check className="size-5" strokeWidth={2.5} />}
        </span>
      </span>
      <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[38px]">
        {plan.allDone ? "Everything is set up" : "That is everything for now"}
      </h1>
      <p className="mt-3 max-w-[52ch] text-[17px] leading-relaxed text-fg-muted">
        {plan.allDone
          ? "Nothing outstanding. Getting started stays in the sidebar in case you add something later."
          : `${plan.done} of ${plan.total} done. ${
              plan.canCollect
                ? "You can take payments."
                : `${pluralize(plan.phases[0].total - plan.phases[0].done, "thing")} still ${
                    plan.phases[0].total - plan.phases[0].done === 1 ? "stands" : "stand"
                  } between you and taking a payment.`
            }`}
      </p>

      {leftOpen.length ? (
        <Card className="mt-6 divide-y divide-border overflow-hidden">
          {leftOpen.map((task) => (
            <div key={task.key} className="flex items-center gap-3 px-4 py-3">
              <span className="size-4 shrink-0 rounded-full border-2 border-border-2" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-fg">{task.label}</span>
                <span className="block truncate text-[13px] text-fg-muted">{task.detail}</span>
              </span>
              <Link
                href={`/start/plan?task=${task.key}`}
                className="shrink-0 text-[13px] font-semibold text-accent hover:underline"
              >
                Do this
              </Link>
            </div>
          ))}
        </Card>
      ) : null}

      <ButtonLink variant="primary" size="lg" className="mt-6" href="/board">
        Go to the dashboard
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
        <p className="mt-3 text-[19px] font-semibold tracking-[-0.015em] text-fg">
          Everything is set up
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-relaxed text-fg-muted">
          Nothing outstanding. This page is here if you add something later.
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
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
              {plan.canCollect
                ? "You can take payments"
                : `${plan.phases[0].total - plan.phases[0].done} to go before you can take a payment`}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
              {plan.canCollect
                ? `${pluralize(remaining, "thing")} left. None of it is urgent, and each one takes a minute.`
                : "Start at the top. Everything below it can wait."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="tnum text-[15px] font-semibold text-fg-muted">
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
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${Math.round(plan.percent * 100)}%` }}
          />
        </div>
        {plan.skipped > 0 ? (
          <p className="mt-3 text-[13px] text-fg-subtle">
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
        <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {phase.title}
          {phase.complete ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[13px] font-semibold text-ok">
              <Check className="size-3" strokeWidth={3} />
              Done
            </span>
          ) : null}
        </h2>
        <p className="tnum text-[13px] text-fg-muted">
          {phase.done} of {phase.total}
        </p>
      </div>
      <p className="mb-3 text-[15px] leading-relaxed text-fg-muted">{phase.outcome}</p>

      <Card className="divide-y divide-border">
        {phase.tasks.map((task) => (
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
                  "block text-[15px] font-semibold text-fg",
                  task.complete && "line-through",
                )}
              >
                {task.label}
              </span>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">
                {task.because ?? task.detail}
              </span>
            </span>
            {task.complete ? (
              <Link
                href={task.href}
                className="mt-0.5 shrink-0 text-[13px] font-medium text-fg-subtle hover:text-fg"
              >
                Change
              </Link>
            ) : (
              <Link
                href={`/start/plan?task=${task.key}`}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent hover:underline"
              >
                Do this
                <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        ))}
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
    "/board/money": "Finances",
    "/board/documents": "Documents",
    "/board/settings": "Settings",
    "/board/reserves": "Reserve Study",
    "/board/vendors": "Vendors",
    "/library": "the library",
  };
  return names[href] ?? "the screen";
}

/**
 * The address a question hands a board when it sends them into the product.
 *
 * `from=setup` says come back when this is done; `task` says come back to
 * this question, not the overview. Every link out of a question goes
 * through here so the return bar always knows where "back" is.
 */
export function setupLink(task: PlanTask, href = task.href): string {
  return `${href}?from=setup&task=${encodeURIComponent(task.key)}`;
}

function GoThere({ task, secondary = false }: { task: PlanTask; secondary?: boolean }) {
  return (
    <Link
      href={setupLink(task)}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[15px] font-medium transition-colors",
        secondary ? "text-fg-muted hover:text-fg" : "bg-brand text-brand-fg hover:opacity-90",
      )}
    >
      {secondary ? `Or open ${screenName(task.href)}` : `Open ${screenName(task.href)}`}
      <ArrowRight className="size-3.5" />
    </Link>
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
  switch (task.key) {
    case "bank":
      return <BankInline task={task} />;
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
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand";

function BankInline({ task }: { task: PlanTask }) {
  const { addBankAccount, isRemote } = useAppState();
  const { notify } = useToast();
  return (
    <div className="space-y-3">
      <BankConnect
        linked={!isRemote}
        onConnect={(account) => {
          addBankAccount(account);
          notify(`${account.institution} ••${account.mask} connected`, "ok");
        }}
      />
      <GoThere task={task} secondary />
    </div>
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
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-medium text-brand-fg hover:opacity-90 aria-busy:opacity-70"
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
                const outcome = await uploadDocuments(files);
                if (outcome.uploaded.length) {
                  notify(
                    `Uploaded ${outcome.uploaded.length === 1 ? outcome.uploaded[0] : `${outcome.uploaded.length} files`}. It is board only until you say otherwise.`,
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
      {hint ? <p className="text-[13px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

function StructuralInline({ task }: { task: PlanTask }) {
  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-fg-muted">
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
        <p className="text-[13px] text-fg-muted">
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
      notify(`Added ${owner.displayName}, unit ${owner.unit}`);
      setEntry({ name: "", email: "", unit: "" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add that household", "warn");
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]">
        <input
          value={entry.name}
          onChange={(e) => setEntry({ ...entry, name: e.target.value })}
          placeholder="Household name"
          aria-label="Household name"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className={field}
        />
        <input
          type="email"
          value={entry.email}
          onChange={(e) => setEntry({ ...entry, email: e.target.value })}
          placeholder="Email"
          aria-label="Household email"
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

/** Who cannot be reached yet, and where to fix it. */
function InvitesInline({ task }: { task: PlanTask }) {
  const { community } = useAppState();
  const missing = community.owners.filter((o) => o.members.length > 0 && !o.email.trim());
  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-fg-muted">
        {missing.length
          ? `${pluralize(missing.length, "household")} with nobody we can email: ${missing
              .slice(0, 4)
              .map((o) => `${o.displayName} (${o.unit})`)
              .join(", ")}${missing.length > 4 ? " and more" : ""}.`
          : "Every household with somebody in it has an email."}
      </p>
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
        <p className="text-[15px] leading-relaxed text-fg-muted">
          Nobody to appoint yet. Add a household with an email and they can hold an office.
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
              <span className="block truncate text-[15px] font-medium text-fg">{account.name}</span>
              <span className="block text-[13px] text-fg-subtle">Unit {account.unit}</span>
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
              className="rounded-full bg-surface-3 px-3 py-1 text-[13px] font-medium text-fg-muted"
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
      <p className="w-full text-[13px] text-fg-subtle">Any picture of the neighborhood does the job.</p>
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
  const next = plan.phases.flatMap((phase) => phase.tasks).find((task) => !task.complete);
  const toCollect = plan.phases[0].total - plan.phases[0].done;

  // Straight into the next question. The overview stays one click away
  // under Getting started in the sidebar for anyone who wants the whole list.
  return (
    <Link
      href={next ? `/start/plan?task=${next.key}` : "/board/setup"}
      className="mb-5 flex items-center gap-4 rounded-card border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
    >
      <Ring percent={plan.percent} done={plan.done} total={plan.total} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold tracking-[-0.015em] text-fg">
          Setting up: {plan.done} of {plan.total} done
        </span>
        <span className="mt-0.5 block truncate text-[13px] leading-relaxed text-fg-muted">
          {next ? `Next: ${next.label}.` : ""}{" "}
          {plan.canCollect
            ? "You can already take payments."
            : `${toCollect} ${toCollect === 1 ? "thing" : "things"} before you can take a payment.`}
        </span>
      </span>
      <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-brand-fg sm:inline-flex">
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
      <span className="tnum absolute text-[13px] font-semibold text-fg">
        {done}
        <span className="text-fg-subtle">/{total}</span>
      </span>
    </span>
  );
}


