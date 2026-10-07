import type { Account, BankAccount, Home, Cents, ISODate, HomeType,
  Amenity,
} from "@/lib/types";
import type { LotPhase } from "@/lib/lots";
import type { Community } from "./community";
import { caps, GRANTABLE, NO_CAPABILITIES } from "./accounts";

import { architecturalForms } from "./settings";
import { messageTemplates } from "./templates";
import { isNumbered, wordingFor } from "@/lib/wording";
import { homeTypesOf, soleType } from "@/lib/home-types";
import { expandPhases, lotLabel, lotsInPhase, MAX_LOTS_PER_PHASE, phaseFor, phaseProblems } from "@/lib/lots";
import { addDays, nextDueOnOrAfter } from "@/lib/utils";
import { policyWithLateFee } from "@/lib/collections";
import { associationNameProblem, duesProblem } from "@/lib/input-checks";

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
  /**
   * The board bills by home: `duesCents` is what most homes pay, and a range
   * (`LotPhase.duesCents`) or a row (`DraftHousehold.duesCents`) may carry
   * its own amount. Kept apart from `duesByType`, which it replaces.
   */
  duesByHome?: boolean;
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
    /** Set by `finalizeDraft` from the founder's range, when it has its own amount. */
    duesCents?: Cents;
  };
  /** Every home in the community, not counting the founder's own. */
  households: DraftHousehold[];
  /**
   * Rows with an owner, an email or a balance that no range covers right now.
   *
   * Only the wizard's homes question reads this. A range being retyped passes
   * through shorter ones on the way, and a spreadsheet can arrive before any
   * range does; the rows wait here instead of being dropped, and go back into
   * `households` when a range covers their number (`rebuildLotHomes`). They
   * are not homes: nothing counts them or bills them, and `finalizeDraft`
   * leaves them behind, so they are never created.
   */
  parkedHouseholds?: DraftHousehold[];
  /**
   * The late fee the founder chose on the dues question. Unset or `charge`
   * false means no fee, which is what a new association starts with.
   */
  lateFee?: { charge: boolean; cents: Cents; days: number };
  /** What the plat calls a lot. Printed as part of the number. */
  lotPrefix?: string;
  /** The ranges the homes were generated from, kept so they can be edited. */
  phases?: LotPhase[];
  /**
   * Not asked by the wizard any more: money goes through Stripe, set up after
   * the association exists. Kept because the create path still honours one.
   */
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
  /**
   * This home's own amount, from a spreadsheet row or the address list. Wins
   * over its range's. Read only when the draft bills by home.
   */
  duesCents?: Cents;
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

/**
 * Share of the fiscal year elapsed, so budget pace is honest from day one.
 * Counted from the fiscal year's first month, since that is the year the
 * actuals beside it are summed over.
 */
export function yearElapsedFrom(fiscalYearStart: string, asOf: ISODate): number {
  // "MM-DD": the month is the first pair. Reading the second took the day
  // for the month, which only held while every year here began on 01-01.
  const startMonth = Number(fiscalYearStart.slice(0, 2)) || 1;
  const [, month, day] = asOf.split("-").map(Number);
  const monthsIn = (month - startMonth + 12) % 12;
  return Math.min(1, (monthsIn + day / 30) / 12);
}

/** Annualized assessment income, which is the only budget line we can infer. */
function annualDues(draft: CommunityDraft): Cents {
  const perYear = draft.duesCadence === "monthly" ? 12 : draft.duesCadence === "quarterly" ? 4 : 1;
  return draftDuesTotal(draft) * perYear;
}

/**
 * What one home in the draft pays per period: the rule `ownerDues` applies,
 * on the wizard's answers. A home's own amount (a row's, else its range's)
 * counts only when the draft bills by home; otherwise its kind's, else the
 * fallback.
 */
export function draftDuesFor(
  draft: CommunityDraft,
  homeType?: PropertyType,
  unit?: string,
  ownCents?: Cents,
): Cents {
  const own = draftOwnDues(draft, unit, ownCents);
  if (own) return own;
  const kind = homeType ? draft.duesByType?.[homeType] : undefined;
  return kind && kind > 0 ? kind : draft.duesCents;
}

/**
 * The amount a home carries of its own, or undefined. A row's amount wins
 * over its range's; one equal to the fallback is no amount of its own.
 */
export function draftOwnDues(draft: CommunityDraft, unit?: string, ownCents?: Cents): Cents | undefined {
  if (!draft.duesByHome) return undefined;
  const numbered = (draft.homeNaming ?? defaultHomeNaming(draft)) === "numbers";
  const range =
    numbered && unit
      ? phaseFor(draft.phases ?? [], draft.lotPrefix ?? "", unit)?.duesCents
      : undefined;
  const cents = ownCents && ownCents > 0 ? ownCents : range;
  return cents && cents > 0 && cents !== draft.duesCents ? cents : undefined;
}

/** How many homes in the draft carry an amount of their own. */
export function draftOwnDuesCount(entered: CommunityDraft): number {
  const draft = placeFounder(entered);
  if (!draft.duesByHome) return 0;
  const mine = founderLabel(draft);
  return (
    otherHomes(draft).filter((h) => draftOwnDues(draft, h.unit, h.duesCents)).length +
    (draftOwnDues(draft, mine) ? 1 : 0)
  );
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

/**
 * Every home's dues in the draft, per period, the founder's included.
 *
 * Counted on the draft as it will be created, with the founder placed among
 * the numbered homes (see placeFounder). Counted on the draft as typed, the
 * homes step promised "5 homes, $1,000" and the association was made with 4
 * and $800: the preview added a founder that creation folds into a range.
 */
export function draftDuesTotal(entered: CommunityDraft): Cents {
  const draft = placeFounder(entered);
  const types = homeTypesOf(draft);
  const founderType = founderHomeType(draft);
  return otherHomes(draft).reduce(
    (sum, h) => sum + draftDuesFor(draft, h.homeType ?? types[0], h.unit, h.duesCents),
    draftDuesFor(draft, founderType, founderLabel(draft)),
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
  const mine = founderLabel(draft);
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

/**
 * The founder's home as the register prints it.
 *
 * The founder is asked for a bare number ("12") a screen before the ranges
 * offer a prefix, and the ranges then print that home as "Lot 12". Matched
 * letter for letter those are two homes: the President on "12" and an unsold
 * "Lot 12" beside it, billed and counted toward quorum, 41 homes on a 40 lot
 * plat. So where ranges exist, the number is looked up in them and the
 * printed label is the key, whichever spelling was typed and in whatever
 * case. A community that goes by address has no ranges and is left alone.
 */
export function founderLabel(draft: CommunityDraft): string {
  const typed = founderUnit(draft);
  const phases = draft.phases ?? [];
  if (!typed || !phases.length) return typed;
  const prefix = draft.lotPrefix ?? "";
  const wanted = typed.toLowerCase();
  // "Lot 12" typed against ranges that print a bare "12" is the same home.
  const bare = wanted.replace(/^\D+/, "");
  for (const phase of phases) {
    // A range past the limit is a typo and creates no homes; not worth walking.
    if (lotsInPhase(phase) > MAX_LOTS_PER_PHASE) continue;
    for (let n = phase.from; n <= phase.to; n += 1) {
      // Trimmed, as `otherHomes` and `finalizeDraft` trim the rows they hold
      // against it. A prefix typed with a space in front (" A-") prints
      // " A-2", which no trimmed row equals, and the founder's lot was
      // created twice: once as theirs and once as an unsold home beside it.
      const label = lotLabel(prefix, n).trim();
      if (label.toLowerCase() === wanted || String(n) === wanted || String(n) === bare) return label;
    }
  }
  return typed;
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
 * Whether the homes question can be left.
 *
 * Ranges must produce at least one home, or the plan asks for the register
 * again on the next screen. A list of addresses may be empty: the founder's
 * own home is already one, and the rest can be added from the roster.
 *
 * Rows parked outside the ranges hold the question too. `finalizeDraft`
 * leaves them behind, so walking on with a 60 row file and a range typed as
 * 1 to 40 founded the association twenty owners short and said nothing. The
 * board either covers them with a range or says to leave them out.
 *
 * They are looked at before the way homes are named. That answer is only
 * stored once the board presses the switch; until then it follows the kinds
 * of home and where the association came from, so going Back and changing
 * either can turn a numbered list into one by address with rows still
 * parked. The address screen shows them and offers to leave them out.
 */
export function homesAnswered(draft: CommunityDraft): boolean {
  if (draft.parkedHouseholds?.length) return false;
  if ((draft.homeNaming ?? defaultHomeNaming(draft)) === "addresses") return true;
  // A range with a problem creates nothing, and an amount of zero is not "the
  // usual". Both are shown under the range, so Continue waits for them rather
  // than quietly dropping homes or swapping the amount.
  if (phaseProblems(draft.phases ?? []).length > 0) return false;
  if (draftOwnDuesProblem(draft)) return false;
  return expandPhases(draft.phases ?? [], draft.lotPrefix ?? "").length > 0;
}

/**
 * Whether any amount a range, row or the founder carries is one the dues
 * rules refuse: typed as zero, or past the per-period ceiling. Blank is fine,
 * it means the usual amount. Only checked while billing by home, the one
 * mode where those amounts are asked.
 */
export function draftOwnDuesProblem(draft: CommunityDraft): string | null {
  if (!draft.duesByHome) return null;
  const amounts = [
    draft.founder.duesCents,
    ...(draft.phases ?? []).map((p) => p.duesCents),
    ...draft.households.map((h) => h.duesCents),
  ];
  for (const cents of amounts) {
    const problem = duesProblem(cents);
    if (problem) return problem;
  }
  return null;
}

/** The association name, held to the same length the field allows. */
export function draftNameProblem(draft: CommunityDraft): string | null {
  return associationNameProblem(draft.name);
}

/** The collections policy the draft's late fee answer makes: no fee unless one was chosen. */
export function draftCollectionPolicy(draft: CommunityDraft) {
  const fee = draft.lateFee;
  return fee?.charge ? policyWithLateFee(fee.cents, fee.days) : policyWithLateFee(0, 0);
}

/**
 * Keeps the founder inside the ranges when homes are entered by number.
 *
 * A founder whose number is blank or matches no range used to become a home
 * of their own, keyed by their address, beside the homes the ranges made:
 * twelve units typed, thirteen created and billed. Where the founder is not
 * in the ranges they take the first home nobody is named on, so the count
 * stays what was typed. Addresses and unranged lists are left alone, as is a
 * list with no free home to give.
 */
export function placeFounder(draft: CommunityDraft): CommunityDraft {
  const phases = draft.phases ?? [];
  const byNumber = (draft.homeNaming ?? defaultHomeNaming(draft)) === "numbers";
  if (!byNumber || !phases.length) return draft;
  const mine = founderLabel(draft);
  const lots = expandPhases(phases, draft.lotPrefix ?? "").map((l) => l.trim());
  if (mine && lots.includes(mine)) return draft;
  const free = draft.households.find(
    (h) => h.unit.trim() !== "" && !h.name.trim() && !h.email.trim() && lots.includes(h.unit.trim()),
  );
  if (!free) return draft;
  return { ...draft, founder: { ...draft.founder, unit: free.unit.trim() } };
}

/**
 * The draft as it is handed to whichever thing creates the association.
 *
 * Blank rows from the address list are dropped, the founder's key is settled,
 * and everything is trimmed once here rather than in two creators.
 */
export function finalizeDraft(entered: CommunityDraft): CommunityDraft {
  const draft = placeFounder(entered);
  const unit = founderLabel(draft);
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
  // Billing by home replaces billing by kind. A home keeps an amount only
  // where it has one of its own: its row's, else its range's. If nobody has
  // one, every home pays the fallback and nothing else is stored.
  const byHome = Boolean(draft.duesByHome);
  return {
    ...draft,
    propertyType: sole,
    homeTypes: types,
    duesByType:
      !byHome && types.length > 1 && Object.keys(byType ?? {}).length ? byType : undefined,
    duesByHome: byHome ? true : undefined,
    founder: {
      ...draft.founder,
      unit,
      homeType: founderHomeType(draft),
      duesCents: draftOwnDues(draft, unit),
    },
    households: draft.households
      .map((h) => ({
        ...h,
        name: h.name.trim(),
        email: h.email.trim(),
        unit: h.unit.trim(),
        address: h.address?.trim() || undefined,
        homeType: typed(h.homeType),
        duesCents: draftOwnDues(draft, h.unit.trim(), h.duesCents),
      }))
      .filter((h) => h.unit !== "" && h.unit !== unit),
    // Rows no range covered were never homes. They stop here, so neither
    // creator, nor the copy held while an email is confirmed, ever sees them.
    parkedHouseholds: undefined,
    customSpaces: (draft.customSpaces ?? []).map((c) => c.trim()).filter(Boolean),
  };
}

/** How many homes the draft makes, counted the way it will be created. */
export function unitCount(draft: CommunityDraft): number {
  return otherHomes(placeFounder(draft)).length + 1;
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
  const homeId = (unit: string) => `${id}-own-${unit}`;
  // A home without an address yet is shown by its number, in the community's
  // own words: "Lot 12" on a subdivision, "Unit 12" anywhere attached.
  // A label the range already printed ("Unit 102") is left as it is, so the
  // word is never put on twice.
  const numbered = (unit: string) =>
    isNumbered(unit)
      ? `${wordingFor(homeTypesOf(draft), draft.origin).numberExample} ${unit}`
      : unit;
  const accountId = (unit: string) => `${id}-acct-${unit}`;

  const founderHome: Home = {
    id: homeId(draft.founder.unit),
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
    duesCents: draft.duesByHome ? draft.founder.duesCents : undefined,
  };

  // A home with nobody named. Only the builder setting the community up can
  // say it has not sold; a turnover board's neighbours and an established
  // association's unnamed homes are not the builder's.
  const unsoldLabel = draft.origin === "builder" ? "Not sold yet" : "No owner listed";

  const otherHomeRows: Home[] = otherHomes(draft).map((household) => {
    const sold = Boolean(household.name.trim());
    return {
      id: homeId(household.unit),
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
      duesCents: draft.duesByHome ? household.duesCents : undefined,
      // Marked as the real data layer marks them, so the roster badge does
      // not read "Paid up" beside a home nobody owns.
      placeholder: !sold,
    };
  });

  const homes = [founderHome, ...otherHomeRows];

  const founderAccount: Account = {
    id: accountId(draft.founder.unit),
    homeId: founderHome.id,
    name: draft.founder.name,
    email: draft.founder.email,
    unit: draft.founder.unit,
    role: "president",
    // The President holds everything, including permissions, which is the one
    // capability that cannot be granted away.
    capabilities: caps([...GRANTABLE], true),
    views: caps([...GRANTABLE]),
  };

  // Only a home with somebody in it gets a login. An unsold lot has nobody to
  // sign in as, and creating an account for one would put a resident seat in
  // the roster that can never be used.
  const otherAccounts: Account[] = otherHomeRows
    .filter((home) => home.members.length > 0)
    .map((home) => ({
      id: accountId(home.unit),
      homeId: home.id,
      name: home.displayName,
      email: home.email,
      unit: home.unit,
      role: "resident" as const,
      capabilities: NO_CAPABILITIES,
      views: caps([]),
    }));

  return {
    id,
    label: draft.name,
    asOf,
    // The day after, so "next" never names a bill that fell due today.
    nextChargeDate: nextDueOnOrAfter(addDays(asOf, 1), draft.dueDay, draft.duesCadence, FISCAL_YEAR_START),

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
      collectionPolicy: draftCollectionPolicy(draft),
    },

    homes,
    accounts: [founderAccount, ...otherAccounts],
    instruments: [],

    // Nothing financial exists until they record something. No bank is
    // claimed: payments are set up after founding, through Stripe.
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

    homeCharges: Object.fromEntries(homes.map((home) => [home.id, []])),
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
