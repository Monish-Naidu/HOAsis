import type { GoverningTopic } from "@/lib/types";

/**
 * Starter policies a board adopts, edits first.
 *
 * The reasoning for shipping these and not shipping a declaration is in
 * `docs/decisions/shipping-document-templates.md`. The short version: the board
 * already holds the authority to adopt a rule, these are not recorded against
 * anybody's land, and several states require a board to have written policies
 * of exactly this kind before it may enforce anything.
 *
 * What boards get wrong here is not the wording, it is that the document does
 * not exist. A volunteer treasurer who has never adopted a collections policy
 * is not going to draft one from a blank page; they will keep sending letters
 * they cannot defend at a hearing. Supplying the shape, with the obligation it
 * answers to named, is the difference.
 *
 * Every one of these is a draft. Nothing here is adopted by loading it, and
 * each carries the statute it answers to so a board can check the claim rather
 * than trust it.
 */
export interface PolicyTemplate {
  id: string;
  /** What the policy is called once adopted. */
  title: string;
  /** A number that will not collide with the seeded rule set. Editable. */
  suggestedNumber: string;
  topic: GoverningTopic;
  affects: "owners" | "board" | "both";
  /** Why a board needs this one, in the terms that make it urgent. */
  why: string;
  /** The obligation it answers to, named so it can be checked. */
  basis: string;
  /** The proposed wording. Paragraphs. */
  text: string[];
  /** The plain reading the board can keep or rewrite. */
  plain: string;
}

export const policyTemplates: PolicyTemplate[] = [
  {
    id: "pol-collections",
    title: "Collections policy",
    suggestedNumber: "Section 8.1",
    topic: "money",
    affects: "both",
    why: "The most common reason a delinquency case falls apart. Without a written policy adopted in advance, a board is deciding each case as it comes, and 'you charged him a late fee and not her' is what an owner's lawyer opens with.",
    basis:
      "Washington RCW 64.90.485 and its equivalents require notice before a lien is enforced. Several states, and most collection attorneys, require an adopted written policy before any charge beyond the assessment itself.",
    text: [
      "Section 1. An assessment is due on the first day of the period it covers and is delinquent if not received within fifteen days.",
      "Section 2. A delinquent assessment accrues a late charge of the lesser of twenty dollars or ten percent of the delinquent amount, once per delinquent assessment, and interest at twelve percent per annum from the date of delinquency.",
      "Section 3. The Association shall follow the same sequence for every delinquent account: a reminder at fifteen days, a written notice of delinquency at thirty days stating the amount and the consequence, a final notice before referral at sixty days, and referral to counsel no earlier than ninety days.",
      "Section 4. Payments are applied first to assessments, then to late charges, then to interest, then to collection costs. An Owner may not be prevented from curing a delinquency by having a payment applied first to fees.",
      "Section 5. The Board shall consider a written request for a payment plan and shall not refer an account to counsel while the Owner is current under an approved plan.",
      "Section 6. This policy applies to every account without exception. A deviation for one Owner requires a recorded Board vote stating the reason.",
    ],
    plain:
      "Dues are late after fifteen days. From there the same sequence runs for everybody: a reminder, a notice, a final notice, then the lawyers, on a fixed calendar rather than on whoever the board is annoyed with. What you pay comes off the dues first, so paying can actually clear the debt. Ask for a payment plan and the board has to consider it.",
  },
  {
    id: "pol-records",
    title: "Records inspection policy",
    suggestedNumber: "Section 8.2",
    topic: "records",
    affects: "both",
    why: "An owner asks to see the books, the board does not answer, and a routine request becomes a lawsuit. A written procedure with a clock in it turns the same request into a task.",
    basis:
      "Washington RCW 64.90.495 sets an inspection right, a response period, and a closed list of records that may be withheld. Every state researched has an equivalent.",
    text: [
      "Section 1. A request to inspect the Association's records shall be in writing and shall describe the records sought with reasonable particularity.",
      "Section 2. The Association shall respond within ten business days by making the records available at a reasonable time and place, by delivering copies, or by stating in writing which records are withheld and the specific provision relied upon.",
      "Section 3. The Association may charge the actual cost of copying. It may not charge for staff or volunteer time spent locating or reviewing records.",
      "Section 4. Records that may be withheld are limited to those the governing statute permits, and shall not be withheld merely because the request is inconvenient or the requester is in dispute with the Association.",
      "Section 5. A record posted to the Association's website or portal satisfies a request for that record.",
    ],
    plain:
      "Ask in writing and say what you want. Ten business days to answer. You pay for copies, not for their time. Being in an argument with the board is not a reason to refuse, and anything already on the portal counts as answered.",
  },
  {
    id: "pol-enforcement",
    title: "Enforcement and fine schedule",
    suggestedNumber: "Section 8.3",
    topic: "enforcement",
    affects: "both",
    why: "A fine imposed without a schedule adopted in advance is a fine invented for one household. Boards routinely lose these at a hearing on that ground alone, before anybody gets to whether the violation happened.",
    basis:
      "Due process for association fines is settled almost everywhere: notice of the provision relied upon, an opportunity to be heard, and a schedule adopted before the conduct rather than after it.",
    text: [
      "Section 1. A notice of violation shall state the provision alleged to have been violated, the facts relied upon, what would cure the violation, the date by which a cure is required, and the Owner's right to request a hearing before the Board.",
      "Section 2. No fine shall be imposed for a violation cured within the period stated in the notice.",
      "Section 3. The schedule of fines is: first violation, written notice and no fine; second violation of the same provision within twelve months, fifty dollars; each subsequent violation, one hundred dollars. A continuing violation may be fined once per thirty day period after the cure date.",
      "Section 4. An Owner may request a hearing within fourteen days of the notice. No fine is imposed and no further step is taken until the hearing is held and the decision delivered in writing.",
      "Section 5. The Association shall enforce uniformly. Where the Board becomes aware of the same conduct at more than one home, it shall proceed against each or against none.",
      "Section 6. A complaint from another resident is an input to an investigation and is never itself the basis for a notice. The Board shall verify the facts independently before any notice is issued.",
    ],
    plain:
      "You get told exactly what rule you broke and what would fix it, and time to fix it. Fix it and there is no fine. First time is a warning, second time in a year is fifty dollars, after that a hundred. You can ask for a hearing and nothing happens until it is held. And the board has to treat you the same as the neighbor doing the same thing.",
  },
  {
    id: "pol-reserves",
    title: "Reserve funding policy",
    suggestedNumber: "Section 8.4",
    topic: "money",
    affects: "board",
    why: "Underfunded reserves are the single largest financial risk a self-managed association carries, and the failure is gradual enough that no individual board ever has to be the one that caused it. A written policy is what survives a board turnover.",
    basis:
      "Washington RCW 64.90.550 requires a reserve study and a disclosure of whether reserves are being funded to it. Lenders ask for the same figure during underwriting.",
    text: [
      "Section 1. The Association shall obtain a reserve study prepared by a qualified preparer at least every three years, with an annual update to reflect actual expenditure and current costs.",
      "Section 2. The annual budget shall include a reserve contribution. Where the contribution is less than the amount the reserve study recommends, the budget shall state the shortfall and the Board shall state in writing why.",
      "Section 3. Reserve funds shall be held in an account separate from operating funds and shall not be used for operating expenses. A transfer from reserves to operating requires a recorded Board vote stating the reason and a plan for repayment.",
      "Section 4. The Association shall disclose to every Owner annually, and to any prospective purchaser on request, the current reserve balance, the amount the study recommends, and the percentage funded.",
    ],
    plain:
      "Get a reserve study every three years and update it yearly. Put a real contribution in the budget, and if the board funds less than the study says, it has to write down why. Reserve money sits in its own account and does not quietly pay for operating costs. Every owner is told the funded percentage once a year.",
  },
];
