"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  PartyPopper,
  Upload,
} from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { BankConnect } from "@/components/app/bank-connect";
import { AddBudgetLine } from "@/components/app/add-budget-line";
import { AddReserveComponent } from "@/components/app/add-reserve-component";
import { useToast } from "@/components/app/toast";
import { useAppState } from "@/lib/app-state";
import { DOCUMENT_ACCEPT } from "@/lib/documents";
import {
  buildPlan,
  profileFromCommunity,
  type PlanPhase,
  type PlanTask,
} from "@/lib/setup-plan";
import { cn } from "@/lib/utils";

/**
 * The to-do list, as its own page.
 *
 * One task is open at a time: the first one not done, or the one the board
 * clicked. An open task says why it is here and then lets the board do it,
 * right there when the thing is small enough to type in a box, and otherwise
 * on the screen where it belongs, with a way back. When a task is done it
 * closes, the next one opens, and the count moves. When the list is empty
 * the page says so and the banner that points here goes away.
 */
export function SetupPlan() {
  const { community } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community));
  const [chosen, setChosen] = useState<string | null>(null);

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
        <Link
          href="/board"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-medium text-brand-fg"
        >
          Open the dashboard
          <ArrowRight className="size-3.5" />
        </Link>
      </Card>
    );
  }

  const tasks = plan.phases.flatMap((phase) => phase.tasks);
  const firstOpen = tasks.find((task) => !task.complete)?.key ?? null;
  // A task the board opened stays open until it is done; then the next one.
  const active =
    chosen && tasks.some((task) => task.key === chosen && !task.complete) ? chosen : firstOpen;
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
                ? `${remaining} ${remaining === 1 ? "thing" : "things"} left. None of it is urgent, and each one takes a minute.`
                : "Start at the top. Everything below it can wait."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="tnum text-[15px] font-semibold text-fg-muted">
              {plan.done} of {plan.total}
            </p>
            <Link
              href="/board"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-2 bg-surface px-3 text-[13px] font-medium text-fg hover:bg-surface-2"
            >
              Back to the dashboard
              <ArrowRight className="size-3.5" />
            </Link>
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
        <Phase
          key={phase.id}
          phase={phase}
          active={active}
          onOpen={(key) => setChosen(key === active ? "" : key)}
        />
      ))}
    </div>
  );
}

function Phase({
  phase,
  active,
  onOpen,
}: {
  phase: PlanPhase;
  active: string | null;
  onOpen: (key: string) => void;
}) {
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
          <TaskRow
            key={task.key}
            task={task}
            open={task.key === active}
            onOpen={() => onOpen(task.key)}
          />
        ))}
      </Card>
    </section>
  );
}

function TaskRow({
  task,
  open,
  onOpen,
}: {
  task: PlanTask;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <div className={cn(task.complete && !open && "opacity-70")}>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
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
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
        ) : (
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>
      {open ? (
        <div className="border-t border-border bg-surface-2/60 px-4 py-4 sm:pl-12">
          {task.because ? (
            <p className="max-w-[64ch] text-[13px] leading-relaxed text-fg-muted">{task.why}</p>
          ) : null}
          <div className={task.because ? "mt-4" : ""}>
            {task.complete ? (
              <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                <Check className="size-3.5" strokeWidth={3} />
                Done
              </p>
            ) : (
              <TaskAction task={task} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The screen a task's link opens, named the way the sidebar names it. */
function screenName(href: string): string {
  const names: Record<string, string> = {
    "/board/homeowners": "Homeowners",
    "/board/money": "Money",
    "/board/documents": "Documents",
    "/board/settings": "Settings",
    "/board/reserves": "Reserves",
    "/board/vendors": "Vendors",
    "/library": "the library",
  };
  return names[href] ?? "the screen";
}

function GoThere({ task, secondary = false }: { task: PlanTask; secondary?: boolean }) {
  return (
    <Link
      href={`${task.href}?from=setup`}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[15px] font-medium transition-colors",
        secondary
          ? "text-fg-muted hover:text-fg"
          : "bg-brand text-brand-fg hover:opacity-90",
      )}
    >
      {secondary ? `Or open ${screenName(task.href)}` : `Open ${screenName(task.href)}`}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

/**
 * What can be done right here.
 *
 * A bank, a document, a budget line, a reserve component, a vendor, the
 * insurance and a household are each one small form, so they are here. The
 * rest need a whole screen (a roster of emails, the officers' permissions,
 * a photograph on the hero) and link out with a way back.
 */
function TaskAction({ task }: { task: PlanTask }) {
  switch (task.key) {
    case "bank":
      return <BankInline task={task} />;
    case "documents":
      return <DocumentInline task={task} />;
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
    default:
      return <GoThere task={task} />;
  }
}

const field =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand";

function BankInline({ task }: { task: PlanTask }) {
  const { addBankAccount } = useAppState();
  const { notify } = useToast();
  return (
    <div className="max-w-xl space-y-3">
      <BankConnect
        onConnect={(account) => {
          addBankAccount(account);
          notify(`${account.institution} ••${account.mask} connected`, "ok");
        }}
      />
      <GoThere task={task} secondary />
    </div>
  );
}

function DocumentInline({ task }: { task: PlanTask }) {
  const { uploadDocuments } = useAppState();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  return (
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
              for (const refused of outcome.rejected) notify(`${refused.name}: ${refused.reason}`, "warn");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <GoThere task={task} secondary />
    </div>
  );
}

function VendorInline({ task }: { task: PlanTask }) {
  const { addVendor } = useAppState();
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  return (
    <div className="max-w-xl space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cascade Grounds Co."
          aria-label="Vendor name"
          className={field}
        />
        <input
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Grounds and irrigation"
          aria-label="What they do"
          className={field}
        />
        <Button
          variant="primary"
          size="md"
          disabled={!name.trim()}
          onClick={() => {
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
          }}
        >
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
  return (
    <div className="max-w-xl space-y-3">
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
        <Button
          variant="primary"
          size="md"
          disabled={!carrier.trim()}
          onClick={() => {
            updateAssociation({
              insuranceCarrier: carrier.trim(),
              insurancePolicyNo: policy.trim() || undefined,
              insuranceExpiresOn: expires || undefined,
            });
            notify("Insurance recorded");
          }}
        >
          Save
        </Button>
        <GoThere task={task} secondary />
      </div>
    </div>
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
    <div className="max-w-xl space-y-3">
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

/**
 * The one line on the dashboard.
 *
 * Says where the board is and what comes next, and goes to the list. It is
 * not the list: a to-do list living permanently on the dashboard is how a
 * board learns to read past it. Gone the day everything is done.
 */
export function SetupPlanSummary() {
  const { community } = useAppState();
  const plan = buildPlan(community, profileFromCommunity(community));
  if (plan.allDone) return null;
  const next = plan.phases.flatMap((phase) => phase.tasks).find((task) => !task.complete);
  const toCollect = plan.phases[0].total - plan.phases[0].done;

  return (
    <Link
      href="/board/setup"
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
