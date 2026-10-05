import { Resend } from "resend";
import { emailSender, resendKey } from "@/lib/email/sender";
import { supabaseAdmin } from "@/lib/supabase/server";
import { disputeRecipients } from "./dispute";
import { paymentsPausedEmail } from "./templates";

/**
 * Telling the people who hold finances that Stripe has paused the
 * association's payments.
 *
 * Same shape as the dispute notice beside it, and for the same reason: this
 * used to reach nobody. The cached flag flipped, Pay disappeared for owners,
 * and the board found out when somebody asked why.
 *
 * Stripe sends account.updated many times while it reviews an account, so
 * each send is keyed by association, day and recipient: one email a day at
 * most, however often the event repeats. Logged under 'billing'. Never
 * throws; the webhook that calls it still has to answer Stripe.
 */
export async function sendPaymentsPausedNotice(input: {
  associationId: string;
  associationName: string;
  needs: string[];
  settingsUrl: string;
  /** `YYYY-MM-DD`, the day of the event. Part of the once-a-day key. */
  day: string;
}): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  try {
    const admin = supabaseAdmin();
    const { data: seats } = await admin
      .from("memberships")
      .select("full_name, profile_id, invited_email, capabilities")
      .eq("association_id", input.associationId)
      .is("ends_on", null)
      .contains("capabilities", ["finances"]);

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
      const built = paymentsPausedEmail({
        associationName: input.associationName,
        recipientName: person.name,
        needs: input.needs,
        settingsUrl: input.settingsUrl,
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
            },
            { idempotencyKey: `payments-paused/${input.associationId}/${input.day}/${person.email.toLowerCase()}` },
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
    // The cached flag is already right; a notice that did not go out is
    // logged by the caller with how many did.
  }
  return result;
}
