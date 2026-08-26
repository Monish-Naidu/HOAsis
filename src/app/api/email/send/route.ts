import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendDuesEmails, type DuesCategory } from "@/lib/email/send";

/**
 * Sending a dues run.
 *
 * Authorization happens here rather than in the browser that called it. The
 * caller's own session is used to check they actually hold `communications`
 * for the association they named, which means a crafted request from somebody
 * else's console gets a 403 rather than a mail run.
 */
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: {
    associationId?: string;
    category?: DuesCategory;
    dueDate?: string;
    dryRun?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const { associationId, category, dueDate, dryRun } = body;
  if (!associationId || !category || !dueDate) {
    return NextResponse.json(
      { error: "associationId, category and dueDate are all required" },
      { status: 400 },
    );
  }
  if (category !== "assessment" && category !== "delinquency") {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  // Asked as the caller, so the answer comes from the same policies that
  // guard every other read rather than from a claim in the request body.
  const { data: allowed } = await supabase.rpc("has_capability", {
    target: associationId,
    needed: "communications",
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have the communications capability" },
      { status: 403 },
    );
  }

  const { data: association } = await supabase
    .from("associations")
    .select("name")
    .eq("id", associationId)
    .single();

  try {
    const result = await sendDuesEmails({
      associationId,
      associationName: association?.name ?? "Your association",
      category,
      dueDate,
      origin: request.nextUrl.origin,
      dryRun,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send" },
      { status: 500 },
    );
  }
}
