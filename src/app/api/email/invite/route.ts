import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { inviteEmail } from "@/lib/email/templates";
import { remoteInviteUrl } from "@/lib/invitations";

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
    .select("name, join_code")
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
      const { data: link } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${origin}/resident` },
      });
      if (link?.properties?.action_link) url = link.properties.action_link;
      else url = `${origin}/signin`;
    }

    const built = inviteEmail({
      kind,
      associationName: association.name,
      ownerName: m.full_name || "",
      unitLabel,
      url,
      hasAccount,
    });

    const { data, error } = await client.emails.send({
      from: process.env.EMAIL_FROM ?? "Your HOAsis <onboarding@resend.dev>",
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
      result.failed++;
      result.errors.push(`${email}: ${error.message}`);
    } else {
      result.sent++;
    }
  }

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
