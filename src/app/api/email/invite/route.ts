import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/log";
import { Resend } from "resend";
import { emailSender } from "@/lib/email/sender";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { inviteEmail } from "@/lib/email/templates";
import { signInUrl } from "@/lib/email/sign-in-link";
import { createInviteLimiter, spendInvites } from "@/lib/email/invite-limit";
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
 */

/** Six hundred messages an hour for one association (src/lib/email/invite-limit.ts). */
const inviteLimiter = createInviteLimiter();

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

  // Counted before the first send, one for each message this call would
  // put out, so a loop of full batches stops at the ceiling.
  const addressed = (members ?? []).filter((m) => (m.invited_email ?? "").trim()).length;
  const within = spendInvites(inviteLimiter, associationId, addressed);
  if (!within.ok) {
    log.warn("invite limit reached", { kind, asked: addressed });
    return NextResponse.json(
      { error: "That is more invitations than one association can send in an hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(within.retryAfterSeconds) } },
    );
  }

  const origin = siteOrigin(request);
  const client = new Resend(key);
  const result = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

  for (const m of members ?? []) {
    const email = (m.invited_email ?? "").trim();
    if (!email) {
      result.skipped++;
      continue;
    }
    const units = m.units as unknown as { label: string } | { label: string }[] | null;
    const unitLabel = (Array.isArray(units) ? units[0]?.label : units?.label) ?? "";
    const hasAccount = Boolean(m.profile_id);
    let url = remoteInviteUrl(association.join_code, email, origin);
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

    const { data, error } = await client.emails.send({
      from: emailSender(),
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });

    await admin.from("email_log").insert({
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
  }
  log.info("invites sent", { kind, sent: result.sent, failed: result.failed, skipped: result.skipped });

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
