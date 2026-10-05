import type { supabaseAdmin } from "@/lib/supabase/server";

/**
 * A saved bank or card can be charged only while the person who saved it
 * still holds a seat on the home.
 *
 * Saved methods are kept by home, on purpose: two people who own one home
 * share its payment methods, and either may pay from them. The trouble is a
 * sale. The seller's seat ends, the buyer's begins, and the seller's bank
 * was still sitting on the home, on the buyer's pay screen and in reach of
 * autopay, which fell back to "any method on the home" and would have
 * debited the seller every month.
 *
 * So the routes that move money ask who saved the method. A co-owner's is
 * still good, because the co-owner is still here. A method whose saver has
 * left, or whose account is gone (the row's profile_id is set to null when
 * a profile is deleted), is not charged by anybody. Rows from before Stripe
 * have no saver either, and they could never be charged anyway.
 *
 * This is the server half. Removing the old rows when a sale is recorded,
 * and giving the buyer a Stripe customer of their own, belong in
 * transfer_home in SQL.
 */
export function savedByCurrentMember(
  savedBy: string | null | undefined,
  currentMembers: Iterable<string | null | undefined>,
): boolean {
  if (!savedBy) return false;
  for (const member of currentMembers) {
    if (member === savedBy) return true;
  }
  return false;
}

/**
 * The people who hold a seat on the home today, by profile id.
 *
 * Read with the service role because a member is not always allowed to see
 * a co-owner's membership row, and the answer has to be the whole home's.
 * Throws when the database does not answer: not knowing who lives there is
 * not a reason to charge, and not a reason to say the method is a stranger's.
 */
export async function currentMemberIds(
  admin: ReturnType<typeof supabaseAdmin>,
  unitId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("memberships")
    .select("profile_id")
    .eq("unit_id", unitId)
    .is("ends_on", null);
  if (error) throw new Error(`Could not read who holds this home: ${error.message}`);
  return (data ?? []).map((m) => m.profile_id).filter((id): id is string => Boolean(id));
}
