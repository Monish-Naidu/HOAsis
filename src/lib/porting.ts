import type { AssociationOrigin, PreviousSetup } from "@/lib/data/new-community";

/**
 * The first weeks, whichever way an association arrives.
 *
 * Three situations, and not one of them is a records migration.
 *
 *   A builder is standing the association up. Nothing exists yet, and what
 *   goes wrong is not migration, it is constitution: no EIN, no registered
 *   agent, a bank account in a project manager's own name, and dues nobody is
 *   charging on the lots the builder still owns.
 *
 *   Owners are taking control from the builder. Everything exists and somebody
 *   else built it, including the reserve balance and the condition of the
 *   roads. Their job is to find out what they are being handed while the
 *   window to object is still open, and that window is set by statute and by
 *   the construction warranty rather than by how busy the new board is.
 *
 *   An established association is opening its books here. It has a decade of
 *   history and none of it moves. One opening balance per home on the day it
 *   switches makes it correct from there, and reproducing somebody else's
 *   ledger is both where migrations stall and a version that is never right.
 *
 * Since 2026-10-04 this is no longer a second numbered list beside the setup
 * list. It keeps a short paragraph for the board's situation and the two
 * steps (an EIN, the registration) the list lacks.
 *
 * The order of each list was the substance of it. The turnover study comes
 * before the release is signed, because signing is what ends the argument, and
 * the opening balances come before the first run of dues, because a bill sent
 * against the wrong balance is the one that loses an association its
 * credibility in week one.
 */

export interface PortingStep {
  key: string;
  title: string;
  /** What to do, in one sentence. */
  detail: string;
  /** Why it is in this position, when the order is not obvious. */
  because?: string;
  href?: string;
}

export interface PortingPlan {
  title: string;
  lede: string;
  /**
   * Whether the lede says something the one setup list does not. For an
   * association moving its books the list already says it (opening balances),
   * so the paragraph would only repeat it and is left out.
   */
  introduces: boolean;
  /**
   * Only the steps the setup list has no item for: the paperwork a newly
   * formed association needs, a builder's unsold lots and reserves, and a
   * turnover board's steps before it signs. The rest were list items already.
   */
  steps: PortingStep[];
}

const EIN: PortingStep = {
  key: "ein",
  title: "Get an EIN",
  detail: "Free from the IRS on Form SS-4, in about fifteen minutes. Never pay anyone for one.",
  because: "A bank will not open an account in the association's name without it, so this comes first.",
  href: "/library/first-30-days-self-managed-board",
};

const REGISTER: PortingStep = {
  key: "register",
  title: "Register the association and name a registered agent",
  detail:
    "A nonprofit corporation with your state, and a person or service at a real address who accepts legal papers for it.",
  because:
    "Letting it lapse can suspend the right to enforce an assessment lien, and in some states makes directors personally liable. It is far cheaper to start it than to revive it.",
  href: "/library/first-30-days-self-managed-board",
};

/** The two steps a newly formed association has and the setup list lacks. */
export const BEFORE_THE_BANK: PortingStep[] = [EIN, REGISTER];

/** A board taking over from the builder, before it signs anything. Wording from the old advice card. */
export const HANDOVER_STEPS: PortingStep[] = [
  {
    key: "turnover-study",
    title: "Get an independent turnover study, before you sign a release",
    detail: "An engineer inspects the common areas and the construction. A CPA reviews the books from the first day the association existed.",
    because: "This is the whole thing. A release signed before the study is a release signed without knowing what it gives up, and it is the one document a builder always has ready.",
    href: "/library/developer-turnover-checklist",
  },
  {
    key: "reserve-check",
    title: "Check what the reserve account actually holds",
    detail: "Against the study, and against what the declaration says the builder owed. Ask for the deposit history, not the balance.",
    because: "A balance tells you where you are. The deposit history tells you whether the builder funded reserves all along or topped it up the week before turnover.",
    href: "/board/reserves",
  },
  {
    key: "unsold-dues",
    title: "Ask what the builder paid on the lots it owned",
    detail: "Every unsold lot owed an assessment, or the builder owed the deficit. Get the ledger showing which, and that it was paid.",
    because: "It is the most commonly skipped obligation in the category, and the amount is usually large enough to matter. It also gets harder to collect the day the builder dissolves the entity.",
    href: "/board/money",
  },
  {
    key: "warranty",
    title: "Write down when the construction warranties end",
    detail: "Roads, roofs, the pool, the drainage. Each has its own clock, and some start at recording rather than at handover.",
    because: "A defect found the month after a warranty expires is the association's, permanently. Knowing the dates is what makes the inspection worth doing now rather than in spring.",
  },
  {
    key: "records",
    title: "Take the records in a form you can use",
    detail: "The roster with balances, the ledger, contracts, insurance, minutes, the reserve study, and every recorded document.",
    because: "Ask while the builder still wants the handover to go smoothly. Afterwards you are a former counterparty rather than a partner.",
    href: "/board/documents",
  },
  {
    key: "handover-board",
    title: "Seat your own board and remove the builder's signers",
    detail: "New signature cards at the bank the same week, and their access removed the day control passes.",
    because: "An account somebody else can still reach is an account you cannot reconcile, and the gap tends to be months rather than days.",
    href: "/board/settings",
  },
];

/** What a builder standing the association up has to do beyond the bank paperwork. */
export const BUILDER_STEPS: PortingStep[] = [
  {
    key: "unsold",
    title: "Decide what the unsold lots pay, and write it down",
    detail: "Either the builder pays the full assessment on every lot it still owns, or it funds the deficit between what owners pay and what the budget needs.",
    because: "This is the single largest source of turnover litigation. Whichever the declaration says, the association's books have to show it happening from the first month.",
    href: "/board/money",
  },
  {
    key: "builder-reserves",
    title: "Fund reserves from the first assessment",
    detail: "Get a study while the components are new and their replacement dates are known exactly.",
    because: "A budget that omits reserves sets a low first-year due, and the board that inherits it has to raise dues in its first month. That is the handover everybody remembers.",
    href: "/board/reserves",
  },
];

/**
 * An association being formed: a builder standing one up, or owners starting
 * one from nothing. A board taking over or already running one has these done.
 */
export function newlyFormed(origin: AssociationOrigin | undefined, previously?: PreviousSetup) {
  return origin === "builder" || (origin === "existing" && previously === "fresh");
}

const PLANS: Record<AssociationOrigin, Omit<PortingPlan, "steps">> = {
  builder: {
    title: "Stand it up properly",
    lede: "There is nothing to move, which is the easy part. What a builder gets wrong is the association existing properly on paper, and dues on the lots that have not sold.",
    introduces: true,
  },
  handover: {
    title: "Find out what you are being handed",
    lede: "The builder is giving you an association it built. Most of what matters is decided before you sign anything, and some of it stops being fixable on a date nobody will remind you about.",
    introduces: true,
  },
  existing: {
    title: "Open your books here",
    lede: "You already have all of this and none of it has to move. Set what each home owes on the day you switch, and you are correct from there.",
    introduces: false,
  },
};

export function portingPlan(
  origin: AssociationOrigin | undefined,
  previously?: PreviousSetup,
): PortingPlan | null {
  if (!origin) return null;
  const steps = [
    ...(newlyFormed(origin, previously) ? BEFORE_THE_BANK : []),
    ...(origin === "builder" ? BUILDER_STEPS : []),
    ...(origin === "handover" ? HANDOVER_STEPS : []),
  ];
  const base = PLANS[origin];
  if (origin !== "existing") return { ...base, steps };
  if (previously === "fresh") {
    return {
      title: "Start it properly",
      lede: "There is nothing to move, which is the easy part. What a new association gets wrong is existing properly on paper before it takes a dollar.",
      introduces: true,
      steps,
    };
  }
  if (previously === "manager") {
    return {
      title: "Take the work in house",
      lede: "Your manager held the records; now you do. Ask for them back in writing, with a date: the register, the ledger as of your last statement, the bank signatories, the contracts and the recorded documents. They belong to the association, not the firm.",
      introduces: true,
      steps,
    };
  }
  if (previously === "platform") {
    return {
      ...base,
      title: "Move the books here",
      lede: "Nothing has to be exported except one number per home: what each owes on the day you switch. The history stays where it is, and you are correct from there.",
      steps,
    };
  }
  return { ...base, steps };
}
