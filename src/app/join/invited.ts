import { communityPath } from "@/lib/community-links";

/**
 * Opening an invitation while already signed in.
 *
 * The join form used to do nothing at all in this case: no account was
 * needed and no request was made, so "Open my home" ran neither branch and
 * the screen then said the board had been asked. The board never heard.
 *
 * There are three true answers. The signed-in account holds a seat in the
 * invited association, already or after claiming the one set out for its
 * address, and the home opens. Or the board invited a different address
 * than the one signed in, and the person is told so and offered the ordinary
 * request to join. Or both at once: the account already has a home here,
 * and the invitation went to another address, for a home this account does
 * not hold. Opening the home they have and saying nothing left the invited
 * one unclaimed with nobody the wiser, so that case says which address the
 * invitation was sent to and the two ways to take it up. Accounts are not
 * merged here; the board changing the address on the home is what moves it.
 *
 * Once the board has done that, the same link pressed again claims the
 * seat, and the link still names the old address. So the count of seats
 * this press claimed is read: one or more and the home opens, where it used
 * to answer with the same message and send the person back to the board.
 * The count covers every association, so a claim made elsewhere opens this
 * one too; and none claimed does not prove the invited home is still
 * waiting (they may have taken it earlier under another address), which is
 * why the message says "if" and does not assert it.
 *
 * "Holds a seat" is asked of the association row by its join code. A row
 * comes back only for a member, because that is what row level security
 * allows, so belonging to some other association never passes for this one.
 *
 * The two calls are passed in, so the rule can be tested with no database.
 */
export interface InvitedClient {
  /**
   * claim_my_seats: any open seat under the signed-in address becomes
   * theirs. `data` is how many this call claimed, in any association.
   */
  claimSeats(): PromiseLike<{ data: number | null; error: { message: string } | null }>;
  /** The association with this join code, if the signed-in person belongs to it. */
  memberOf(
    code: string,
  ): PromiseLike<{ data: { slug: string | null } | null; error: { message: string } | null }>;
}

export type InvitedOutcome =
  /** They hold the seat. Go to `path`. */
  | { kind: "open"; path: string }
  /**
   * They have a home here under the signed-in address, at `path`, and the
   * invitation was sent to another. Say so before going anywhere.
   */
  | { kind: "other-seat"; path: string; message: string }
  /** The invitation was for another address. Offer the request to join. */
  | { kind: "other-address"; message: string }
  /** The database did not answer. Nothing is known, so nothing is claimed. */
  | { kind: "error"; message: string };

export async function openInvitedHome(
  client: InvitedClient,
  input: { code: string; signedInEmail: string; /** The address on the invitation link, if it carries one. */ invitedEmail?: string | null },
): Promise<InvitedOutcome> {
  const retry = "Could not open your home just now. Try again in a moment.";
  try {
    const claimed = await client.claimSeats();
    if (claimed.error) return { kind: "error", message: retry };
    const { data, error } = await client.memberOf(input.code.trim().toUpperCase());
    if (error) return { kind: "error", message: retry };
    if (data) {
      // Straight into this association, whichever others they hold.
      const path = data.slug ? communityPath(data.slug, "/resident") : "/resident";
      // Seats are claimed by address, so one set out for another address
      // may still be waiting, however many this account holds here. Not
      // when this press claimed one: the board has moved it to this address.
      const invitedTo = (input.invitedEmail ?? "").trim();
      const signedIn = input.signedInEmail.trim();
      const claimedNow = typeof claimed.data === "number" && claimed.data > 0;
      if (!claimedNow && invitedTo && invitedTo.toLowerCase() !== signedIn.toLowerCase()) {
        return {
          kind: "other-seat",
          path,
          message: `This invitation was sent to ${invitedTo}. You are signed in as ${signedIn}, which already has a home here. If the invited home is not on this account, ask the board to change its email to ${signedIn}. Or sign out and create an account with ${invitedTo}.`,
        };
      }
      return { kind: "open", path };
    }
  } catch {
    return { kind: "error", message: retry };
  }
  return {
    kind: "other-address",
    message: `This invitation is for a different email than the one you are signed in with (${input.signedInEmail}). Sign out and use that one, or tell the board which home is yours below.`,
  };
}

/**
 * Where "Sign in, then come back here" comes back to. The invited address
 * rides along: without it the person returned to an invitation that no
 * longer knew who it was for.
 */
export function joinReturnPath(input: { invited: boolean; code: string; email?: string | null }): string {
  const params = new URLSearchParams({ [input.invited ? "invite" : "code"]: input.code });
  const email = (input.email ?? "").trim();
  if (input.invited && email) params.set("email", email);
  return `/join?${params.toString()}`;
}
