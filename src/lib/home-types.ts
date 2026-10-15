import type { Association, Cents, DuesChange, Home, ISODate } from "@/lib/types";
import type { PropertyType } from "@/lib/data/new-community";
import { formatDate, money } from "@/lib/utils";

/**
 * Communities with more than one kind of home.
 *
 * Plenty of new builds are townhomes along the entry road, condos over the
 * clubhouse and detached houses at the back, all under one association. The
 * kind of home is a fact about each home, not about the association: it
 * decides who insures the walls, what an owner's own policy has to cover,
 * and often what the home pays, because the association carrying a condo
 * building's roof costs more than mowing a detached home's verge.
 *
 * One association-wide answer still works for the common case. This file is
 * where the per-home answer is read, so no screen has to know which of the
 * two it is looking at.
 */

export const HOME_TYPES: PropertyType[] = ["single-family", "townhomes", "condos"];

export const HOME_TYPE_LABEL: Record<
  PropertyType,
  { one: string; many: string; short: string; ownerPolicy: string }
> = {
  "single-family": {
    one: "Detached home",
    many: "Detached homes",
    short: "Detached",
    ownerPolicy: "Your own homeowner's policy (HO-3) covers the house.",
  },
  townhomes: {
    one: "Townhome",
    many: "Townhomes",
    short: "Townhome",
    ownerPolicy: "Check the declaration for who insures the roof and siding.",
  },
  condos: {
    one: "Condo",
    many: "Condos",
    short: "Condo",
    ownerPolicy: "The association insures the building. You need an HO-6 for the inside.",
  },
};

/** Anything carrying the answers: a draft, a profile, a stored community profile. */
interface HasTypes {
  propertyType?: PropertyType;
  homeTypes?: PropertyType[];
}

/**
 * Every kind of home in the community, in a stable order.
 *
 * Associations founded before the question allowed more than one answer carry
 * only `propertyType`, and read as a community of one kind.
 */
export function homeTypesOf(p?: HasTypes): PropertyType[] {
  const listed = p?.homeTypes?.length ? p.homeTypes : p?.propertyType ? [p.propertyType] : [];
  return HOME_TYPES.filter((t) => listed.includes(t));
}

export function isMixed(p?: HasTypes): boolean {
  return homeTypesOf(p).length > 1;
}

/** The single answer, when there is exactly one. */
export function soleType(types: PropertyType[]): PropertyType | undefined {
  return types.length === 1 ? types[0] : undefined;
}

type DuesTerms = Pick<Association, "duesCents" | "duesByType">;

/**
 * What one home pays per period. The one rule, in this order: the home's own
 * amount if it has one, else its kind's amount if the association bills by
 * kind, else the association's amount. A zero reads as "not set".
 *
 * `unit_dues_cents` in the database applies the same order when a bill is
 * issued (supabase/migrations/0084_dues_by_home.sql). Change both together.
 */
export function duesFor(association: DuesTerms, homeType?: PropertyType, ownCents?: Cents): Cents {
  if (ownCents && ownCents > 0) return ownCents;
  const kind = homeType ? association.duesByType?.[homeType] : undefined;
  return kind && kind > 0 ? kind : association.duesCents;
}

/** What this owner's home pays per period. */
export function homeDues(
  association: DuesTerms,
  home?: Pick<Home, "homeType" | "duesCents">,
): Cents {
  return duesFor(association, home?.homeType, home?.duesCents);
}

/** Where a home's amount comes from, for a screen that says why. */
export type DuesSource = "own" | "kind" | "association";

export function duesSource(
  association: DuesTerms,
  home?: Pick<Home, "homeType" | "duesCents">,
): DuesSource {
  if (home?.duesCents && home.duesCents > 0) return "own";
  const kind = home?.homeType ? association.duesByType?.[home.homeType] : undefined;
  return kind && kind > 0 && kind !== association.duesCents ? "kind" : "association";
}

/** Where a home's amount comes from, in words: "its own amount", "townhome rate", "the association's rate". */
export function duesSourceLabel(
  association: DuesTerms,
  home?: Pick<Home, "homeType" | "duesCents">,
): string {
  const source = duesSource(association, home);
  if (source === "own") return "its own amount";
  if (source === "kind" && home?.homeType)
    return `${HOME_TYPE_LABEL[home.homeType].one.toLowerCase()} rate`;
  return "the association's rate";
}

/** How many homes carry an amount of their own. */
export function homesWithOwnDues(homes: Pick<Home, "duesCents">[]): number {
  return homes.filter((o) => Boolean(o.duesCents && o.duesCents > 0)).length;
}

/**
 * Whether different homes pay different amounts. Pass the owners to count a
 * home's own amount; without them only the kinds are read.
 */
export function duesVary(
  association: DuesTerms,
  homes?: Pick<Home, "homeType" | "duesCents">[],
): boolean {
  const amounts = new Set(
    Object.values(association.duesByType ?? {}).filter((v): v is number => Boolean(v && v > 0)),
  );
  amounts.add(association.duesCents);
  if (amounts.size > 1) return true;
  return (homes ?? []).some((o) => homeDues(association, o) !== association.duesCents);
}

/** Every home's dues added up, per period. The one number a budget starts from. */
export function totalDues(
  association: DuesTerms,
  homes: Pick<Home, "homeType" | "duesCents">[],
): Cents {
  return homes.reduce((sum, o) => sum + homeDues(association, o), 0);
}

type DuesChangeSource = Pick<Association, "duesCents" | "duesByType" | "duesChange">;

/**
 * The rates in effect on a given day.
 *
 * A change whose day has come is the rate every screen reads, even before
 * the daily run has moved it into `duesCents`, so a screen never shows a
 * rate the bills do not match. The bills make the same choice
 * (`unit_dues_cents_on`, migration 0117); this is its TypeScript half.
 */
export function duesTerms(association: DuesChangeSource, on: ISODate): DuesTerms {
  const change = association.duesChange;
  if (change && on >= change.effectiveOn) {
    return { duesCents: change.duesCents, duesByType: change.duesByType };
  }
  return { duesCents: association.duesCents, duesByType: association.duesByType };
}

/**
 * Whether two sets of rates are the same rates, so a form can tell a change
 * from a re-typing of what is already on file. Compared rate by rate rather
 * than entry by entry: a kind that pays the standard rate is at the same rate
 * whether it is absent from the map or named in it, and a community that
 * records no kinds of home still has its standard rate compared.
 */
export function sameDuesTerms(a: DuesTerms, b: DuesTerms): boolean {
  if (a.duesCents !== b.duesCents) return false;
  const kinds = new Set([...Object.keys(a.duesByType ?? {}), ...Object.keys(b.duesByType ?? {})]);
  return [...kinds].every((k) => duesFor(a, k as PropertyType) === duesFor(b, k as PropertyType));
}

/**
 * The change still to come, or null when none is waiting or its day has
 * passed. The day it passes the rate is already the change, so only a future
 * change is news.
 */
export function upcomingDuesChange(
  association: DuesChangeSource,
  today: ISODate,
): DuesChange | null {
  const change = association.duesChange;
  return change && today < change.effectiveOn ? change : null;
}

/**
 * A coming change as one home feels it, or null when nothing changes for
 * that home: a home with its own amount keeps it, and a change may hold a
 * kind's rate where it already is.
 */
export function homeDuesChange(
  association: DuesChangeSource,
  home: Pick<Home, "homeType" | "duesCents"> | undefined,
  today: ISODate,
): { fromCents: Cents; toCents: Cents; effectiveOn: ISODate } | null {
  const change = upcomingDuesChange(association, today);
  if (!change) return null;
  const fromCents = homeDues(association, home);
  const toCents = homeDues({ duesCents: change.duesCents, duesByType: change.duesByType }, home);
  return fromCents === toCents ? null : { fromCents, toCents, effectiveOn: change.effectiveOn };
}

/** "From January 1, dues are $310." The one sentence an owner reads. */
export function duesChangeWords(
  change: { toCents: Cents; effectiveOn: ISODate },
  today: ISODate,
): string {
  const day = change.effectiveOn === today ? "today" : formatDate(change.effectiveOn, "long");
  return `From ${day}, dues are ${money(change.toCents, {
    cents: change.toCents % 100 !== 0,
  })}.`;
}

/** How many homes of each kind, only kinds that are present. */
export function countByType(
  homes: { homeType?: PropertyType }[],
): { type: PropertyType; count: number }[] {
  return HOME_TYPES.map((type) => ({
    type,
    count: homes.filter((h) => h.homeType === type).length,
  })).filter((row) => row.count > 0);
}

/** "24 townhomes and 16 condos". Empty when no home carries a kind. */
export function describeMix(homes: { homeType?: PropertyType }[]): string {
  const parts = countByType(homes).map(
    ({ type, count }) =>
      `${count} ${(count === 1 ? HOME_TYPE_LABEL[type].one : HOME_TYPE_LABEL[type].many).toLowerCase()}`,
  );
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
