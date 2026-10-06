import { Resend } from "resend";
import { addressLabel } from "@/lib/board-offices";
import { emailSender, resendKey } from "@/lib/email/sender";
import { readReplyTo } from "@/lib/email/reply-to";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ThreadAddress } from "@/lib/types";
import { officeMessageEmail } from "./templates";

/**
 * Telling the right officer that an owner wrote to them.
 *
 * A message addressed to the Treasurer emails whoever holds that seat today.
 * A message to the board as a whole, or to an office nobody holds or whose
 * holder has no address, goes to every seat with the communications
 * capability, which is who has always been told. Server only, like every
 * sender here, and logged to email_log. Never throws: the message is already
 * saved, and the board reads it in Messages whatever happens here.
 */

export interface OfficeSeat {
  full_name: string | null;
  profile_id: string | null;
  invited_email: string | null;
  role: string;
  capabilities: readonly string[] | null;
}

export interface OfficeRecipient {
  name: string;
  email: string;
  profileId: string | null;
}

function reachable(
  seats: readonly OfficeSeat[],
  accountEmails: ReadonlyMap<string, string>,
  fallbackName: string,
): OfficeRecipient[] {
  const seen = new Set<string>();
  const out: OfficeRecipient[] = [];
  for (const seat of seats) {
    // The account's own email wins over the one typed on the roster, as it does for disputes.
    const email = ((seat.profile_id ? accountEmails.get(seat.profile_id) : null) ?? seat.invited_email ?? "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: seat.full_name || fallbackName, email, profileId: seat.profile_id });
  }
  return out;
}

/**
 * Who is emailed for a thread addressed to `to`. The holder of the office
 * when there is one with an address; otherwise the communications holders.
 * `office` says which of the two it was, for the wording.
 */
export function officeRecipients(
  to: ThreadAddress,
  seats: readonly OfficeSeat[],
  accountEmails: ReadonlyMap<string, string>,
): { office: boolean; people: OfficeRecipient[] } {
  if (to !== "board") {
    const holders = reachable(
      seats.filter((s) => s.role === to),
      accountEmails,
      addressLabel(to),
    );
    if (holders.length) return { office: true, people: holders };
  }
  return {
    office: false,
    people: reachable(
      seats.filter((s) => (s.capabilities ?? []).includes("communications")),
      accountEmails,
      "Board",
    ),
  };
}

export async function sendOfficeMessageNotice(input: {
  associationId: string;
  threadId: string;
  unitId: string | null;
  to: ThreadAddress;
  subject: string;
  body: string;
  fromName: string;
  origin: string;
}): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  try {
    const admin = supabaseAdmin();
    const [{ data: association }, { data: unit }, { data: seats }, replyTo] = await Promise.all([
      admin.from("associations").select("name").eq("id", input.associationId).maybeSingle(),
      input.unitId
        ? admin.from("units").select("label").eq("id", input.unitId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("memberships")
        .select("full_name, profile_id, invited_email, role, capabilities")
        .eq("association_id", input.associationId)
        .is("ends_on", null)
        .or("role.neq.resident,capabilities.cs.{communications}"),
      readReplyTo(input.associationId),
    ]);
    if (!association) return result;

    const profileIds = (seats ?? []).map((s) => s.profile_id).filter((id): id is string => Boolean(id));
    const { data: profiles } = profileIds.length
      ? await admin.from("profiles").select("id, email").in("id", profileIds)
      : { data: [] as { id: string; email: string | null }[] };
    const accountEmails = new Map<string, string>();
    for (const p of profiles ?? []) if (p.email) accountEmails.set(p.id, p.email);

    const { office, people } = officeRecipients(input.to, seats ?? [], accountEmails);
    const key = resendKey();
    const client = key ? new Resend(key) : null;
    const url = new URL("/board/communications", input.origin);
    url.searchParams.set("thread", input.threadId);

    for (const person of people) {
      const built = officeMessageEmail({
        associationName: association.name,
        recipientName: person.name,
        addressedTo: office ? addressLabel(input.to) : "the board",
        fromName: input.fromName,
        home: unit?.label ?? "",
        subject: input.subject,
        body: input.body,
        url: url.toString(),
      });

      let providerId: string | null = null;
      let error: string | null = null;
      if (!client) {
        error = "Email is not set up, so nothing was sent.";
      } else {
        try {
          const sent = await client.emails.send(
            {
              from: emailSender(),
              to: person.email,
              subject: built.subject,
              html: built.html,
              text: built.text,
              // The board's contact address, so a plain reply reaches somebody.
              ...(replyTo ? { replyTo } : {}),
            },
            // Once per thread and address, however many times the browser asks.
            { idempotencyKey: `thread-new/${input.threadId}/${person.email.toLowerCase()}` },
          );
          providerId = sent.data?.id ?? null;
          error = sent.error?.message ?? null;
        } catch (caught) {
          error = caught instanceof Error ? caught.message : "unknown error";
        }
      }

      await admin.from("email_log").insert({
        association_id: input.associationId,
        profile_id: person.profileId,
        unit_id: input.unitId,
        category: "message",
        to_email: person.email,
        subject: built.subject,
        provider_id: providerId,
        error,
      });
      if (error) result.failed++;
      else result.sent++;
    }
  } catch {
    // The thread is saved; the board sees it in Messages.
  }
  return result;
}
