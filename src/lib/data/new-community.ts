import type { Account, BankAccount, Owner, Cents, ISODate } from "@/lib/types";
import type { Community } from "./community";
import { caps, GRANTABLE, NO_CAPABILITIES } from "./accounts";

import { architecturalForms } from "./settings";
import { messageTemplates } from "./templates";

/**
 * Defaults nobody is asked about during setup.
 *
 * A calendar fiscal year and a ten day grace period are what most associations
 * run, and both are one control away in Settings. Asking about them up front
 * buys nothing and costs a screen.
 */
const FISCAL_YEAR_START = "01-01";
const DEFAULT_LATE_AFTER_DAY = 10;

/**
 * Building an association from what a board can answer in five minutes.
 *
 * Every other community in this repo is hand written. This one is not: it is
 * what a real board produces by going through onboarding, which means it starts
 * with no ledger, no reserve study, no documents, no history, and no vendors.
 *
 * That emptiness is the point. It is the state every new customer is in on
 * their first day, and any screen that cannot render it is a screen that breaks
 * for every association we ever sign.
 */

/**
 * What onboarding collects.
 *
 * Deliberately short. An association needs four things before it can take a
 * dollar: who it is, what each home owes, which homes there are, and where the
 * money lands. Everything else, including who else sits on the board, can be
 * done afterwards by someone who is already logged in and collecting.
 */
/**
 * What kind of homes these are.
 *
 * The single most useful thing to know and the one thing we never asked. It
 * decides whether shared utilities are even plausible, whether the association
 * carries a master policy over the structures or only over common areas, and
 * whether a reserve study is a statutory duty rather than good practice.
 */
export type PropertyType = "single-family" | "townhomes" | "condos";

/**
 * Where the board is coming from.
 *
 * A brand new association has nothing to bring. One that has been self managing
 * has books and documents somewhere. One leaving a management company has all
 * of it, held by somebody else, and their first real task is getting it back.
 * These are three different first weeks.
 */
export type AssociationOrigin = "new" | "self-managed" | "leaving-manager";

/** Anything the association bills beyond a flat due. */
export type ExtraCollection = "special-assessment" | "utilities";

/** Shared spaces, which drive both reservations and reserve components. */
export type SharedSpace = "pool" | "clubhouse" | "gym" | "playground" | "gate" | "elevator";

/** The persisted form of the three onboarding answers. */
export interface AssociationProfileAnswers {
  propertyType?: PropertyType;
  origin?: AssociationOrigin;
  collects: ExtraCollection[];
  sharedSpaces: SharedSpace[];
}

export interface CommunityDraft {
  name: string;
  city: string;
  /** Two letter code. Drives which library guidance applies. */
  state: string;
  stateName: string;
  duesCents: Cents;
  duesCadence: "monthly" | "quarterly" | "annually";
  /** Day of the month an assessment is billed. */
  dueDay: number;
  /** The person setting this up. They become President. */
  founder: { name: string; email: string; unit: string };
  /** Households the founder entered, not counting their own. */
  households: DraftHousehold[];
  /** Where dues land. Optional only because a board can connect it later. */
  bankAccount?: BankAccount;

  /**
   * Three facts about the association's situation, used to build its plan.
   *
   * Deliberately questions of fact rather than of preference. Asking a new
   * board "do you want to set up vendors" makes them model a consequence they
   * have no basis to model; asking whether a manager currently pays the
   * landscaper is something they simply know. We derive the rest.
   */
  propertyType?: PropertyType;
  origin?: AssociationOrigin;
  collects: ExtraCollection[];
  sharedSpaces: SharedSpace[];
}

export interface DraftHousehold {
  name: string;
  email: string;
  unit: string;
}

/** A URL-safe id from a name, with a suffix so two "Oak Ridge"s do not collide. */
function slugify(value: string, suffix: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "association"}-${suffix}`;
}

/** A short stable suffix derived from the name, so ids do not need a clock. */
function shortHash(value: string): string {
  let hash = 5_381;
  for (const ch of value) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  return hash.toString(36).slice(0, 4);
}

/** The next occurrence of `day` on or after `from`, as YYYY-MM-DD. */
function nextDueDate(from: ISODate, day: number): ISODate {
  const [year, month, today] = from.split("-").map(Number);
  const safeDay = Math.min(Math.max(1, day), 28);
  if (today < safeDay) {
    return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
  }
  const zero = year * 12 + month; // already advanced one month
  return `${Math.floor(zero / 12)}-${String((zero % 12) + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

/** Share of the fiscal year elapsed, so budget pace is honest from day one. */
function yearElapsedFrom(fiscalYearStart: string, asOf: ISODate): number {
  const [, startMonth] = fiscalYearStart.split("-").map(Number);
  const [, month, day] = asOf.split("-").map(Number);
  const monthsIn = (month - startMonth + 12) % 12;
  return Math.min(1, (monthsIn + day / 30) / 12);
}

/** Annualized assessment income, which is the only budget line we can infer. */
function annualDues(draft: CommunityDraft): Cents {
  const perYear = draft.duesCadence === "monthly" ? 12 : draft.duesCadence === "quarterly" ? 4 : 1;
  return draft.duesCents * perYear * unitCount(draft);
}

/** Homes in the association: the roster, including the founder's own. */
export function unitCount(draft: CommunityDraft): number {
  return draft.households.length + 1;
}

/**
 * Turns a completed draft into a community the app can run.
 *
 * Collections that a board has to fill in themselves stay empty rather than
 * being seeded with plausible looking sample data. A new association that opens
 * its ledger to invented transactions has no way to tell our fiction from their
 * facts, and the first thing they would have to do is delete it all.
 */
export function buildCommunity(draft: CommunityDraft, asOf: ISODate): Community {
  const suffix = shortHash(`${draft.name}|${draft.city}|${draft.founder.email}`);
  const id = slugify(draft.name, suffix);
  const ownerId = (unit: string) => `${id}-own-${unit}`;
  const accountId = (unit: string) => `${id}-acct-${unit}`;

  const founderOwner: Owner = {
    id: ownerId(draft.founder.unit),
    displayName: draft.founder.name,
    members: [draft.founder.name],
    email: draft.founder.email,
    phone: "",
    unit: draft.founder.unit,
    address: `Unit ${draft.founder.unit}`,
    moveInDate: asOf,
    balanceCents: 0,
    autopay: false,
    standing: "current",
    daysPastDue: 0,
    boardRole: "President",
  };

  const otherOwners: Owner[] = draft.households.map((household) => ({
    id: ownerId(household.unit),
    displayName: household.name,
    members: [household.name],
    email: household.email,
    phone: "",
    unit: household.unit,
    address: `Unit ${household.unit}`,
    moveInDate: asOf,
    balanceCents: 0,
    autopay: false,
    standing: "current",
    daysPastDue: 0,
  }));

  const owners = [founderOwner, ...otherOwners];

  const founderAccount: Account = {
    id: accountId(draft.founder.unit),
    ownerId: founderOwner.id,
    name: draft.founder.name,
    email: draft.founder.email,
    unit: draft.founder.unit,
    role: "president",
    // The President holds everything, including permissions, which is the one
    // capability that cannot be granted away.
    capabilities: caps([...GRANTABLE], true),
  };

  const otherAccounts: Account[] = otherOwners.map((owner) => ({
    id: accountId(owner.unit),
    ownerId: owner.id,
    name: owner.displayName,
    email: owner.email,
    unit: owner.unit,
    role: "resident" as const,
    capabilities: NO_CAPABILITIES,
  }));

  return {
    id,
    label: draft.name,
    asOf,
    nextChargeDate: nextDueDate(asOf, draft.dueDay),

    // Carried through so the plan can be rebuilt later without asking again.
    profile: {
      propertyType: draft.propertyType,
      origin: draft.origin,
      collects: draft.collects,
      sharedSpaces: draft.sharedSpaces,
    },

    association: {
      id,
      name: draft.name,
      shortName: draft.name.split(/\s+/).slice(0, 2).join(" "),
      state: draft.state,
      stateName: draft.stateName,
      unitCount: unitCount(draft),
      fiscalYearStart: FISCAL_YEAR_START,
      duesCents: draft.duesCents,
      duesCadence: draft.duesCadence,
      addressLine: `${draft.city}, ${draft.stateName}`,
      managedBy: "self",
    },

    settings: {
      displayName: draft.name,
      photoUrl: "",
      homeLayout: "calendar",
      banner: { enabled: false, title: "", detail: "", updatedDate: asOf },
      showFundsToResidents: true,
      showLiveVoteResults: false,
      autopayLateAfterDay: DEFAULT_LATE_AFTER_DAY,
      // No fee until pricing is settled. A board should never discover a charge
      // we had not told them about.
      paymentFeeCents: 0,
      paymentFeePaidBy: "association",
      paymentFeeWaivedOnAch: true,
      forumEnabled: true,
    },

    owners,
    accounts: [founderAccount, ...otherAccounts],
    instruments: [],

    // Nothing financial exists until they connect a bank and record something.
    bankAccounts: draft.bankAccount ? [draft.bankAccount] : [],
    ledger: [],
    budget: [
      {
        category: "Assessments",
        annualCents: annualDues(draft),
        ytdActualCents: 0,
        kind: "income",
      },
    ],
    yearElapsed: yearElapsedFrom(FISCAL_YEAR_START, asOf),
    reserveComponents: [],
    savingsOffers: [],
    // Nothing beyond a flat monthly due. A new association bills one thing,
    // and the shared cost and assessment screens stay out of its way until it
    // says otherwise.
    sharedCosts: [],
    sharedCostBills: [],
    specialAssessments: [],

    vendors: [],
    payouts: [],

    requests: [],
    violations: [],
    documents: [],
    // A new association has uploaded nothing yet, so there is no text to
    // read. The bylaw screens point at the file list instead of pretending
    // to a document that does not exist.
    governingDocs: [],
    governingAmendments: [],
    complianceItems: [],

    meetings: [],
    ballots: [],
    threads: [],
    announcements: [],
    posts: [],

    amenities: [],

    amenityBookings: [],
    amenityStatus: [],
    // Baseline forms ship with the product, so the architectural request
    // dropdown is useful before the board has uploaded anything of their own.
    forms: architecturalForms.map((form) => ({ ...form, updatedDate: asOf })),
    templates: messageTemplates.map((template) => ({ ...template, updatedDate: asOf })),

    ownerCharges: Object.fromEntries(owners.map((owner) => [owner.id, []])),
  };
}

/** An empty draft, so the wizard has something coherent to start from. */
export function emptyDraft(): CommunityDraft {
  return {
    name: "",
    city: "",
    state: "",
    stateName: "",
    duesCents: 0,
    duesCadence: "monthly",
    dueDay: 1,
    founder: { name: "", email: "", unit: "" },
    households: [],
    collects: [],
    sharedSpaces: [],
  };
}
