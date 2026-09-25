import type { Account, BankAccount, Owner, Cents, ISODate, HomeType,
  Amenity,
} from "@/lib/types";
import type { LotPhase } from "@/lib/lots";
import type { Community } from "./community";
import { caps, GRANTABLE, NO_CAPABILITIES } from "./accounts";

import { architecturalForms } from "./settings";
import { messageTemplates } from "./templates";
import { wordingFor } from "@/lib/wording";
import { homeTypesOf, soleType } from "@/lib/home-types";
import { phaseFor } from "@/lib/lots";

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
export type PropertyType = HomeType;

/**
 * Who is setting this up.
 *
 * Three situations, and none of them is a records migration. Nothing here
 * imports a spreadsheet or pulls an export out of another product, because
 * that is a promise about somebody else's data format that we would then have
 * to keep. What every one of these needs is a correct opening position, and
 * that is a much smaller thing to ask for.
 *
 *   The builder is standing the association up before, or while, the homes
 *   sell. Most lots are unsold and the builder owns them, which means the
 *   builder owes the assessment on them. Their job is to constitute the thing
 *   properly and to hand over books that survive an audit.
 *
 *   A handover is the other side of the same event. Owners have elected their
 *   own board and are taking control from the developer. Their job is to find
 *   out what they are being handed before the window to object closes: the
 *   reserves, the construction, and whether the builder paid on the lots it
 *   still owned.
 *
 *   An established association is one that already exists and is opening its
 *   books here. It has years of history, and none of it moves. It sets one
 *   opening balance per home as of the day it switches, and is correct from
 *   there. Trying to reproduce a decade of somebody else's ledger is how a
 *   migration stalls, and the reproduced version is never right anyway.
 */
export type AssociationOrigin = "builder" | "handover" | "existing";

/**
 * Where an established association is coming from.
 *
 * Three answers, none of them a migration: a manager ran it and the board is
 * taking the work in house; another platform held the books and the board
 * is moving; or nothing did, because the association is new and the owners
 * are starting it themselves. The plan's first weeks differ for each.
 */
export type PreviousSetup = "manager" | "platform" | "fresh";

/** Anything the association bills beyond a flat due. */
export type ExtraCollection = "special-assessment" | "utilities";

/** Shared spaces, which drive both reservations and reserve components. */
export type SharedSpace = "pool" | "clubhouse" | "gym" | "playground" | "gate" | "elevator";

/** The persisted form of the three onboarding answers. */
export interface AssociationProfileAnswers {
  /** The one kind, when there is one. Unset for a mix. */
  propertyType?: PropertyType;
  /** Every kind present. Read through `homeTypesOf`. */
  homeTypes?: PropertyType[];
  origin?: AssociationOrigin;
  previously?: PreviousSetup;
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
  /**
   * Per kind of home, when a mixed community bills kinds differently. Unset
   * means every home pays `duesCents`.
   */
  duesByType?: Partial<Record<PropertyType, Cents>>;
  duesCadence: "monthly" | "quarterly" | "annually";
  /** Day of the month an assessment is billed. */
  dueDay: number;
  /** The person setting this up. They become President. */
  founder: {
    name: string;
    email: string;
    unit: string;
    address?: string;
    /** Only asked of a mixed community. */
    homeType?: PropertyType;
  };
  /** Every home in the community, not counting the founder's own. */
  households: DraftHousehold[];
  /**
   * Who built it, when the association knows.
   *
   * Named on the roster against every lot that has not sold, because an unsold
   * lot is not vacant: somebody owns it and owes the assessment on it, and a
   * roster that leaves those blank is a budget that is short.
   */
  builderName?: string;
  /** What the plat calls a lot. Printed as part of the number. */
  lotPrefix?: string;
  /** The ranges the homes were generated from, kept so they can be edited. */
  phases?: LotPhase[];
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
  /**
   * Every kind of home in the community. One answer for most; a new build
   * often has two or three. `propertyType` is kept in step when there is one.
   */
  homeTypes?: PropertyType[];
  origin?: AssociationOrigin;
  /** Only asked of an established association. */
  previously?: PreviousSetup;
  collects: ExtraCollection[];
  sharedSpaces: SharedSpace[];
  /**
   * Shared things the picker did not list: a dog park, a boat ramp, a
   * community garden. Named by the board, reservable like the rest.
   */
  customSpaces?: string[];
  /**
   * How homes are told apart. Numbered ranges suit a plat or a condominium;
   * a subdivision of detached houses goes by street address and has no
   * numbers to give. Unset means whichever the wording suggests.
   */
  homeNaming?: HomeNaming;
}

export type HomeNaming = "numbers" | "addresses";

export interface DraftHousehold {
  /**
   * The household, once there is one.
   *
   * Empty on a lot that has not sold. That is a real state in a new build and
   * not a gap to be filled in: the home exists, it owes an assessment, and it
   * counts toward a quorum long before anybody moves in.
   */
  name: string;
  email: string;
  /** The register key. A number, or the address itself where there is none. */
  unit: string;
  /** The street address, when the board has it. */
  address?: string;
  /** Which kind of home, in a mixed community. */
  homeType?: PropertyType;
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
  return draftDuesTotal(draft) * perYear;
}

/** What one home in the draft pays per period. */
export function draftDuesFor(draft: CommunityDraft, homeType?: PropertyType): Cents {
  const own = homeType ? draft.duesByType?.[homeType] : undefined;
  return own && own > 0 ? own : draft.duesCents;
}

/**
 * The founder's kind of home. Their number sits inside one of the ranges,
 * and the site plan is the authority on what that number is; failing that,
 * whatever they picked, and failing that the first kind.
 */
export function founderHomeType(draft: CommunityDraft): PropertyType | undefined {
  const types = homeTypesOf(draft);
  const inRange = phaseFor(draft.phases ?? [], draft.lotPrefix ?? "", founderUnit(draft))?.homeType;
  const picked = inRange ?? draft.founder.homeType;
  return picked && types.includes(picked) ? picked : types[0];
}

/** Every home's dues in the draft, per period, the founder's included. */
export function draftDuesTotal(draft: CommunityDraft): Cents {
  const types = homeTypesOf(draft);
  const founderType = founderHomeType(draft);
  return otherHomes(draft).reduce(
    (sum, h) => sum + draftDuesFor(draft, h.homeType ?? types[0]),
    draftDuesFor(draft, founderType),
  );
}

/** Homes in the association: the roster, including the founder's own. */
/**
 * Every home except the founder's own.
 *
 * The founder's lot is entered separately and is also one of the lots the plat
 * generates, so it arrives in the list twice. Left alone that is a duplicate
 * owner on the roster, two ledgers for one home, and a unit count one too
 * high, and all three are the quiet kind of wrong. Whichever order the builder
 * fills the screen in, the founder's own lot belongs to the founder.
 */
export function otherHomes(draft: CommunityDraft): DraftHousehold[] {
  const mine = founderUnit(draft);
  return draft.households.filter((h) => h.unit.trim() !== "" && h.unit.trim() !== mine);
}

/**
 * What keys the founder's home on the register.
 *
 * The number when they gave one. Where a community goes by address and has
 * no numbers, the address is the key, so a home that was never numbered is
 * still one row with one balance and one vote.
 */
export function founderUnit(draft: CommunityDraft): string {
  return draft.founder.unit.trim() || draft.founder.address?.trim() || "";
}

/** Which way this draft names its homes, when the board has not said. */
export function defaultHomeNaming(draft: CommunityDraft): HomeNaming {
  const types = homeTypesOf(draft);
  const w = wordingFor(types, draft.origin);
  // Anything attached is numbered: a condo building and a row of townhomes
  // share one street address. Only an all-detached community goes by street.
  const attached = types.some((t) => t !== "single-family");
  return w.fromBuilder || attached ? "numbers" : "addresses";
}

/**
 * The draft as it is handed to whichever thing creates the association.
 *
 * Blank rows from the address list are dropped, the founder's key is settled,
 * and everything is trimmed once here rather than in two creators.
 */
export function finalizeDraft(draft: CommunityDraft): CommunityDraft {
  const unit = founderUnit(draft);
  const types = homeTypesOf(draft);
  const sole = soleType(types);
  // Every home carries its kind, so nothing downstream has to know whether
  // the answer was one kind or several. A home whose kind was never picked
  // is the first kind, which is what the form showed it as.
  const typed = (t?: PropertyType) => (t && types.includes(t) ? t : types[0]);
  // Amounts kept only for kinds present, and only when they differ.
  const byType = Object.fromEntries(
    types
      .map((t) => [t, draft.duesByType?.[t]] as const)
      .filter(([, cents]) => cents && cents > 0 && cents !== draft.duesCents),
  ) as CommunityDraft["duesByType"];
  return {
    ...draft,
    propertyType: sole,
    homeTypes: types,
    duesByType: types.length > 1 && Object.keys(byType ?? {}).length ? byType : undefined,
    founder: {
      ...draft.founder,
      unit,
      homeType: founderHomeType(draft),
    },
    households: draft.households
      .map((h) => ({
        ...h,
        name: h.name.trim(),
        email: h.email.trim(),
        unit: h.unit.trim(),
        address: h.address?.trim() || undefined,
        homeType: typed(h.homeType),
      }))
      .filter((h) => h.unit !== "" && h.unit !== unit),
    customSpaces: (draft.customSpaces ?? []).map((c) => c.trim()).filter(Boolean),
  };
}

export function unitCount(draft: CommunityDraft): number {
  return otherHomes(draft).length + 1;
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
  // A home without an address yet is shown by its number, in the community's
  // own words: "Lot 12" on a subdivision, "Unit 12" anywhere attached.
  const numbered = (unit: string) =>
    `${wordingFor(homeTypesOf(draft), draft.origin).numberExample} ${unit}`;
  const accountId = (unit: string) => `${id}-acct-${unit}`;

  const founderOwner: Owner = {
    id: ownerId(draft.founder.unit),
    displayName: draft.founder.name,
    members: [draft.founder.name],
    email: draft.founder.email,
    phone: "",
    unit: draft.founder.unit,
    address: draft.founder.address?.trim() || numbered(draft.founder.unit),
    moveInDate: asOf,
    balanceCents: 0,
    autopay: false,
    standing: "current",
    daysPastDue: 0,
    boardRole: "President",
    homeType: draft.founder.homeType,
  };

  // An unsold lot is held by the builder, and saying so on the roster is the
  // whole point of creating it. A blank row reads as missing data; a row
  // naming the builder reads as the assessment somebody owes.
  const unsoldLabel = draft.builderName?.trim() || "Unsold";

  const otherOwners: Owner[] = otherHomes(draft).map((household) => {
    const sold = Boolean(household.name.trim());
    return {
      id: ownerId(household.unit),
      displayName: sold ? household.name : unsoldLabel,
      members: sold ? [household.name] : [],
      email: household.email,
      phone: "",
      unit: household.unit,
      address: household.address?.trim() || numbered(household.unit),
      moveInDate: asOf,
      balanceCents: 0,
      autopay: false,
      standing: "current",
      daysPastDue: 0,
      homeType: household.homeType,
    };
  });

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

  // Only a home with somebody in it gets a login. An unsold lot has nobody to
  // sign in as, and creating an account for one would put a resident seat in
  // the roster that can never be used.
  const otherAccounts: Account[] = otherOwners
    .filter((owner) => owner.members.length > 0)
    .map((owner) => ({
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
      homeTypes: homeTypesOf(draft),
      origin: draft.origin,
      previously: draft.previously,
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
      duesByType: draft.duesByType,
      duesCadence: draft.duesCadence,
      addressLine: `${draft.city}, ${draft.stateName}`,
      managedBy: "self",
      joinCode: draft.name.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "JOINUS",
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
    invoices: [],

    requests: [],
    violations: [],
    violationReports: [],
    documents: [],
    // A new association has uploaded nothing yet, so there is no text to
    // read. The bylaw screens point at the file list instead of pretending
    // to a document that does not exist.
    governingDocs: [],
    governingAmendments: [],

    meetings: [],
    ballots: [],
    threads: [],
    announcements: [],
    posts: [],

    // The shared spaces named during setup are the amenities owners reserve,
    // so they arrive listed rather than asked for a second time in the plan.
    amenities: amenitiesFromSpaces(draft.sharedSpaces, draft.customSpaces),

    amenityBookings: [],
    joinRequests: [],
    actionItems: [],
    emailLog: [],
    amenityStatus: [],
    // Baseline forms ship with the product, so the architectural request
    // dropdown is useful before the board has uploaded anything of their own.
    // The fixture's "uploaded" examples are the demo board's, not this one's.
    forms: architecturalForms
      .filter((form) => form.source === "baseline")
      .map((form) => ({ ...form, updatedDate: asOf })),
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

/** Which shared spaces are things an owner can book. A gate is not. */
const RESERVABLE_SPACES: Partial<Record<SharedSpace, string>> = {
  pool: "Pool",
  clubhouse: "Clubhouse",
  gym: "Gym",
  playground: "Playground",
};

/** Amenity records for the reservable spaces named during setup. */
export function amenitiesFromSpaces(
  spaces: SharedSpace[],
  custom: string[] = [],
): (Amenity & { reservable: boolean })[] {
  const listed = spaces.flatMap((space) => {
    const name = RESERVABLE_SPACES[space];
    return name
      ? [{ id: `amenity-${space}`, name, status: "open" as const, detail: "", reservable: true }]
      : [];
  });
  // Anything the board named itself is something owners can book too; that
  // is why they bothered to name it.
  const own = custom
    .map((c) => c.trim())
    .filter(Boolean)
    .map((name) => ({
      id: `amenity-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      name,
      status: "open" as const,
      detail: "",
      reservable: true,
    }));
  return [...listed, ...own];
}

/** Names only, for a database insert. */
export function reservableSpaceNames(spaces: SharedSpace[], custom: string[] = []): string[] {
  return amenitiesFromSpaces(spaces, custom).map((a) => a.name);
}
