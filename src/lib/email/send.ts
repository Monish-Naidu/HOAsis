import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import { assessmentDueEmail, pastDueEmail } from "./templates";
import { unsubscribeUrl } from "./tokens";

/**
 * Sending dues email.
 *
 * Runs only on the server, for two reasons that are not negotiable. The
 * provider key would be readable by anyone if this shipped to a browser, and
 * the magic link that signs somebody in has to be minted by something holding
 * the service role, which is the same thing said twice.
 *
 * Every attempt is written to `email_log`, successes and failures alike,
 * because a board's real need is not the message. It is being able to show,
 * months later, that a notice went out and when.
 */

export type DuesCategory = "assessment" | "delinquency";

export interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is missing, so nothing can be sent.");
  return new Resend(key);
}

function sender(): string {
  // Falls back to Resend's shared testing sender, which only delivers to the
  // account owner. Better than a silent failure to an address that will never
  // receive it.
  return process.env.EMAIL_FROM ?? "HOAsis <onboarding@resend.dev>";
}

/**
 * A link that signs the person in and lands them on the payment screen.
 *
 * Somebody who has never signed up gets an invite link, which creates their
 * account and claims the seat their board already reserved. Somebody with an
 * account gets a magic link. Either way it is one tap from the email to
 * paying, because every step in between loses people.
 */
async function payLink(email: string, hasAccount: boolean, origin: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: hasAccount ? "magiclink" : "invite",
    email,
    options: { redirectTo: `${origin}/resident/pay` },
  });
  if (error || !data.properties?.action_link) {
    // A link we could not mint is not a reason to send nothing: the notice
    // still has to arrive, so fall back to the front door.
    return `${origin}/signin`;
  }
  return data.properties.action_link;
}

export async function sendDuesEmails(input: {
  associationId: string;
  associationName: string;
  category: DuesCategory;
  dueDate: string;
  origin: string;
  /** Preview only. Builds the messages and sends nothing. */
  dryRun?: boolean;
}): Promise<SendResult> {
  const admin = supabaseAdmin();
  const result: SendResult = { sent: 0, failed: 0, skipped: 0, errors: [] };

  // The recipient list comes from the database, which owns the opt out rule.
  // Assembling it here would mean reimplementing that rule and getting it
  // subtly wrong the first time somebody adds a category.
  const { data: recipients, error } = await admin.rpc("email_recipients", {
    p_association_id: input.associationId,
    p_category: input.category,
    p_only_past_due: input.category === "delinquency",
  });
  if (error) throw new Error(`Could not build the recipient list: ${error.message}`);

  const client = input.dryRun ? null : resend();

  for (const person of recipients ?? []) {
    if (!person.email) {
      result.skipped++;
      continue;
    }
    // Nobody is chased for money they do not owe.
    if (input.category === "delinquency" && person.balance_cents <= 0) {
      result.skipped++;
      continue;
    }

    const link = input.dryRun
      ? `${input.origin}/resident/pay`
      : await payLink(person.email, Boolean(person.profile_id), input.origin);

    const message = {
      associationName: input.associationName,
      ownerName: person.full_name || "Neighbor",
      unitLabel: person.unit_label,
      balanceCents:
        person.balance_cents > 0 ? person.balance_cents : 0,
      dueDate: input.dueDate,
      payUrl: link,
      // Statutory. There is no opt out to offer, and the footer says why.
      unsubscribeUrl: null as string | null,
    };

    const built =
      input.category === "delinquency" ? pastDueEmail(message) : assessmentDueEmail(message);

    if (input.dryRun || !client) {
      result.sent++;
      continue;
    }

    try {
      const { data, error: sendError } = await client.emails.send({
        from: sender(),
        to: person.email,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });

      await admin.from("email_log").insert({
        association_id: input.associationId,
        profile_id: person.profile_id,
        unit_id: person.unit_id,
        to_email: person.email,
        category: input.category,
        subject: built.subject,
        provider_id: data?.id ?? null,
        error: sendError?.message ?? null,
      });

      if (sendError) {
        result.failed++;
        result.errors.push(`${person.email}: ${sendError.message}`);
      } else {
        result.sent++;
      }
    } catch (caught) {
      const message_ = caught instanceof Error ? caught.message : "unknown error";
      result.failed++;
      result.errors.push(`${person.email}: ${message_}`);
      await admin.from("email_log").insert({
        association_id: input.associationId,
        profile_id: person.profile_id,
        unit_id: person.unit_id,
        to_email: person.email,
        category: input.category,
        subject: built.subject,
        error: message_,
      });
    }
  }

  return result;
}

/** Kept for the optional categories, which do carry an unsubscribe link. */
export function optionalFooterLink(
  origin: string,
  profileId: string,
  category: string,
): string {
  return unsubscribeUrl(origin, profileId, category);
}
