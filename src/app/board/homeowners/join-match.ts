import { homeLabel } from "@/lib/wording";
import type { Community } from "@/lib/data/community";
import type { JoinRequest, Owner } from "@/lib/types";

/**
 * Which home a person who asked to join means, and what letting them in does.
 *
 * Pure, so the rules the board relies on are tested without a screen.
 * Nothing here creates a home: the board picks one from the register, or
 * says outright that it is a new one.
 */

const plain = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The home the typed text names, by label or address, ignoring case and
 * spacing. "Lot 3" matches a home labelled 3 in an association that says
 * lot. Two homes that both fit select nothing: guessing between them is
 * how a person ends up on the neighbour's home.
 */
export function bestMatch(community: Community, owners: Owner[], typed: string): Owner | null {
  const wanted = plain(typed);
  if (!wanted) return null;
  const hits = owners.filter(
    (o) =>
      plain(o.unit) === wanted ||
      plain(homeLabel(community, o.unit)) === wanted ||
      (o.address ? plain(o.address) === wanted : false),
  );
  return hits.length === 1 ? hits[0] : null;
}

/**
 * What "Let them in" means on the chosen home.
 *
 *   seat       the requester takes the home's seat: nobody is listed, or the
 *              listed owner has not signed in and has the same email or none
 *   different  somebody else owns it: share it, or record a sale
 */
export function seatPlan(
  owner: Owner,
  request: Pick<JoinRequest, "email">,
  ownerHasSignedIn: boolean,
): "seat" | "different" {
  if (owner.placeholder) return "seat";
  const listed = owner.email.trim().toLowerCase();
  if (listed && listed === request.email.trim().toLowerCase()) return "seat";
  if (!ownerHasSignedIn && !listed) return "seat";
  return "different";
}

/** The picker's line for a home: label, address when it adds something, who owns it. */
export function homeOption(community: Community, owner: Owner): string {
  const label = homeLabel(community, owner.unit);
  const address =
    owner.address && owner.address !== owner.unit && owner.address !== label ? owner.address : "";
  return [label, address, owner.displayName].filter(Boolean).join(" · ");
}
