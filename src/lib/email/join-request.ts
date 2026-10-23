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
 * Once per request and officer, by the rows themselves. The browser asks
 * for this notice on every submit, because a retry is indistinguishable
 * from a first ask where it sits. Each officer's copy is a row in
 * join_notice_deliveries (0128), reserved with the exact subject and link
 * it will ever carry, claimed with a lease, and stamped when it went. A
 * call that died after reserving, or an officer whose send failed, is
 * picked up by the next ask without writing to the officers who already
 * have it. Only when every officer's copy is sent does the request's
 * board_notified_at say the board was told (0116), so two submits at once,
 * or two serverless instances, still mean one email each.
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
   * Every officer was told already, or the request was decided before the
   * notice could go, so nothing is sent and nothing is claimed.
   */
  | { status: "already" }
  /** No settings holder has an address. The request stays claimable. */
  | { status: "nobody"; skipped: number }
  /** No mail key on this deployment, so nothing could go out. */
  | { status: "no-mail" }
  | { status: "sent"; sent: number; failed: number; skipped: number; errors: string[] };

interface DeliveryRow {
  email: string;
  subject: string;
  url: string;
}

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
    .select("id, full_name, email, unit_label, note, board_notified_at")
    .eq("association_id", association.id)
    .eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!request) return { status: "no-request" };
  // Every officer's copy went. Stamped only once that is true (0128), so a
  // finished request is told from one read and an unfinished one retries.
  if (request.board_notified_at) return { status: "already" };

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

  // Reserve each officer's copy once, with the words and the link it will
  // carry on every attempt. A retry sends the same message under the same
  // provider key, so a repeat inside the provider's window is folded, not
  // doubled, and a recovered interruption is provably the same email.
  const path = association.slug
    ? communityPath(association.slug, "/board/homeowners")
    : "/board/homeowners";
  const { data: storedRows, error: storeReadError } = await admin
    .from("join_notice_deliveries")
    .select("email, subject, url")
    .eq("request_id", request.id);
  if (storeReadError) throw new Error(storeReadError.message);
  const reserved = new Map<string, DeliveryRow>();
  for (const row of storedRows ?? []) reserved.set(row.email, row);

  const unreserved = people.filter((person) => !reserved.has(person.email.toLowerCase()));
  if (unreserved.length > 0) {
    const rows = [];
    for (const person of unreserved) {
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
      rows.push({
        request_id: request.id,
        email: person.email.toLowerCase(),
        profile_id: person.profileId,
        subject: built.subject,
        url,
      });
    }
    // Two calls reserving at once write the same rows; the first writer's
    // copy stands, so both go on to send the same message.
    const { error: reserveError } = await admin
      .from("join_notice_deliveries")
      .upsert(rows, { onConflict: "request_id,email", ignoreDuplicates: true });
    if (reserveError) throw new Error(reserveError.message);
    const { data: reread, error: rereadError } = await admin
      .from("join_notice_deliveries")
      .select("email, subject, url")
      .eq("request_id", request.id);
    if (rereadError) throw new Error(rereadError.message);
    reserved.clear();
    for (const row of reread ?? []) reserved.set(row.email, row);
  }

  const client = new Resend(key);
  const result = { sent: 0, failed: 0, skipped, errors: [] as string[] };

  for (const person of people) {
    const address = person.email.toLowerCase();
    const delivery = reserved.get(address);
    if (!delivery) continue;

    // The claim. One worker holds one officer's copy at a time; a sent copy
    // is never claimed again, and an interrupted one only after its lease.
    const { data: claims, error: claimError } = await admin.rpc("claim_join_notice", {
      p_request_id: request.id,
      p_email: address,
    });
    if (claimError) throw new Error(claimError.message);
    const claim = claims?.[0];
    if (!claim) continue;

    // The last attempt claimed the row and vanished. The mail may still have
    // gone out, with only the bookkeeping lost: when the log says it went,
    // record that instead of writing to the officer twice.
    if (claim.interrupted_at) {
      const { data: logged } = await admin
        .from("email_log")
        .select("provider_id")
        .eq("association_id", association.id)
        .eq("category", "join")
        .eq("to_email", address)
        .eq("subject", claim.subject)
        .is("error", null)
        .gte("sent_at", claim.interrupted_at)
        .limit(1)
        .maybeSingle();
      if (logged) {
        const { error: finishError } = await admin.rpc("finish_join_notice", {
          p_request_id: request.id,
          p_email: address,
          p_ok: true,
          p_provider_id: logged.provider_id,
        });
        if (finishError) throw new Error(finishError.message);
        continue;
      }
    }

    const built = joinRequestEmail({
      associationName: association.name,
      officerName: person.name,
      requesterName: request.full_name,
      requesterEmail: request.email,
      unitLabel: request.unit_label ?? "",
      note: request.note ?? "",
      url: claim.url,
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
        // The durable claim already means one notice per officer per request.
        // This is the second lock, for the window before the claim landed,
        // and it replays a retry the provider already accepted.
        { idempotencyKey: `join-request/${request.id}/${address}` },
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
      to_email: address,
      subject: built.subject,
      provider_id: providerId,
      error: sendError,
    });

    // A failed send leaves the row claimable, so the next ask for this
    // request reaches this officer and nobody else again.
    const { error: finishError } = await admin.rpc("finish_join_notice", {
      p_request_id: request.id,
      p_email: address,
      p_ok: !sendError,
      p_provider_id: providerId,
      p_error: sendError,
    });
    if (finishError) {
      // The row stays claimed until its lease runs out, then the reconcile
      // above reads the log before anybody is written to twice.
      result.errors.unshift("The delivery record could not be saved.");
    }

    if (sendError) {
      result.failed++;
      result.errors.push(`${address}: ${sendError}`);
    } else {
      result.sent++;
    }
    if (unrecorded) result.errors.unshift(unrecorded);
  }

  return { status: "sent", ...result };
}
