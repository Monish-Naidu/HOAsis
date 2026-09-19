import type {
  AssociationOrigin,
  AssociationProfileAnswers,
  PropertyType,
} from "@/lib/data/new-community";

/**
 * What to call a home, and what to call a run of them.
 *
 * The setup flow asks two questions on the second screen, what kind of homes
 * these are and who is setting the association up, and then spent the third
 * screen ignoring both. Everybody got the builder's vocabulary: take them from
 * the plat, who is building it, unsold, none sold yet. To a board that has run
 * a condominium since 2004 that screen reads as though it was built for
 * somebody else and they are in the wrong product, which is the one impression
 * an onboarding flow cannot afford to give.
 *
 * So the words come from the answers. None of this changes what is stored: a
 * home is a home in the model either way.
 */
export interface Wording {
  /** Lower case singular: "lot", "unit", "home". */
  home: string;
  /** Lower case plural. */
  homes: string;
  /** Capitalised singular, for a label. */
  Home: string;
  /** What the number is prefixed with, shown as the example. "Lot", "Unit". */
  numberExample: string;
  /** Capitalised singular for a run of numbers: "Phase", "Group". */
  group: string;
  /** True when a builder is or was involved, so unsold homes are a real state. */
  fromBuilder: boolean;
}

export function wordingFor(
  propertyType?: PropertyType,
  origin?: AssociationOrigin,
): Wording {
  const fromBuilder = origin === "builder" || origin === "handover";

  // A condominium is units to everybody, owner and builder alike. Everything
  // else is lots to a builder, who works from a numbered plan, and homes to an
  // association that has been living in them for years.
  const home =
    propertyType === "condos" ? "unit" : fromBuilder && origin === "builder" ? "lot" : "home";

  return {
    home,
    homes: `${home}s`,
    Home: home.charAt(0).toUpperCase() + home.slice(1),
    // Attached homes are numbered like units whoever owns them; only a
    // detached subdivision reads "Lot" as its own word.
    numberExample: propertyType === "single-family" ? "Lot" : "Unit",
    // Phases are how land is released, so they mean something to a builder and
    // to the board taking over from one. An association that has been running
    // for twenty years just has groups of numbers.
    group: fromBuilder ? "Phase" : "Group",
    fromBuilder,
  };
}

/**
 * The same words, for an association that already exists.
 *
 * Every screen that printed "Unit 12" did so for a detached subdivision
 * whose founder had just been told their home was Lot 12. The profile
 * answers are kept on the community so the vocabulary can follow them.
 */
export function homeWording(community: { profile?: AssociationProfileAnswers }): Wording {
  return wordingFor(community.profile?.propertyType, community.profile?.origin);
}

/**
 * Whether a register key is a number that wants a word in front of it.
 *
 * "12", "4B" and "A-12" do. "1 Alder Way" is already the whole name of the
 * home, because a community that never numbered its houses keys them on
 * the address, and "Lot 1 Alder Way" is nobody's home.
 */
export function isNumbered(unit: string): boolean {
  return /^[a-z]?-?\d+[a-z]?$/i.test(unit.trim()) || /^[a-z]-\d+$/i.test(unit.trim());
}

/** "Unit 12" for a number, the words as given for anything else. */
export function placeLabel(unit: string): string {
  return isNumbered(unit) ? `Unit ${unit.trim()}` : unit.trim();
}

/** "Lot 12", "Unit 4B", "Home 7": the home's number in the community's words. */
export function homeLabel(
  community: { profile?: AssociationProfileAnswers },
  unit: string,
): string {
  if (!isNumbered(unit)) return unit.trim();
  const w = homeWording(community);
  const word = community.profile?.propertyType ? w.numberExample : "Unit";
  return `${word} ${unit.trim()}`;
}
