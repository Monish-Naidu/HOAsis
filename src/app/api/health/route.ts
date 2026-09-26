import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

/**
 * GET /api/health: 200 when the database answers and the keys the money and
 * mail paths need are present, 503 otherwise. Point an uptime check here.
 * The body names what is missing, never what a key is.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await runHealthChecks();
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
