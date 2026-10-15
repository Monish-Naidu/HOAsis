import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import { communityPath } from "@/lib/community-links";
import { joinRequestEmail } from "./templates";
import { emailSender, resendKey } from "./sender";
import { replyToFor } from "./reply-to";
import { signInUrl } from "./sign-in-link";
import { logAttempt } from "./pace";

/**
 * Telling the board that somebody asked to join.
 *
 * A request waited on the Homeowners page until an officer happened to open
 * it. Now the ask is pushed to the officers who can answer it: every seat
 * that holds the settings capability, the one "Let them in" asks, gets one
 * email per request with a link straight to that page.
 *
 * Once per request, by the row itself. The browser asks for this notice on
 * every submit, because a retry is indistinguishable from a first ask where
 * it sits; the request is claimed in the database instead, with one update
 * guarded on board_notified_at being null (0116). Only the call that set it
 * sends anything, so two submits at once, or two serverless instances, still
 * mean one email each.
 *
 * Server only, like every sender here, and logged to email_log under 'join',
 * the category for mail about who is at the door that goes to the board.
 */

export interface JoinNoticeRecipient {
  name: string;
  email: string;
  profileId: string | null;
}

interface Seat {
  full_name: string | null;
  profile_id: string | null;
  invited_email: string | null;
  capabilities: readonly string[] | null;
}

/** The address a seat is reached at: the account's own email, else the roster's. */
function addressOf(seat: Seat, accountEmails: ReadonlyMap<string, string>): string {
  return (
    (seat.profile_id ? accountEmails.get(seat.profile_id) : null) ??
    seat.invited_email ??
    ""
  ).trim();
}

/**
 * Who hears about a join request: every current seat that holds the settings
 * capability and has an address, once per address. Pure, so it can be tested.
 */
export function joinNoticeRecipients(seats: Seat[], accountEmails: ReadonlyMap<string, string>) {
  const byAddress = new Map<string, JoinNoticeRecipient>();
  for (const seat of seats) {
    if (!(seat.capabilities ?? []).includes("settings")) continue;
    const email = addressOf(seat, accountEmails);
    if (!email) continue;
    const key = email.toLowerCase();
    if (!byAddress.has(key)) {
      byAddress.set(key, { name: seat.full_name || "Officer", email, profileId: seat.profile_id });
    }
  }
  return [...byAddress.values()];
}

export type JoinNoticeOutcome =
  /** No association carries that join code. */
  | { status: "no-association" }
  /** No pending request from that address, so nothing is waiting to be told. */
  | { status: "no-request" }
  /**
   * The request was already notified, or was decided before the notice could
   * go, so nothing is sent and nothing is claimed.
   */
  | { status: "already" }
  /** No settings holder has an address. The request stays claimable. */
  | { status: "nobody"; skipped: number }
  /** No mail key on this deployment, so nothing could go out. */
  | { status: "no-mail" }
  | { status: "sent"; sent: number; failed: number; skipped: number; errors: string[] };

export async function sendJoinRequestNotice(input: {
  code: string;
  email: string;
  origin: string;
}): Promise<JoinNoticeOutcome> {
  const admin = supabaseAdmin();
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim().toUpperCase();

  const { data: association } = await admin
    .from("associations")
    .select("id, name, slug, contact_email")
    .eq("join_code", code)
    .is("deleted_at", null)
    .maybeSingle();
  if (!association) return { status: "no-association" };

  // The newest pending request from this address. request_to_join keeps one
  // open request per person per association, so this is the ask; a decided
  // request has nothing to tell the board about.
  const { data: request } = await admin
    .from("join_requests")
    .select("id, full_name, email, unit_label, note")
    .eq("association_id", association.id)
    .eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!request) return { status: "no-request" };

  const { data: seats } = await admin
    .from("memberships")
    .select("full_name, profile_id, invited_email, capabilities")
    .eq("association_id", association.id)
    .is("ends_on", null)
    .contains("capabilities", ["settings"]);
  const holders = (seats ?? []).filter((s) => (s.capabilities ?? []).includes("settings"));
  const profileIds = holders.map((s) => s.profile_id).filter((id): id is string => Boolean(id));
  const { data: profiles } = profileIds.length
    ? await admin.from("profiles").select("id, email").in("id", profileIds)
    : { data: [] as { id: string; email: string | null }[] };
  const accountEmails = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.email) accountEmails.set(p.id, p.email);
  }
  const people = joinNoticeRecipients(seats ?? [], accountEmails);
  // An officer the board cannot write to. They are on the page the link
  // would open, which is why the notice does not stop for them.
  const skipped = holders.filter((s) => !addressOf(s, accountEmails)).length;
  // Nobody can be told leaves the request claimable, so the day an officer is
  // given the capability, or an address, a renewed ask reaches them.
  if (people.length === 0) return { status: "nobody", skipped };

  const key = resendKey();
  if (!key) return { status: "no-mail" };

  // The claim. Guarded on being null, so of two calls that race, one sends
  // and one sees an empty answer. Guarded on pending, so a request the
  // board decided in between is not announced as waiting.
  const { data: claimed, error: claimError } = await admin
    .from("join_requests")
    .update({ board_notified_at: new Date().toISOString() })
    .eq("id", request.id)
    .is("board_notified_at", null)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return { status: "already" };

  const client = new Resend(key);
  const result = { sent: 0, failed: 0, skipped, errors: [] as string[] };
  const path = association.slug
    ? communityPath(association.slug, "/board/homeowners")
    : "/board/homeowners";

  for (const person of people) {
    // A magic link for an officer with an account; an invite link for one
    // the board only has an address for, which creates it and claims the
    // reserved seat. Either way one tap lands on the request.
    const url = await signInUrl(admin, {
      email: person.email,
      type: person.profileId ? "magiclink" : "invite",
      origin: input.origin,
      path,
    });
    const built = joinRequestEmail({
      associationName: association.name,
      officerName: person.name,
      requesterName: request.full_name,
      requesterEmail: request.email,
      unitLabel: request.unit_label ?? "",
      note: request.note ?? "",
      url,
    });

    let providerId: string | null = null;
    let sendError: string | null = null;
    try {
      const sent = await client.emails.send(
        {
          from: emailSender(),
          to: person.email,
          replyTo: replyToFor(association.contact_email),
          subject: built.subject,
          html: built.html,
          text: built.text,
        },
        // The claim already means one notice per request. This is the second
        // lock, for the window before the claim lands.
        { idempotencyKey: `join-request/${request.id}/${person.email.toLowerCase()}` },
      );
      providerId = sent.data?.id ?? null;
      sendError = sent.error?.message ?? null;
    } catch (caught) {
      sendError = caught instanceof Error ? caught.message : "unknown error";
    }

    const unrecorded = await logAttempt(admin, {
      association_id: association.id,
      profile_id: person.profileId,
      unit_id: null,
      category: "join",
      to_email: person.email,
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
    if (unrecorded) result.errors.unshift(unrecorded);
  }

  return { status: "sent", ...result };
}
