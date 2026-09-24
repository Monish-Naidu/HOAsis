import type { Association, Cents, Owner } from "@/lib/types";
import type { PropertyType } from "@/lib/data/new-community";

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

/** What one home pays per period: its kind's amount, or the association's. */
export function duesFor(
  association: Pick<Association, "duesCents" | "duesByType">,
  homeType?: PropertyType,
): Cents {
  const own = homeType ? association.duesByType?.[homeType] : undefined;
  return own && own > 0 ? own : association.duesCents;
}

/** What this owner's home pays per period. */
export function ownerDues(
  association: Pick<Association, "duesCents" | "duesByType">,
  owner?: Pick<Owner, "homeType">,
): Cents {
  return duesFor(association, owner?.homeType);
}

/** Whether different homes pay different amounts. */
export function duesVary(association: Pick<Association, "duesCents" | "duesByType">): boolean {
  const amounts = new Set(
    Object.values(association.duesByType ?? {}).filter((v): v is number => Boolean(v && v > 0)),
  );
  amounts.add(association.duesCents);
  return amounts.size > 1;
}

/** Every home's dues added up, per period. The one number a budget starts from. */
export function totalDues(
  association: Pick<Association, "duesCents" | "duesByType">,
  owners: Pick<Owner, "homeType">[],
): Cents {
  return owners.reduce((sum, o) => sum + ownerDues(association, o), 0);
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
