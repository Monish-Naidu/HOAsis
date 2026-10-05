import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/log";
import { Resend } from "resend";
import { emailSender } from "@/lib/email/sender";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { inviteEmail } from "@/lib/email/templates";
import { signInUrl } from "@/lib/email/sign-in-link";
import { createInviteLimiter, spendInvites } from "@/lib/email/invite-limit";
import { createPacer, logAttempt, recentlySent, sentKey, stoppedLine, unrecordedLine } from "@/lib/email/pace";
import { remoteInviteUrl } from "@/lib/invitations";
import { communityPath, placeLabel } from "@/lib/community-links";

/**
 * Inviting households, and telling somebody the board let them in.
 *
 * The board asks from the browser; the send happens here, with the caller's
 * own session checked against the association they named. One route for
 * both moments because they are the same message with a different first
 * line: here is your home, come and open it.
 *
 * Who gets which link: somebody with an account gets a magic link straight
 * to their home. Everybody else gets the join page with their address
 * filled in; the seat is claimed when they confirm that address.
 *
 * The send is paced and stops before the time limit below
 * (src/lib/email/pace.ts). A batch that stopped says so in its answer, and
 * sending it again reaches the rest without inviting anybody twice. Whoever
 * was passed over for that reason is counted as `already`, apart from
 * `skipped`, which is a household with no address.
 */
export const maxDuration = 60;

/** Six hundred messages an hour for one association (src/lib/email/invite-limit.ts). */
const inviteLimiter = createInviteLimiter();

const OVER_THE_LIMIT =
  "That is more invitations than one association can send in an hour. Try again later.";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: { associationId?: string; unitIds?: string[]; kind?: "invite" | "welcome" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const { associationId, kind = "invite" } = body;
  const log = logger("email/invite", request, { associationId });
  const unitIds = Array.isArray(body.unitIds) ? body.unitIds.filter((u) => typeof u === "string") : [];
  if (!associationId || unitIds.length === 0) {
    return NextResponse.json({ error: "associationId and unitIds are required" }, { status: 400 });
  }
  if (kind !== "invite" && kind !== "welcome") {
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  }

  // Either capability will do: settings holders add households, and
  // communications holders send the mail. Both are board work.
  const [{ data: settings }, { data: communications }] = await Promise.all([
    supabase.rpc("has_capability", { target: associationId, needed: "settings" }),
    supabase.rpc("has_capability", { target: associationId, needed: "communications" }),
  ]);
  if (!settings && !communications) {
    return NextResponse.json({ error: "You cannot invite for this association" }, { status: 403 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Email is not configured" }, { status: 503 });
  }

  const admin = supabaseAdmin();
  const { data: association } = await admin
    .from("associations")
    .select("name, join_code, slug, city, state")
    .eq("id", associationId)
    .single();
  if (!association) {
    return NextResponse.json({ error: "No such association" }, { status: 404 });
  }

  const { data: members } = await admin
    .from("memberships")
    .select("unit_id, full_name, invited_email, profile_id, units ( label )")
    .eq("association_id", associationId)
    .in("unit_id", unitIds.slice(0, 200))
    .is("ends_on", null);

  const origin = siteOrigin(request);
  const client = new Resend(key);
  const result = { sent: 0, failed: 0, skipped: 0, errors: [] as string[], already: 0, remaining: 0 };

  const pacer = createPacer();
  // A batch for more than one home that names somebody invited in the last
  // hour is a batch being sent again, after a stop or a timeout, and that
  // person is passed over. An invitation to a single home is somebody
  // pressing the button for that household on purpose, and it always goes.
  const batch = new Set(unitIds).size > 1;
  const alreadySent = batch
    ? await recentlySent(admin, { associationId, category: "invite" })
    : new Set<string>();

  const list = members ?? [];
  type Member = (typeof list)[number];
  const labelOf = (m: Member) => {
    const units = m.units as unknown as { label: string } | { label: string }[] | null;
    return (Array.isArray(units) ? units[0]?.label : units?.label) ?? "";
  };
  // The subject does not depend on the link, so a repeat is told from the
  // join page address alone, before a sign-in link is minted for somebody
  // who will not be sent it.
  const subjectFor = (m: Member, email: string) =>
    inviteEmail({
      kind,
      associationName: association.name,
      associationPlace: placeLabel(association.city, association.state),
      ownerName: m.full_name || "",
      unitLabel: labelOf(m),
      url: remoteInviteUrl(association.join_code, email, origin),
      hasAccount: Boolean(m.profile_id),
    }).subject;
  const alreadyInvited = (m: Member) => {
    const email = (m.invited_email ?? "").trim();
    return alreadySent.size > 0 && alreadySent.has(sentKey(email, subjectFor(m, email), m.unit_id));
  };

  for (let index = 0; index < list.length; index++) {
    const m = list[index];
    // Out of time. Stop with an answer while there is still time to give one.
    // Whoever already has the invitation is not waiting for it.
    if (pacer.outOfTime()) {
      result.remaining = list
        .slice(index)
        .filter((rest) => (rest.invited_email ?? "").trim() && !alreadyInvited(rest)).length;
      if (result.remaining > 0) {
        result.failed += result.remaining;
        result.errors.unshift(stoppedLine(result.remaining, batch));
      }
      break;
    }
    const email = (m.invited_email ?? "").trim();
    if (!email) {
      result.skipped++;
      continue;
    }
    const unitLabel = labelOf(m);
    const hasAccount = Boolean(m.profile_id);
    let url = remoteInviteUrl(association.join_code, email, origin);
    if (alreadyInvited(m)) {
      result.already++;
      continue;
    }
    // The hourly ceiling, counted one message at a time and only for a
    // message about to go. It used to be spent for every address in the
    // batch on every press, sent or not, so a long batch finished over a
    // few presses ran into the ceiling on its own and was refused with
    // homes still waiting.
    const within = spendInvites(inviteLimiter, associationId, 1);
    if (!within.ok) {
      const waiting = list
        .slice(index)
        .filter((rest) => (rest.invited_email ?? "").trim() && !alreadyInvited(rest)).length;
      log.warn("invite limit reached", { kind, sent: result.sent, waiting });
      // Nothing went out in this call: the plain refusal, as before.
      if (result.sent === 0 && result.failed === 0) {
        return NextResponse.json(
          { error: OVER_THE_LIMIT },
          { status: 429, headers: { "Retry-After": String(within.retryAfterSeconds) } },
        );
      }
      // Some did. Say how many, and why the rest did not. Not counted as
      // `remaining`: pressing again now would only be refused.
      result.failed += waiting;
      result.errors.unshift(OVER_THE_LIMIT);
      break;
    }
    if (hasAccount) {
      url = await signInUrl(admin, {
        email,
        type: "magiclink",
        origin,
        // Straight into this association, whichever others they hold.
        path: communityPath(association.slug, "/resident"),
      });
    }

    const built = inviteEmail({
      kind,
      associationName: association.name,
      associationPlace: placeLabel(association.city, association.state),
      ownerName: m.full_name || "",
      unitLabel,
      url,
      hasAccount,
    });

    await pacer.turn();
    const { data, error } = await client.emails.send({
      from: emailSender(),
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    const unrecorded = await logAttempt(admin, {
      association_id: associationId,
      profile_id: m.profile_id,
      unit_id: m.unit_id,
      to_email: email,
      category: "invite",
      subject: built.subject,
      provider_id: data?.id ?? null,
      error: error?.message ?? null,
    });

    if (error) {
      log.warn("invite failed", { to: email, err: error.message });
      result.failed++;
      result.errors.push(`${email}: ${error.message}`);
    } else {
      result.sent++;
    }

    // The log is the only memory of who has been invited, and the screen
    // presses again while homes are waiting. Without the row the next press
    // would invite this home a second time, so the run stops here and says so,
    // as the dues and notice sends do.
    if (unrecorded) {
      const waiting = list
        .slice(index + 1)
        .filter((rest) => (rest.invited_email ?? "").trim() && !alreadyInvited(rest)).length;
      log.error("invite log write failed", { err: unrecorded, waiting });
      result.failed += waiting;
      result.errors.unshift(unrecordedLine(waiting));
      break;
    }
  }
  log.info("invites sent", { kind, sent: result.sent, failed: result.failed, skipped: result.skipped, already: result.already, remaining: result.remaining });

  return NextResponse.json(result);
}

/** Where links in the email should point: this deployment, never the body. */
function siteOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
