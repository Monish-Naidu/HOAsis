/**
 * The rule for a vendor's name: one vendor per name, and a name of a sane length.
 *
 * Case and spaces are ignored, so "Cascade  grounds co." is the vendor
 * "Cascade Grounds Co." already on the list. Kept here so the form and the
 * write in app state refuse the same thing in the same words.
 */

export const VENDOR_NAME_MAX = 80;

function key(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/** The reason a name cannot be saved, in the board's words, or null when it can. */
export function vendorNameProblem(name: string, existing: { name: string }[]): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  if (clean.length > VENDOR_NAME_MAX) return `Keep the name to ${VENDOR_NAME_MAX} characters`;
  const same = existing.find((v) => key(v.name) === key(clean));
  return same ? `A vendor called ${same.name} already exists` : null;
}

/**
 * What a vendor does, in words. A vendor saved before the form used its
 * category as the label carries the stand-in "Services"; show the category.
 */
export function vendorService(v: { service: string; defaultCategory: string }): string {
  return !v.service.trim() || v.service === "Services" ? v.defaultCategory : v.service;
}
