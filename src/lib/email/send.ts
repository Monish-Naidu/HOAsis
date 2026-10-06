import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import { assessmentDueEmail, pastDueEmail } from "./templates";
import { unsubscribeUrl } from "./tokens";
import { emailSender } from "./sender";
import { signInUrl } from "./sign-in-link";
import { readReplyTo } from "./reply-to";
import { createPacer, logAttempt, recentlySent, sentKey, stoppedLine, unrecordedLine, type Pacer } from "./pace";

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
 *
 * The run is paced and bounded (src/lib/email/pace.ts): no faster than the
 * provider allows, and it stops with an answer before the function's time
 * limit. Anybody who already got the same notice in the last hour is passed
 * over, so pressing send again after a run that stopped finishes the list
 * and mails nobody twice. That rests on `email_log` alone, so a run whose
 * log row cannot be written stops there and says so.
 */

export type DuesCategory = "assessment" | "delinquency";

export interface SendResult {
  sent: number;
  /** Includes anybody not reached when the run stopped at the time limit. */
  failed: number;
  /** No address, or nothing owed on a past due run. Not anybody counted in `already`. */
  skipped: number;
  errors: string[];
  /**
   * Passed over because the same notice reached them in the last hour. Its
   * own count, in a preview too: folded into `skipped`, a preview inside the
   * hour read as a roster with nobody on it.
   */
  already: number;
  /** Not reached, because the run stopped at the time limit. Nobody counted in `already`. */
  remaining: number;
  /**
   * Why `email_log` could not be written, when it could not. The run stopped
   * there, and whoever it did not reach is in `failed` and not in
   * `remaining`: sending again would write to the same people.
   */
  unrecorded?: string;
}

function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email is not set up, so nothing was sent.");
  return new Resend(key);
}

function sender(): string {
  return emailSender();
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
  // A link we could not mint is not a reason to send nothing: the notice
  // still has to arrive, and signInUrl falls back to the front door.
  return signInUrl(supabaseAdmin(), {
    email,
    type: hasAccount ? "magiclink" : "invite",
    origin,
    path: "/resident/pay",
  });
}

export async function sendDuesEmails(input: {
  associationId: string;
  associationName: string;
  category: DuesCategory;
  dueDate: string;
  origin: string;
  /** Preview only. Builds the messages and sends nothing. */
  dryRun?: boolean;
  /** The pace and the time budget. Passed in by tests; made here otherwise. */
  pacer?: Pacer;
}): Promise<SendResult> {
  const admin = supabaseAdmin();
  const result: SendResult = { sent: 0, failed: 0, skipped: 0, errors: [], already: 0, remaining: 0 };

  // The recipient list comes from the database, which owns the opt out rule.
  // Assembling it here would mean reimplementing that rule and getting it
  // subtly wrong the first time somebody adds a category.
  const { data: recipients, error } = await admin.rpc("email_recipients", {
    p_association_id: input.associationId,
    p_category: input.category,
    p_only_past_due: input.category === "delinquency",
  });
  if (error) throw new Error(`Could not work out who to send this to: ${error.message}`);

  const client = input.dryRun ? null : resend();
  const pacer = input.pacer ?? createPacer();
  // Who already has this notice. A dues subject carries the amount and the
  // date, so the same subject to the same address within the hour is the
  // same notice, and a second copy helps nobody.
  const alreadySent = await recentlySent(admin, {
    associationId: input.associationId,
    category: input.category,
  });

  // Read once for the whole run. Replies go to the board's address when it
  // has one, and the past due email only says "reply" when that is true.
  const replyTo = await readReplyTo(input.associationId);

  const people = recipients ?? [];
  // Nobody without an address is written to, and nobody is chased for money
  // they do not owe.
  type Person = (typeof people)[number];
  const reachable = (person: Person) =>
    Boolean(person.email) && !(input.category === "delinquency" && person.balance_cents <= 0);

  const messageFor = (person: Person) => ({
    associationName: input.associationName,
    ownerName: person.full_name || "Neighbor",
    unitLabel: person.unit_label,
    balanceCents:
      person.balance_cents > 0 ? person.balance_cents : 0,
    dueDate: input.dueDate,
    payUrl: `${input.origin}/resident/pay`,
    // Statutory. There is no opt out to offer, and the footer says why.
    unsubscribeUrl: null as string | null,
    canReply: Boolean(replyTo),
  });
  const build = (m: ReturnType<typeof messageFor>) =>
    input.category === "delinquency" ? pastDueEmail(m) : assessmentDueEmail(m);
  // Asked of the subject alone, which does not depend on the link, so no
  // sign-in link is minted for somebody who will not be sent anything.
  const hasIt = (person: Person) =>
    alreadySent.size > 0 &&
    alreadySent.has(sentKey(person.email, build(messageFor(person)).subject, person.unit_id));
  // Whoever would still be written to. Somebody who already has the notice
  // is not waiting for it, which is how the invitations and the board
  // notices count: this run used to count them as not reached.
  const waiting = (rest: Person[]) => rest.filter((p) => reachable(p) && !hasIt(p)).length;

  for (let index = 0; index < people.length; index++) {
    const person = people[index];
    // Out of time. Stop with an answer while there is still time to give
    // one. Everybody from here on who would have been written to is counted
    // as not sent, and the first line the board reads says to send again.
    if (!input.dryRun && pacer.outOfTime()) {
      result.remaining = waiting(people.slice(index));
      if (result.remaining > 0) {
        result.failed += result.remaining;
        result.errors.unshift(stoppedLine(result.remaining, true));
      }
      break;
    }
    if (!reachable(person)) {
      result.skipped++;
      continue;
    }

    const message = messageFor(person);

    if (hasIt(person)) {
      result.already++;
      continue;
    }

    if (input.dryRun || !client) {
      result.sent++;
      continue;
    }

    const built = build({
      ...message,
      payUrl: await payLink(person.email, Boolean(person.profile_id), input.origin),
    });

    let providerId: string | null = null;
    let sendError: string | null = null;
    try {
      await pacer.turn();
      const { data, error: refused } = await client.emails.send({
        from: sender(),
        to: person.email,
        replyTo,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });
      providerId = data?.id ?? null;
      sendError = refused?.message ?? null;
    } catch (caught) {
      sendError = caught instanceof Error ? caught.message : "unknown error";
    }

    // Written once, outside the try. Inside it, a log write that threw after
    // the mail had gone counted that mail as failed and wrote the row again.
    const unrecorded = await logAttempt(admin, {
      association_id: input.associationId,
      profile_id: person.profile_id,
      unit_id: person.unit_id,
      to_email: person.email,
      category: input.category,
      subject: built.subject,
      provider_id: providerId,
      error: sendError,
    });

    if (sendError) {
      result.failed++;
      result.errors.push(`${person.email}: ${sendError}`);
    } else {
      result.sent++;
    }

    if (unrecorded) {
      // The log row is what the next run passes this person over by. With
      // no row, sending again writes to the same people again. So stop
      // here, with the people not reached counted as failed and nobody as
      // `remaining`, and a first line that does not say to send again.
      result.unrecorded = unrecorded;
      const notReached = waiting(people.slice(index + 1));
      result.failed += notReached;
      result.errors.unshift(unrecordedLine(notReached));
      break;
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
