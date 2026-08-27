import type { AssociationOrigin } from "@/lib/data/new-community";

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
 * The order of each list is the substance of it. The turnover study comes
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
  steps: PortingStep[];
}

const PLANS: Record<AssociationOrigin, PortingPlan> = {
  builder: {
    title: "Stand it up properly",
    lede: "There is nothing to move, which is the easy part. What a builder gets wrong is the association existing properly on paper, and dues on the lots that have not sold.",
    steps: [
      {
        key: "ein",
        title: "Get an Employer Identification Number",
        detail:
          "Free from the IRS on Form SS-4, in about fifteen minutes. Never pay anyone for one.",
        because:
          "A bank will not open an account in the association's name without it, so this comes first.",
      },
      {
        key: "registered",
        title: "Register the association and name a live agent",
        detail:
          "Most associations are nonprofit corporations and owe the state an annual report. Several states also want a separate association registration.",
        because:
          "Letting it lapse can suspend the right to enforce an assessment lien, and in some states makes directors personally liable. It is far cheaper to start it than to revive it.",
        href: "/library/first-30-days-self-managed-board",
      },
      {
        key: "bank",
        title: "Open the account in the association's name",
        detail:
          "Not the development company's, and not a project manager's. Two signatures on anything above a threshold, from day one.",
        because:
          "An account in the builder's name is the finding that turns a routine handover into a dispute, and it is far harder to change later.",
        href: "/admin/money",
      },
      {
        key: "unsold",
        title: "Decide what the unsold lots pay, and write it down",
        detail:
          "Either the builder pays the full assessment on every lot it still owns, or it funds the deficit between what owners pay and what the budget needs.",
        because:
          "This is the single largest source of turnover litigation. Whichever the declaration says, the association's books have to show it happening from the first month.",
        href: "/admin/money",
      },
      {
        key: "documents",
        title: "Put the recorded documents in, as text",
        detail:
          "The declaration you recorded, the bylaws, and the rules. Buyers can then search them in plain words before they close.",
        because:
          "Several states make the association, not the seller, responsible for giving a new member the covenants. Doing it at closing is much easier than doing it in arrears.",
        href: "/admin/documents/import",
      },
      {
        key: "reserves",
        title: "Fund reserves from the first assessment",
        detail:
          "Get a study while the components are new and their replacement dates are known exactly.",
        because:
          "A budget that omits reserves sets a low first-year due, and the board that inherits it has to raise dues in its first month. That is the handover everybody remembers.",
        href: "/admin/reserves",
      },
    ],
  },

  handover: {
    title: "Find out what you are being handed",
    lede: "The builder is giving you an association it built. Most of what matters is decided before you sign anything, and some of it stops being fixable on a date nobody will remind you about.",
    steps: [
      {
        key: "turnover-study",
        title: "Get an independent turnover study, before you sign a release",
        detail:
          "An engineer inspects the common areas and the construction. A CPA reviews the books from the first day the association existed.",
        because:
          "This is the whole thing. A release signed before the study is a release signed without knowing what it gives up, and it is the one document a builder always has ready.",
        href: "/library/developer-turnover-checklist",
      },
      {
        key: "reserve-check",
        title: "Check what the reserve account actually holds",
        detail:
          "Against the study, and against what the declaration says the builder owed. Ask for the deposit history, not the balance.",
        because:
          "A balance tells you where you are. The deposit history tells you whether the builder funded reserves all along or topped it up the week before turnover.",
        href: "/admin/reserves",
      },
      {
        key: "unsold-dues",
        title: "Ask what the builder paid on the lots it owned",
        detail:
          "Every unsold lot owed an assessment, or the builder owed the deficit. Get the ledger showing which, and that it was paid.",
        because:
          "It is the most commonly skipped obligation in the category, and the amount is usually large enough to matter. It also gets harder to collect the day the builder dissolves the entity.",
        href: "/admin/money",
      },
      {
        key: "warranty",
        title: "Write down when the construction warranties end",
        detail:
          "Roads, roofs, the pool, the drainage. Each has its own clock, and some start at recording rather than at handover.",
        because:
          "A defect found the month after a warranty expires is the association's, permanently. Knowing the dates is what makes the inspection worth doing now rather than in spring.",
      },
      {
        key: "records",
        title: "Take the records in a form you can use",
        detail:
          "The roster with balances, the ledger, contracts, insurance, minutes, the reserve study, and every recorded document.",
        because:
          "Ask while the builder still wants the handover to go smoothly. Afterwards you are a former counterparty rather than a partner.",
        href: "/admin/documents",
      },
      {
        key: "board",
        title: "Seat your own board and remove the builder's signers",
        detail:
          "New signature cards at the bank the same week, and their access removed the day control passes.",
        because:
          "An account somebody else can still reach is an account you cannot reconcile, and the gap tends to be months rather than days.",
        href: "/admin/settings",
      },
    ],
  },

  existing: {
    title: "Open your books here",
    lede: "You already have all of this and none of it has to move. Set what each home owes on the day you switch, and you are correct from there.",
    steps: [
      {
        key: "homes",
        title: "Put every home on the register",
        detail:
          "Take the lot or unit numbers from the plat and add the owners you have. Nothing needs to come out of another system.",
        because:
          "A home that is not on the register has no balance, no vote and no way to sign in, so everything downstream is short by one.",
        href: "/admin/homeowners",
      },
      {
        key: "balances",
        title: "Set the opening balance for every home",
        detail:
          "What each household owed on the day you switched, as one figure. Nothing before that date has to come across.",
        because:
          "This is the step that makes a switch work end to end. Importing years of history is where migrations stall, and one opening figure per home is enough to be correct from here.",
        href: "/admin/homeowners/opening-balances",
      },
      {
        key: "documents",
        title: "Put the governing documents in as text",
        detail:
          "The recorded declaration, the bylaws, and whatever rules the board has adopted since.",
        because:
          "Owners can then search them in plain words instead of asking a board member, which is where most of the disputes in a self-run association start.",
        href: "/admin/documents/import",
      },
      {
        key: "reserves",
        title: "Enter the reserve study you already have",
        detail:
          "The components, what is left on each, and what it will cost. If the study is more than three years old, that is worth knowing now.",
        because:
          "The budget and the study normally live in separate files, so nobody sees the connection until the year a special assessment lands. Together they name that year in advance.",
        href: "/admin/reserves",
      },
      {
        key: "vendors",
        title: "Add whoever you pay",
        detail: "Landscaper, pool, insurance. Note which ones you still owe a W-9.",
        because:
          "January is when a missing W-9 becomes a problem, and by then they may not answer.",
        href: "/admin/vendors",
      },
    ],
  },
};

export function portingPlan(origin: AssociationOrigin | undefined): PortingPlan | null {
  return origin ? PLANS[origin] : null;
}
