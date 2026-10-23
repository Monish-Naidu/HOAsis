import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import { communityPath } from "@/lib/community-links";
import { boardRequestEmail } from "./templates";
import { emailSender, resendKey } from "./sender";
import { replyToFor } from "./reply-to";
import { signInUrl } from "./sign-in-link";
import { logAttempt } from "./pace";

/**
 * Telling the board that a request came in, or that its owner wrote again.
 *
 * A request waited on the Requests page until an officer happened to open
 * it, the same way a join ask once waited on Homeowners. Now the ask is
 * pushed: every seat that holds the requests capability, the one "Answer the
 * requests" asks, gets one email per request event with a link straight to
 * that page. New requests and resident follow-ups alert; the board's own
 * replies still travel to the resident through the kind "request" notices in
 * notify.ts, which preferences and history already cover.
 *
 * Who acts is in the thread's last event, never in the request body the
 * caller sent: the route gates on the row read through the caller's own
 * session, and here the row is read again as the service, so an alert about
 * a reply the owner never wrote cannot be talked out of the server.
 *
 * Each event carries one identity per officer (request-filed/<id>/<email>,
 * request-reply/<id>/<event>/<email>) so a repeated call inside the
 * provider's window folds into the one email, and every attempt is logged to
 * email_log under 'request'.
 */

export interface RequestAlertRecipient {
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

function addressOf(seat: Seat, accountEmails: ReadonlyMap<string, string>): string {
  return (
    (seat.profile_id ? accountEmails.get(seat.profile_id) : null) ??
    seat.invited_email ??
    ""
  ).trim();
}

/**
 * Who hears about a request event: every current seat that holds the
 * requests capability and has an address, once per address, except the
 * person whose action this alert is about and anyone who asked not to hear
 * about requests. Pure, so it can be tested.
 */
export function requestAlertRecipients(
  seats: Seat[],
  accountEmails: ReadonlyMap<string, string>,
  actorProfileId: string | null,
  optedOut: ReadonlySet<string>,
) {
  const byAddress = new Map<string, RequestAlertRecipient>();
  for (const seat of seats) {
    if (!(seat.capabilities ?? []).includes("requests")) continue;
    if (actorProfileId && seat.profile_id === actorProfileId) continue;
    const email = addressOf(seat, accountEmails);
    if (!email) continue;
    const key = email.toLowerCase();
    if (optedOut.has(key)) continue;
    if (!byAddress.has(key)) {
      byAddress.set(key, { name: seat.full_name || "Officer", email, profileId: seat.profile_id });
    }
  }
  return [...byAddress.values()];
}

export type RequestAlertOutcome = {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export async function sendRequestAlert(input: {
  associationId: string;
  requestId: string;
  /** "filed" for a new request, "reply" for an owner follow-up. */
  kind: "filed" | "reply";
  /** Who filed or replied; they are not alerted about their own action. */
  actorProfileId: string | null;
  origin: string;
}): Promise<RequestAlertOutcome> {
  const admin = supabaseAdmin();
  const result: RequestAlertOutcome = { sent: 0, failed: 0, skipped: 0, errors: [] };

  const { data: association } = await admin
    .from("associations")
    .select("id, name, slug, contact_email")
    .eq("id", input.associationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!association) return result;

  const { data: request } = await admin
    .from("requests")
    .select("id, reference, title, kind, unit_id, thread, filed_by")
    .eq("id", input.requestId)
    .eq("association_id", input.associationId)
    .maybeSingle();
  if (!request) return result;

  const thread = Array.isArray(request.thread) ? request.thread : [];
  const last =
    thread.length > 0
      ? (thread[thread.length - 1] as {
          id?: string;
          actor?: string;
          actorRole?: string;
          body?: string;
        })
      : null;
  const reply = input.kind === "reply";
  // A reply alert is about the thread's last event, and only when the owner
  // wrote it. The board's own words reach the resident through notify.ts.
  if (reply && (!last || last.actorRole !== "resident")) return result;

  const { data: unit } = await admin
    .from("units")
    .select("label")
    .eq("id", request.unit_id)
    .maybeSingle();

  // Who acted. For a reply the thread names them; for a new request the
  // filer's seat on the home does, falling back to the thread's first event.
  let fromName = reply ? (last?.actor ?? "") : "";
  if (!fromName) {
    const actorId = input.actorProfileId ?? request.filed_by;
    if (actorId) {
      const { data: seat } = await admin
        .from("memberships")
        .select("full_name")
        .eq("unit_id", request.unit_id)
        .eq("profile_id", actorId)
        .limit(1)
        .maybeSingle();
      fromName = seat?.full_name?.trim() ?? "";
    }
  }
  if (!fromName) {
    const first = thread[0] as { actor?: string } | undefined;
    fromName = first?.actor?.trim() ?? "";
  }

  const { data: seats } = await admin
    .from("memberships")
    .select("full_name, profile_id, invited_email, capabilities")
    .eq("association_id", association.id)
    .is("ends_on", null)
    .contains("capabilities", ["requests"]);
  const holders = (seats ?? []).filter((s) => (s.capabilities ?? []).includes("requests"));
  const profileIds = holders.map((s) => s.profile_id).filter((id): id is string => Boolean(id));
  const { data: profiles } = profileIds.length
    ? await admin.from("profiles").select("id, email").in("id", profileIds)
    : { data: [] as { id: string; email: string | null }[] };
  const accountEmails = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.email) accountEmails.set(p.id, p.email);
  }

  // The same 'request' category of email_optouts the resident-side request
  // notices already honor (0083), keyed by address like the other sends.
  const { data: optRows } = profileIds.length
    ? await admin
        .from("email_optouts")
        .select("profile_id")
        .eq("association_id", association.id)
        .eq("category", "request")
        .in("profile_id", profileIds)
    : { data: [] as { profile_id: string }[] };
  const optedOutProfiles = new Set((optRows ?? []).map((row) => row.profile_id));
  const optedOut = new Set(
    holders
      .filter((s) => s.profile_id && optedOutProfiles.has(s.profile_id))
      .map((s) => addressOf(s, accountEmails).toLowerCase())
      .filter(Boolean),
  );

  const people = requestAlertRecipients(seats ?? [], accountEmails, input.actorProfileId, optedOut);
  result.skipped = holders.filter((s) => !addressOf(s, accountEmails)).length;
  if (people.length === 0) return result;

  const key = resendKey();
  if (!key) {
    result.errors.push("no-mail");
    return result;
  }

  const path = association.slug
    ? communityPath(association.slug, "/board/requests")
    : "/board/requests";
  const client = new Resend(key);

  for (const person of people) {
    const url = await signInUrl(admin, {
      email: person.email,
      type: person.profileId ? "magiclink" : "invite",
      origin: input.origin,
      path,
    });
    const built = boardRequestEmail({
      associationName: association.name,
      officerName: person.name,
      reply,
      reference: request.reference,
      title: request.title,
      requestKind: request.kind,
      fromName: fromName || "An owner",
      unitLabel: unit?.label ?? "",
      note: reply ? (last?.body ?? "") : "",
      url,
    });

    // One identity per event and officer. A repeated call for the same event
    // inside the provider's window is the one email, not a copy.
    const event = reply ? (last?.id ?? `${thread.length}`) : "filed";
    const address = person.email.toLowerCase();

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
        {
          idempotencyKey: `request-${reply ? "reply" : "filed"}/${request.id}/${event}/${address}`,
        },
      );
      providerId = sent.data?.id ?? null;
      sendError = sent.error?.message ?? null;
    } catch (caught) {
      sendError = caught instanceof Error ? caught.message : "unknown error";
    }

    const unrecorded = await logAttempt(admin, {
      association_id: association.id,
      profile_id: person.profileId,
      unit_id: request.unit_id,
      category: "request",
      to_email: address,
      subject: built.subject,
      provider_id: providerId,
      error: sendError,
    });

    if (sendError) {
      result.failed++;
      result.errors.push(`${address}: ${sendError}`);
    } else {
      result.sent++;
    }
    if (unrecorded) result.errors.unshift(unrecorded);
  }

  return result;
}
