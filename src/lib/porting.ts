import type { AssociationOrigin } from "@/lib/data/new-community";

/**
 * Getting an association's history into the product.
 *
 * Three situations arrive here and they are not variations on one job.
 *
 *   A brand new association has nothing to move. Its risk is not being
 *   properly constituted: no EIN, no registered agent, a bank account in
 *   somebody's own name.
 *
 *   A board already self-managing has everything, scattered across a
 *   spreadsheet, a shared drive and one person's inbox. Its job is gathering.
 *
 *   A board leaving a management company has everything, held by somebody
 *   else, and a closing window. Its job is retrieval, and the order matters:
 *   demand the records before you cancel, because leverage disappears the day
 *   the contract ends.
 *
 * Giving all three the same checklist with reworded copy would be the same
 * mistake the old setup list made, one step further in.
 */

export interface PortingStep {
  key: string;
  title: string;
  /** What to do, in one sentence. */
  detail: string;
  /** Why it is in this position, when the order is not obvious. */
  because?: string;
  href?: string;
  /** Opens the letter writer rather than navigating. */
  action?: "records-letter";
}

export interface PortingPlan {
  title: string;
  lede: string;
  steps: PortingStep[];
}

const PLANS: Record<AssociationOrigin, PortingPlan> = {
  new: {
    title: "Make it official",
    lede: "You have nothing to move, which is the easy part. What a new association gets wrong is existing properly on paper.",
    steps: [
      {
        key: "ein",
        title: "Get an Employer Identification Number",
        detail:
          "Free from the IRS on Form SS-4, in about fifteen minutes. Never pay anyone for one.",
        because:
          "A bank will not open an account for the association without it, so this comes first.",
      },
      {
        key: "registered",
        title: "Check the association is registered and has a live agent",
        detail:
          "Most associations are nonprofit corporations and owe the state an annual report. Several states also want a separate HOA registration.",
        because:
          "Letting it lapse can suspend your right to enforce an assessment lien, and in some states makes directors personally liable.",
        href: "/library/first-30-days-self-managed-board",
      },
      {
        key: "bank",
        title: "Open the account in the association's name",
        detail: "Two signatures on anything above a threshold you set, from day one.",
        because:
          "Sole control of the money by one person is how self-management ends badly, and it is far harder to change later.",
        href: "/admin/money",
      },
      {
        key: "rules",
        title: "Write down the rules you actually enforce",
        detail: "A fine for breaking a rule that is not written down does not survive a challenge.",
        href: "/admin/documents",
      },
    ],
  },

  "self-managed": {
    title: "Bring your records in",
    lede: "You already have all of this. It is in a spreadsheet, a shared drive, and somebody's inbox. Getting it into one place is the whole job.",
    steps: [
      {
        key: "roster",
        title: "Import the roster",
        detail: "Paste it or upload the CSV. Any column order, and a header row is fine.",
        href: "/admin/homeowners",
      },
      {
        key: "balances",
        title: "Set the opening balance for every home",
        detail:
          "What each household owed on the day you switched. Nothing before that date has to move.",
        because:
          "Importing years of history is where migrations stall. One opening figure per home is enough to be correct from here.",
        href: "/admin/homeowners",
      },
      {
        key: "documents",
        title: "Upload the governing documents",
        detail: "Declaration, bylaws, articles, rules, the current budget and last year's figures.",
        href: "/admin/documents",
      },
      {
        key: "vendors",
        title: "Add whoever you pay",
        detail: "Landscaper, pool, insurance. Note which ones you still owe a W-9.",
        because: "January is when a missing W-9 becomes a problem, and by then they may not answer.",
        href: "/admin/vendors",
      },
    ],
  },

  "leaving-manager": {
    title: "Get your records back",
    lede: "Your manager holds the association's records, and they are the association's property, not theirs. The order below matters more than the speed.",
    steps: [
      {
        key: "demand",
        title: "Send the records demand, before you give notice",
        detail: "We will write it. Sign it and send it by a method that produces a receipt.",
        because:
          "This is the whole thing. A board that cancels first and asks afterwards gets a partial box months later. Ask while you are still the client.",
        action: "records-letter",
      },
      {
        key: "list",
        title: "Work the handover list",
        detail:
          "Bank statements, the ledger, the roster with balances, contracts, insurance, minutes, the reserve study and every governing document.",
        because: "Anything not on a list you wrote down is something you will find missing in April.",
        href: "/library/developer-turnover-checklist",
      },
      {
        key: "bank",
        title: "Move the bank account into the association's own name",
        detail:
          "Not a sub-account of theirs. New signature cards, and remove their access the day the contract ends.",
        because:
          "An account you cannot see is an account you cannot reconcile, and some agreements leave their name on it.",
        href: "/admin/money",
      },
      {
        key: "vendors",
        title: "Get the vendor contracts assigned to you",
        detail:
          "Ask each vendor to confirm in writing that the association is now the counterparty.",
        because:
          "Some contracts are held in the manager's name, not yours, and simply stop when they leave.",
        href: "/admin/vendors",
      },
      {
        key: "then-cancel",
        title: "Only then, give notice",
        detail: "Check the notice period in your agreement. Thirty to ninety days is usual.",
      },
    ],
  },
};

export function portingPlan(origin: AssociationOrigin | undefined): PortingPlan | null {
  return origin ? PLANS[origin] : null;
}

/**
 * The records demand, as a letter a board can sign.
 *
 * Deliberately not a template with blanks. A board that has to fill in blanks
 * writes a worse letter than the one we would have written, or does not send
 * it. What is left blank is only what we genuinely cannot know.
 *
 * It states the obligation rather than quoting a statute number. The deadlines
 * differ in every state and are the kind of detail that is wrong two sessions
 * later; the state's own article carries the citation, and the letter points
 * the board at it rather than putting an unverified number in writing over
 * their signature.
 */
export function recordsDemandLetter(input: {
  associationName: string;
  stateName: string;
  managerName?: string;
  boardMemberName: string;
  boardRole: string;
  today: string;
}): string {
  const manager = input.managerName?.trim() || "[management company]";
  return `${input.today}

${manager}

Re: Demand for association records, ${input.associationName}

To whom it may concern,

I write on behalf of the Board of Directors of ${input.associationName}.

The records of the Association are the property of the Association. We are
requesting that you produce complete copies of the following, in the electronic
formats in which you hold them:

  1.  All bank statements, cancelled checks and reconciliations, for the last
      three fiscal years and the current one.
  2.  The general ledger, accounts receivable ageing, and the assessment
      account history for every unit, showing balances as of today.
  3.  The owner roster, with mailing addresses, email addresses and unit
      numbers.
  4.  All executed vendor and service contracts currently in force, including
      any held in your name on the Association's behalf.
  5.  All insurance policies, declarations pages and claims history.
  6.  Minutes of every board and member meeting, and all board resolutions.
  7.  The current and prior adopted budgets, and the most recent reserve study
      together with any supporting schedules.
  8.  All governing documents, amendments and recorded instruments.
  9.  Architectural applications, approvals and denials, and the violation and
      enforcement file for every unit.
  10. All tax returns filed on the Association's behalf, and the workpapers.

Please confirm in writing within ten business days when these will be produced.
${input.stateName} law sets the period in which an association's records must be
made available; if that period is shorter than ten business days, we ask that
you meet it.

To be clear, this request is made while our agreement remains in force, and is
not notice of termination.

Please direct any questions to me.

Sincerely,


${input.boardMemberName}
${input.boardRole}, ${input.associationName}
`;
}
