import type { Community } from "@/lib/data/community";
import type {
  AssociationOrigin,
  CommunityDraft,
  PropertyType,
} from "@/lib/data/new-community";
import { SETUP_TASKS, type SetupTask } from "@/lib/setup";

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
 */

export type PlanPhaseId = "collect" | "obligations" | "everything-else";

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

export interface PlanTask extends SetupTask {
  complete: boolean;
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
  origin?: AssociationOrigin;
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
    origin: answers?.origin,
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
    origin: draft.origin,
    collects: draft.collects,
    sharedSpaces: draft.sharedSpaces,
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
function applies(task: SetupTask, p: AssociationProfile): boolean {
  switch (task.key) {
    case "vendors":
      // A board leaving a manager has vendors, held by somebody else. A brand
      // new association usually has not hired anyone yet.
      return p.origin !== "new";

    case "amenities":
      return p.sharedSpaces.length > 0;

    case "reserves":
      // Detached homes on their own lots have far less in common to replace,
      // and plenty of those associations genuinely have no reserve obligation.
      return p.propertyType !== "single-family" || RESERVE_STUDY_STATES.has(p.stateName);

    case "insurance":
      return true;

    case "board":
      // One person can run a two home association. Above that a board is
      // either required by the documents or a practical necessity.
      return p.homes > 4;

    default:
      return true;
  }
}

/** The sentence that names their own situation back to them. */
function because(task: SetupTask, p: AssociationProfile): string | undefined {
  switch (task.key) {
    case "reserves":
      return RESERVE_STUDY_STATES.has(p.stateName)
        ? `${p.stateName} requires a reserve study for many associations, and a buyer's lender asks for it.`
        : "Not required where you are, but it is what decides whether a roof arrives as a plan or as a surprise bill.";

    case "vendors":
      return p.origin === "leaving-manager"
        ? "Your manager holds these contracts. Getting copies before you leave is the part boards forget."
        : undefined;

    case "documents":
      return p.origin === "leaving-manager"
        ? "Ask your manager for the full record now. They are required to hand it over, and it gets harder after you cancel."
        : undefined;

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
  roster: "collect",
  bank: "collect",
  invites: "collect",
  documents: "obligations",
  budget: "obligations",
  insurance: "obligations",
  reserves: "obligations",
  board: "everything-else",
  vendors: "everything-else",
  amenities: "everything-else",
  photo: "everything-else",
};

const PHASE_META: { id: PlanPhaseId; title: string; outcome: string }[] = [
  {
    id: "collect",
    title: "Start collecting",
    outcome: "Finish these and the association can take a payment.",
  },
  {
    id: "obligations",
    title: "What you owe owners",
    outcome: "The records members are entitled to ask for, and the ones a lender wants at closing.",
  },
  {
    id: "everything-else",
    title: "The rest",
    outcome: "None of this is urgent. It makes the association easier to run.",
  },
];

export function buildPlan(community: Community, profile: AssociationProfile) {
  const phases: PlanPhase[] = PHASE_META.map((meta) => {
    const tasks: PlanTask[] = SETUP_TASKS.filter(
      (task) => PHASE_OF[task.key] === meta.id && applies(task, profile),
    ).map((task) => ({
      ...task,
      complete: task.done(community),
      because: because(task, profile),
    }));

    const done = tasks.filter((t) => t.complete).length;
    return {
      ...meta,
      tasks,
      done,
      total: tasks.length,
      complete: tasks.length > 0 && done === tasks.length,
    };
  }).filter((phase) => phase.total > 0);

  const all = phases.flatMap((p) => p.tasks);
  const done = all.filter((t) => t.complete).length;
  const collect = phases.find((p) => p.id === "collect");

  return {
    phases,
    done,
    total: all.length,
    percent: all.length ? done / all.length : 1,
    /** The milestone worth announcing, rather than burying at 3 of 11. */
    canCollect: Boolean(collect?.complete),
    allDone: all.length > 0 && done === all.length,
    /** What we removed by asking three questions instead of showing everything. */
    skipped: SETUP_TASKS.length - all.length,
  };
}
