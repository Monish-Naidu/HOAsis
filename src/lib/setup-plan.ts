import type { Community } from "@/lib/data/community";
import type {
  AssociationOrigin,
  CommunityDraft,
  PreviousSetup,
  PropertyType,
} from "@/lib/data/new-community";
import {
  BUILDER_KEYS,
  HANDOVER_KEYS,
  SETUP_TASKS,
  firstBill,
  hasRecords,
  inviteStatus,
  openingBalanceCount,
  rosterStatus,
  switching,
  whereIs,
  type PlanFacts,
  type SetupTask,
} from "@/lib/setup";
import { billingStatus } from "@/lib/go-live";
import { newlyFormed } from "@/lib/porting";
import { moduleOn } from "@/lib/modules";
import { homeTypesOf } from "@/lib/home-types";
import { formatDate, money, pluralize, todayIsoDate } from "@/lib/utils";

/**
 * A plan, built from what a board told us about their situation.
 *
 * The checklist this replaces showed all eleven tasks to everybody and let you
 * dismiss the ones that did not apply. That asks the reader to subtract, which
 * is work, and it means the first thing a new board does is decline things.
 * Being asked nothing is cheaper than dismissing something.
 *
 * So the three questions in onboarding are questions of fact, and the answers
 * decide which tasks exist at all. A single family association is never shown
 * shared utilities. A brand new association is never asked to retrieve records
 * from a manager it does not have.
 *
 * Grouped by outcome rather than by tier, because "essential" and
 * "recommended" describe our taxonomy and "you can take payments after this"
 * describes their morning.
 *
 * One list. The advice card by situation and the go-live checklist used to
 * be two more lists beside it, repeating it and disagreeing with it. What
 * either held that this list lacked is an item here, and "can take payments"
 * has exactly one definition: the Stripe item is done (`buildPlan().payments`).
 */

export type PlanPhaseId = "before-handover" | "before-bank" | "collect" | "obligations" | "everything-else";

export interface PlanPhase {
  id: PlanPhaseId;
  title: string;
  /** What finishing this phase actually buys them. */
  outcome: string;
  tasks: PlanTask[];
  done: number;
  total: number;
  complete: boolean;
}

export interface PlanTask extends Omit<SetupTask, "done" | "unavailable"> {
  complete: boolean;
  /**
   * Cannot be done where the association lives (a copy in this browser cannot
   * take money). Listed, never counted done, and left out of the counts so a
   * copy can still reach the end of what it can do.
   */
  unavailable: boolean;
  /**
   * Why this one is here, for this association.
   *
   * Different from the task's own `why`, which is general. This is the
   * sentence that names their state, their homes, or the answer they gave.
   */
  because?: string;
}

/** The three answers the plan is built from. */
export interface AssociationProfile {
  propertyType?: PropertyType;
  /** Every kind present; one for most associations, two or three for a mix. */
  homeTypes?: PropertyType[];
  origin?: AssociationOrigin;
  previously?: PreviousSetup;
  collects: string[];
  sharedSpaces: string[];
  homes: number;
  stateName: string;
}

/**
 * The profile for an association we already created.
 *
 * The two shipped demo associations predate these questions and have no
 * profile, so they fall back to values that keep every task in the plan. An
 * association we know nothing about should be shown everything; that is the
 * old behaviour and the honest default.
 */
export function profileFromCommunity(community: Community): AssociationProfile {
  const answers = community.profile;
  return {
    propertyType: answers?.propertyType,
    homeTypes: homeTypesOf(answers),
    origin: answers?.origin,
    previously: answers?.previously,
    collects: answers?.collects ?? [],
    // Without answers we cannot know, so amenities stay in the plan if the
    // association has any recorded, and drop out only when it truly has none.
    sharedSpaces: answers?.sharedSpaces ?? (community.amenities.length ? ["clubhouse"] : []),
    homes: community.owners.length,
    stateName: community.association.stateName,
  };
}

export function profileFromDraft(draft: CommunityDraft): AssociationProfile {
  return {
    propertyType: draft.propertyType,
    homeTypes: homeTypesOf(draft),
    origin: draft.origin,
    previously: draft.previously,
    collects: draft.collects,
    sharedSpaces: [...draft.sharedSpaces, ...(draft.customSpaces ?? [])],
    homes: draft.households.length + 1,
    stateName: draft.stateName || draft.state,
  };
}

/**
 * States that require a reserve study by statute, at least for some
 * associations.
 *
 * Deliberately coarse. The library carries the real rule with its citation and
 * its thresholds; this only decides whether the plan says "required in
 * Washington" or "strongly recommended". Getting that wrong in either
 * direction is a nuisance, not a liability, and the task links to the article.
 */
const RESERVE_STUDY_STATES = new Set([
  "California", "Colorado", "Florida", "Hawaii", "Nevada", "Oregon",
  "Utah", "Virginia", "Washington",
]);

/**
 * Whether a task belongs in this association's plan at all.
 *
 * Returning false removes it entirely. It never appears, so it never has to be
 * dismissed, and the board never learns that our lists contain things that do
 * not apply to them.
 */
function applies(task: SetupTask, p: AssociationProfile, c: Community): boolean {
  // Each situation gets exactly its own steps and nobody else's.
  if (HANDOVER_KEYS.includes(task.key)) return p.origin === "handover";
  if (BUILDER_KEYS.includes(task.key)) return p.origin === "builder";
  // A mixed community gets every task any of its kinds needs: the condo
  // building's structural review does not stop mattering because there are
  // detached houses down the road.
  const types = homeTypesOf(p);
  const has = (t: PropertyType) => types.includes(t);
  const known = types.length > 0;
  switch (task.key) {
    case "vendors":
      // A builder standing an association up has not hired the landscaper yet;
      // whoever cuts the grass is still on the construction contract. A board
      // taking over inherits vendors it did not choose, and needs to know
      // which contracts are in the builder's name rather than its own.
      return p.origin !== "builder";

    case "amenities":
      return p.sharedSpaces.length > 0;

    // The trial and the subscription exist only for a real association.
    case "billing":
      return whereIs(c) === "signed-in";

    case "reserves":
      // Detached homes on their own lots have far less in common to replace,
      // and plenty of those associations genuinely have no reserve obligation.
      return !known || has("townhomes") || has("condos") || RESERVE_STUDY_STATES.has(p.stateName);

    case "maintenance-matrix":
      // Detached homes have no shared wall and no shared roof, so the question
      // this answers does not arise.
      return has("townhomes") || has("condos");

    case "structural":
      // A condominium association owns the building. A planned community
      // owning an entry monument and some parkland does not.
      return has("condos");

    case "insurance":
      return true;

    // Only an association that formed just now has these to do.
    case "ein":
    case "register":
      return newlyFormed(p.origin, p.previously);

    // Only an association that existed before has balances to carry in.
    case "opening-balances":
      return switching(p);

    // The Budget page is switched off, so a task that sends a board there
    // is not shown. It returns the day the module does.
    case "budget":
      return moduleOn("money-budget");

    case "board":
      // One person can run a two home association. Above that a board is
      // either required by the documents or a practical necessity.
      return p.homes > 4;

    default:
      return true;
  }
}

/** The sentence that names their own situation back to them. */
function because(
  task: SetupTask,
  p: AssociationProfile,
  c: Community,
  dismissed: boolean,
): string | undefined {
  const types = homeTypesOf(p);
  const has = (t: PropertyType) => types.includes(t);
  const mixed = types.length > 1;
  switch (task.key) {
    case "roster": {
      const r = rosterStatus(c, p);
      if (r.homes <= 1) return "Only your own home is on the register.";
      if (r.withoutOwner === 0) return `${pluralize(r.homes, "home")}, every one with an owner listed.`;
      if (r.stillSelling) {
        return `${pluralize(r.homes, "home")} on the register. ${r.withoutOwner} not sold yet, which is expected while you are still selling.`;
      }
      return `${r.withoutOwner} of ${pluralize(r.homes, "home")} ${r.withoutOwner === 1 ? "has" : "have"} no owner listed.`;
    }

    case "opening-balances": {
      const n = openingBalanceCount(c);
      if (n > 0) return `${pluralize(n, "home")} with an opening balance saved.`;
      if (dismissed) return "You said nobody owes anything today.";
      return "Nothing is saved yet. Enter these before the first bill goes out.";
    }

    case "payments": {
      const a = c.association;
      const where = whereIs(c);
      if (where === "demo") return "Payments are on in this demo.";
      if (where === "browser-copy") {
        return "A copy in this browser cannot take payments. Set it up for real to turn them on.";
      }
      if (a.stripeChargesEnabled) {
        return a.stripePayout
          ? `Stripe has verified the association. Dues settle to ${a.stripePayout.bank} ••${a.stripePayout.last4}.`
          : "Stripe has verified the association. Owners can pay online.";
      }
      return a.stripeAccountId
        ? "Started, not finished. Stripe still needs something from the treasurer."
        : "Owners cannot pay online until Stripe has verified the association.";
    }

    case "first-bill": {
      const bill = firstBill(c);
      if (!bill.done) return "No dues amount is set, so nothing can be billed.";
      const amount = bill.varies
        ? "each kind of home at its own amount"
        : `${money(bill.cents)} per home, billed ${bill.cadence}`;
      return `${bill.issued ? "Dues have been billed. Next bill" : "First bill"} ${formatDate(bill.date, "long")}, ${amount}.`;
    }

    case "invites": {
      if (whereIs(c) === "demo") return "Owners are signed in to this demo.";
      const i = inviteStatus(c);
      const noEmail =
        i.noEmail > 0
          ? ` ${pluralize(i.noEmail, "owner")} ${i.noEmail === 1 ? "has" : "have"} no email on file.`
          : "";
      if (i.owners === 0) return "Add every home's owner first, then invite them.";
      if (i.withEmail === 0) return `${noEmail.trim()} Add emails to invite them.`;
      if (i.done) return `${i.reached} of ${i.withEmail} invited or signed in.${noEmail}`;
      return `${pluralize(i.waiting, "owner")} with an email ${i.waiting === 1 ? "has" : "have"} not been invited.${noEmail}`;
    }

    case "billing":
      return billingStatus(c, todayIsoDate()).detail;

    case "reserves":
      if (mixed && has("condos")) {
        return "The condo buildings are the association's to replace, roof to foundation. They will dominate the study, so start with them.";
      }
      if (mixed) {
        return "The townhome roofs and shared walls are the association's, and they are the expensive ones. The detached homes add little beyond the common areas.";
      }
      if (p.propertyType === "condos") {
        return `The association owns the building, so the whole of it is your obligation. ${
          RESERVE_STUDY_STATES.has(p.stateName)
            ? `${p.stateName} requires a study for many associations, and a lender will not finance a unit in a project it cannot assess.`
            : "A lender will not finance a unit in a project it cannot assess."
        }`;
      }
      if (p.propertyType === "townhomes") {
        return "Shared roofs and shared walls are the association's, and they are the expensive ones. This is the difference between a plan and a surprise bill.";
      }
      return RESERVE_STUDY_STATES.has(p.stateName)
        ? `${p.stateName} requires a reserve study for many associations, and a buyer's lender asks for it.`
        : "Roads, the entry and any pool are yours to replace. Nothing else is, which usually makes this a short list.";

    case "insurance":
      // The single most misunderstood thing in the category. What the
      // association's policy covers is entirely different in each of these,
      // and an owner buying the wrong policy finds out during a claim.
      if (mixed) {
        return "Each kind of home needs a different owner policy. Condo owners need an HO-6, townhome owners need to know if the master policy reaches their roof, detached owners insure the whole house. Tell each group in writing.";
      }
      if (p.propertyType === "condos") {
        return "The association insures the building. Owners need their own HO-6 for the interior, and most do not know that until a claim.";
      }
      if (p.propertyType === "townhomes") {
        return "Whether the master policy reaches the roof and the siding depends on your declaration. Owners need to be told which, in writing.";
      }
      return "Common areas, the board itself, and a fidelity bond over whoever touches the money. Owners insure their own homes.";

    case "maintenance-matrix":
      if (mixed) {
        return "Write one line per kind of home. Where the association's job stops is different for a condo, a townhome and a house, and owners compare notes.";
      }
      return p.propertyType === "condos"
        ? "In a condominium the line usually runs at the unfinished surface of the walls. Saying so plainly saves the argument."
        : "Shared roofs and party walls are where this bites. An owner and a board each assuming the other pays is the most expensive misunderstanding in townhome housing.";

    case "structural":
      return `Rules differ by state, building age and height. Your ${p.stateName} page has the current position.`;

    case "vendors":
      return p.origin === "handover"
        ? "Some of these contracts are in the builder's name rather than the association's, and those simply stop when the builder leaves. Ask each one to confirm in writing who the counterparty is now."
        : undefined;

    case "documents":
      if (p.origin === "builder") {
        return "Put the recorded declaration in as text before the first closing. Several states make the association, and not the seller, responsible for giving a new member the covenants.";
      }
      return p.origin === "handover"
        ? "Take the full record while the builder still wants the handover to go smoothly. Afterwards you are a former counterparty rather than a partner."
        : "You already hold these. Putting the text in is what lets an owner search them in plain words instead of asking a board member from memory.";

    case "amenities":
      return `You told us about ${listSpaces(p.sharedSpaces)}. Owners can reserve them once they are listed.`;

    case "budget":
      return `Owners in ${p.stateName} are entitled to see it, and most states require it go out before the year starts.`;

    default:
      return undefined;
  }
}

const SPACE_LABEL: Record<string, string> = {
  pool: "a pool",
  clubhouse: "a clubhouse",
  gym: "a gym",
  playground: "a playground",
  gate: "a gate",
  elevator: "an elevator",
};

function listSpaces(keys: string[]): string {
  const names = keys.map((k) => SPACE_LABEL[k] ?? k);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Which phase a task belongs to, by what finishing it buys. */
const PHASE_OF: Record<string, PlanPhaseId> = {
  ...Object.fromEntries(HANDOVER_KEYS.map((k) => [k, "before-handover" as const])),
  ...Object.fromEntries(BUILDER_KEYS.map((k) => [k, "before-bank" as const])),
  ein: "before-bank",
  register: "before-bank",
  roster: "collect",
  "opening-balances": "collect",
  payments: "collect",
  "first-bill": "collect",
  invites: "collect",
  documents: "obligations",
  budget: "obligations",
  insurance: "obligations",
  reserves: "obligations",
  "maintenance-matrix": "obligations",
  structural: "obligations",
  board: "everything-else",
  vendors: "everything-else",
  amenities: "everything-else",
  photo: "everything-else",
  billing: "everything-else",
};

const PHASE_META: { id: PlanPhaseId; title: string; outcome: string }[] = [
  {
    id: "before-handover",
    title: "Before you sign the handover",
    outcome: "Most of what matters is decided before you sign anything. Mark each one done as you finish it.",
  },
  {
    id: "before-bank",
    title: "Before the bank will open an account",
    outcome: "What has to exist on paper before the bank opens an account in the association's name.",
  },
  {
    id: "collect",
    title: "Get paid",
    outcome: "Finish these and owners can pay online.",
  },
  {
    id: "obligations",
    title: "Records owners can ask for",
    outcome: "The records members are entitled to ask for, and the ones a lender wants at closing.",
  },
  {
    id: "everything-else",
    title: "The rest",
    outcome: "None of this is urgent. It makes the association easier to run.",
  },
];

/**
 * Tasks that are hidden by a switch (a module, or where the association
 * lives) rather than by what the board told us. Left out of "steps do not
 * apply to an association like yours", which is about the answers.
 */
const HIDDEN_BY_SWITCH = new Set(["budget", "billing", ...HANDOVER_KEYS, ...BUILDER_KEYS]);

/** The one answer to "can owners pay online", and how every screen says it. */
export interface PaymentsLine {
  /** The Stripe step is done (or this is the demo). The only thing that makes the claim true. */
  ready: boolean;
  /** Steps in "Get paid" still open, the Stripe step among them. */
  stepsLeft: number;
  /** The heading over the list. */
  headline: string;
  /** The same fact as a closing sentence, for the welcome, the end and the dashboard. */
  sentence: string;
}

/**
 * `dismissed` is what the board itself said does not apply ("we do not pay
 * any vendors"). Those leave the plan the same way a task that never applied
 * does: silently, and counted among what was left out. The exception is a task
 * with `doneWhenDismissed`: there the board saying so is how it is done, so it
 * stays in the list, ticked.
 */
export function buildPlan(
  community: Community,
  profile: AssociationProfile,
  dismissed: ReadonlySet<string> = new Set(),
) {
  const facts: PlanFacts = { origin: profile.origin, previously: profile.previously };
  const included = new Set<string>();
  const phases: PlanPhase[] = PHASE_META.map((meta) => {
    const tasks: PlanTask[] = SETUP_TASKS.filter(
      (task) =>
        PHASE_OF[task.key] === meta.id &&
        applies(task, profile, community) &&
        (!dismissed.has(task.key) || task.doneWhenDismissed),
    ).map((task) => {
      included.add(task.key);
      const { done: isDone, unavailable: isUnavailable, ...rest } = task;
      const unavailable = Boolean(isUnavailable?.(community));
      const wasDismissed = dismissed.has(task.key);
      return {
        ...rest,
        // An association that kept records brings its study; a new one gets one.
        label:
          task.key === "reserves" && hasRecords(facts) ? "Enter your reserve study" : task.label,
        unavailable,
        // Never done where it cannot be done, whatever the records say.
        complete: !unavailable && (isDone(community, facts) || (Boolean(task.doneWhenDismissed) && wasDismissed)),
        because: because(task, profile, community, wasDismissed),
      };
    });

    const counted = tasks.filter((t) => !t.unavailable);
    const done = counted.filter((t) => t.complete).length;
    return {
      ...meta,
      tasks,
      done,
      total: counted.length,
      complete: counted.length > 0 && done === counted.length,
    };
  }).filter((phase) => phase.tasks.length > 0);

  const all = phases.flatMap((p) => p.tasks).filter((t) => !t.unavailable);
  const done = all.filter((t) => t.complete).length;
  const collect = phases.find((p) => p.id === "collect");
  const payments = collect?.tasks.find((t) => t.key === "payments");
  const ready = Boolean(payments?.complete);
  const stepsLeft = (collect?.tasks ?? []).filter((t) => !t.unavailable && !t.complete).length;
  const browserCopy = whereIs(community) === "browser-copy";

  const paymentsLine: PaymentsLine = {
    ready,
    stepsLeft,
    headline: ready
      ? "You can take payments"
      : browserCopy
        ? "A copy in this browser cannot take payments"
        : `${pluralize(stepsLeft, "step")} left before owners can pay online`,
    sentence: ready
      ? "You can take payments."
      : browserCopy
        ? "A copy in this browser cannot take payments."
        : `${pluralize(stepsLeft, "step")} left before owners can pay online.`,
  };

  return {
    phases,
    done,
    total: all.length,
    percent: all.length ? done / all.length : 1,
    /** True only when the Stripe step is done. The one definition. */
    canTakePayments: ready,
    payments: paymentsLine,
    /**
     * Nothing left, including when every task was skipped: a board that
     * dismissed the whole list has no phases, and the dashboard used to read
     * the first one and crash into "This page did not load".
     */
    allDone: done === all.length,
    /** What we removed by asking three questions instead of showing everything. */
    skipped: SETUP_TASKS.filter((t) => !HIDDEN_BY_SWITCH.has(t.key) && !included.has(t.key)).length,
  };
}
