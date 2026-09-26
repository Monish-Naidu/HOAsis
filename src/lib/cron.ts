import { after, type NextRequest } from "next/server";

/**
 * Bounded runs for the daily crons.
 *
 * Each cron used to read every live row and walk the lot inside one
 * function call. Vercel ends a function at its limit (60 seconds on Hobby,
 * longer on Pro, but never unbounded) and the rows past that point were
 * simply never visited, with nothing in the response to say so. With a few
 * hundred associations and Stripe in the loop, that is a real morning.
 *
 * So a run takes a page at a time in id order, keeps an eye on the clock,
 * and when the budget is spent it answers with `next` set to the last id it
 * finished and schedules itself again with `?after=<that id>`. The
 * continuation runs after this response is sent, carrying the same secret,
 * so the cron schedule stays one entry and a long day is many short calls.
 *
 * Every route stays idempotent on its own (unique keys and "already
 * decided" checks), so a page visited twice costs nothing.
 */

/** Seconds a run may spend before handing over. Under Hobby's 60. */
export const CRON_BUDGET_MS = 40_000;

/** Rows fetched per page. */
export const CRON_PAGE = 100;

export interface CronPlan {
  /** Where to resume: the last id finished by the previous call, or null. */
  after: string | null;
  /** True once the budget is spent. Check between rows, not inside one. */
  outOfTime(): boolean;
  /** The URL that continues this run past `lastId`. */
  continuation(lastId: string): string;
}

export function cronPlan(
  request: { nextUrl: URL },
  options: { budgetMs?: number; now?: () => number } = {},
): CronPlan {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? CRON_BUDGET_MS);
  const after = request.nextUrl.searchParams.get("after");
  return {
    after: after && after.trim() ? after.trim() : null,
    outOfTime: () => now() >= deadline,
    continuation: (lastId) => continuationUrl(request.nextUrl.toString(), lastId),
  };
}

/** The same URL with `after` replaced. Pure, so it can be tested. */
export function continuationUrl(url: string, lastId: string): string {
  const next = new URL(url);
  next.searchParams.set("after", lastId);
  return next.toString();
}

/**
 * Fires the next call once this response has gone out. The secret goes
 * with it, because the route it calls is the one that checks it.
 */
export function scheduleContinuation(request: NextRequest, url: string): void {
  const authorization = request.headers.get("authorization") ?? "";
  after(async () => {
    try {
      await fetch(url, { headers: { authorization }, cache: "no-store" });
    } catch {
      // The next scheduled run starts from the top and finds the same rows
      // still waiting. Nothing is lost, only delayed a day.
    }
  });
}

/**
 * Walks a table in id order, a page at a time, calling `visit` for each row
 * until the rows run out or the budget does. Returns where it stopped.
 */
export async function walkPages<T extends { id: string }>(
  plan: CronPlan,
  page: (afterId: string | null, limit: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  visit: (row: T) => Promise<void>,
  pageSize = CRON_PAGE,
): Promise<{ complete: boolean; last: string | null; error?: string }> {
  let cursor = plan.after;
  for (;;) {
    const { data, error } = await page(cursor, pageSize);
    if (error) return { complete: false, last: cursor, error: error.message };
    const rows = data ?? [];
    for (const row of rows) {
      if (plan.outOfTime()) return { complete: false, last: cursor };
      await visit(row);
      cursor = row.id;
    }
    if (rows.length < pageSize) return { complete: true, last: cursor };
  }
}
