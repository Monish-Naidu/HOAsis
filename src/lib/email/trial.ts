import { Resend } from "resend";
import { emailSender } from "@/lib/email/sender";
import { supabaseAdmin } from "@/lib/supabase/server";
import { trialEmail, type TrialEmailInput } from "./templates";

/**
 * One trial notice to one President.
 *
 * Server only, like the dues sender. Logged to email_log under 'billing'
 * either way, because the question that comes later is "did we warn them",
 * and the answer has to be a row, not a memory.
 */
export async function sendTrialNotice(input: {
  associationId: string;
  kind: "14-days" | "3-days" | "ended";
  to: string;
  profileId: string | null;
  message: TrialEmailInput;
  /** Build and log, send nothing. */
  dryRun?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const built = trialEmail(input.kind, input.message);
  const admin = supabaseAdmin();

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

  await admin.from("email_log").insert({
    association_id: input.associationId,
    profile_id: input.profileId,
    unit_id: null,
    category: "billing",
    to_email: input.to,
    subject: built.subject,
    provider_id: providerId,
    error,
  });

  return error ? { ok: false, error } : { ok: true };
}
