import { Resend } from "resend";
import { emailSender, resendKey } from "@/lib/email/sender";
import { supabaseAdmin } from "@/lib/supabase/server";
import { disputeEmail } from "./templates";

/**
 * Telling the people who hold finances that a payment was disputed, or how
 * the dispute ended.
 *
 * A dispute used to reach /admin and nobody else. /admin is the platform
 * owner's page, so the treasurer heard nothing, the evidence deadline
 * passed, and the association lost by default.
 *
 * Server only, like every sender here, and logged to email_log under
 * 'billing', the category for mail about money that goes to the board and
 * not to owners. Stripe may deliver the same event twice, so each send
 * carries an idempotency key made from the dispute and the recipient:
 * Resend sends it once however many times it is asked.
 *
 * Never throws. The webhook that calls this must still answer Stripe, and
 * a failed email is not a reason for Stripe to send the event again.
 */

export interface DisputeRecipient {
  name: string;
  email: string;
  profileId: string | null;
}

/**
 * Who hears about a dispute: every current seat that holds the finances
 * capability and has an address, once per address. The account's own email
 * wins over the one the board typed on the roster. Pure, so it can be tested.
 */
export function disputeRecipients(
  seats: {
    full_name: string | null;
    profile_id: string | null;
    invited_email: string | null;
    capabilities: readonly string[] | null;
  }[],
  accountEmails: ReadonlyMap<string, string>,
): DisputeRecipient[] {
  const seen = new Set<string>();
  const out: DisputeRecipient[] = [];
  for (const seat of seats) {
    if (!(seat.capabilities ?? []).includes("finances")) continue;
    const email = (
      (seat.profile_id ? accountEmails.get(seat.profile_id) : null) ??
      seat.invited_email ??
      ""
    ).trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: seat.full_name || "Treasurer", email, profileId: seat.profile_id });
  }
  return out;
}

/** The dispute on the association's own Stripe dashboard, where it is answered. */
export function disputeDashboardUrl(disputeId: string): string {
  return `https://dashboard.stripe.com/disputes/${encodeURIComponent(disputeId)}`;
}

export async function sendDisputeNotice(input: {
  associationId: string;
  unitId: string | null;
  kind: "opened" | "won" | "lost";
  disputeId: string;
  amountCents: number;
  reason?: string | null;
  /** `YYYY-MM-DD`, for an opened dispute. */
  evidenceDueOn?: string | null;
}): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  try {
    const admin = supabaseAdmin();
    const [{ data: association }, { data: unit }, { data: seats }] = await Promise.all([
      admin.from("associations").select("name").eq("id", input.associationId).maybeSingle(),
      input.unitId
        ? admin.from("units").select("label").eq("id", input.unitId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("memberships")
        .select("full_name, profile_id, invited_email, capabilities")
        .eq("association_id", input.associationId)
        .is("ends_on", null)
        .contains("capabilities", ["finances"]),
    ]);
    if (!association) return result;

    const profileIds = (seats ?? []).map((s) => s.profile_id).filter((id): id is string => Boolean(id));
    const { data: profiles } = profileIds.length
      ? await admin.from("profiles").select("id, email").in("id", profileIds)
      : { data: [] as { id: string; email: string | null }[] };
    const accountEmails = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.email) accountEmails.set(p.id, p.email);
    }

    const key = resendKey();
    const client = key ? new Resend(key) : null;

    for (const person of disputeRecipients(seats ?? [], accountEmails)) {
      const built = disputeEmail(input.kind, {
        associationName: association.name,
        recipientName: person.name,
        unitLabel: unit?.label ?? "",
        amountCents: input.amountCents,
        reason: input.reason,
        evidenceDueOn: input.evidenceDueOn,
        disputeUrl: disputeDashboardUrl(input.disputeId),
      });

      let providerId: string | null = null;
      let error: string | null = null;
      if (!client) {
        error = "RESEND_API_KEY is missing, so nothing can be sent.";
      } else {
        try {
          const sent = await client.emails.send(
            {
              from: emailSender(),
              to: person.email,
              subject: built.subject,
              html: built.html,
              text: built.text,
            },
            { idempotencyKey: `dispute-${input.kind}/${input.disputeId}/${person.email.toLowerCase()}` },
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
        unit_id: null,
        category: "billing",
        to_email: person.email,
        subject: built.subject,
        provider_id: providerId,
        error,
      });

      if (error) result.failed++;
      else result.sent++;
    }
  } catch {
    // Whatever went wrong, the caller still records the dispute on /admin
    // with how many of these went out.
  }
  return result;
}
