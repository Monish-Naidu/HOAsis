import { Resend } from "resend";
import { emailSender } from "@/lib/email/sender";
import { supabaseAdmin } from "@/lib/supabase/server";
import { autopayEmail, type AutopayEmailInput } from "./templates";

/**
 * One autopay notice to one owner: the receipt, or the decline.
 *
 * Server only, like every sender here, and logged to email_log under
 * 'assessment' either way. The failed notice matters more than the receipt:
 * an owner whose card silently failed is an owner who is late without knowing.
 */
export async function sendAutopayNotice(input: {
  associationId: string;
  unitId: string;
  profileId: string | null;
  to: string;
  kind: "charged" | "failed";
  message: AutopayEmailInput;
  dryRun?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const built = autopayEmail(input.kind, input.message);
  let providerId: string | null = null;
  let error: string | null = null;

  if (!input.dryRun) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      error = "Email is not set up, so nothing was sent.";
    } else {
      const sent = await new Resend(key).emails.send({
        from: emailSender(),
        to: input.to,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });
      providerId = sent.data?.id ?? null;
      error = sent.error?.message ?? null;
    }
  }

  await supabaseAdmin().from("email_log").insert({
    association_id: input.associationId,
    profile_id: input.profileId,
    unit_id: input.unitId,
    category: "assessment",
    to_email: input.to,
    subject: built.subject,
    provider_id: providerId,
    error,
  });

  return error ? { ok: false, error } : { ok: true };
}
