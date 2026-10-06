/**
 * Where an owner's reply goes.
 *
 * Mail to owners is sent from one shared address, so a reply to it reaches
 * nobody. The board can set a contact address in Settings; when it has, every
 * email to an owner carries it as the reply-to, and the wording says "reply"
 * only then. A blank or missing address means no reply-to at all, never an
 * empty header, which Resend refuses.
 */

import { supabaseAdmin } from "@/lib/supabase/server";

/** The address to put in `replyTo`, or undefined when the board has not set one. */
export function replyToFor(contactEmail: string | null | undefined): string | undefined {
  const address = (contactEmail ?? "").trim();
  return address || undefined;
}

/**
 * For the senders that were not already reading the association row. A read
 * that fails is treated as no address: the email still goes, and it says not
 * to reply, which is the safe wording.
 */
export async function readReplyTo(associationId: string): Promise<string | undefined> {
  try {
    const { data } = await supabaseAdmin()
      .from("associations")
      .select("contact_email")
      .eq("id", associationId)
      .single();
    return replyToFor(data?.contact_email);
  } catch {
    return undefined;
  }
}
