import type { supabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Pacing and bounding a send to a whole roster.
 *
 * Two things went wrong with a long list, in opposite directions. The dues
 * run and the invitations sent as fast as the loop would turn, several a
 * second, and Resend allows two: a board inviting forty households at a
 * meeting saw a large share refused on its first real use. And nothing told
 * the function when to stop, so a long enough roster ran into the platform's
 * time limit, the browser got a 504, the first part of the list had mail,
 * and pressing send again mailed them twice.
 *
 * So every roster send takes its turns from one pacer. A turn starts no
 * sooner than SEND_GAP_MS after the last one started, which keeps under two
 * a second without adding the gap on top of work that already took that
 * long. When the budget is spent the loop stops on its own and says how many
 * people it did not reach, which is an answer and not a timeout.
 *
 * The budget sits under the routes' `maxDuration` of 60 seconds, the same
 * margin the crons keep (src/lib/cron.ts). On a plan that allows a longer
 * function, raise the two together.
 */

/** Resend allows two requests a second. A little over half a second apart stays under. */
export const SEND_GAP_MS = 550;

/** How long a roster send may run before it stops and reports. */
export const SEND_BUDGET_MS = 45_000;

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Pacer {
  /** Resolves when the next send may start. The first turn is immediate. */
  turn(): Promise<void>;
  /** True once the budget is spent. Check between people, not inside one. */
  outOfTime(): boolean;
}

/** The clock and the sleep are passed in, so the pacing can be tested without waiting. */
export function createPacer(
  options: {
    gapMs?: number;
    budgetMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Pacer {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? pause;
  const gapMs = options.gapMs ?? SEND_GAP_MS;
  const deadline = now() + (options.budgetMs ?? SEND_BUDGET_MS);
  let lastTurn: number | null = null;
  return {
    async turn() {
      if (lastTurn !== null) {
        const wait = lastTurn + gapMs - now();
        if (wait > 0) await sleep(wait);
      }
      lastTurn = now();
    },
    outOfTime: () => now() >= deadline,
  };
}

/**
 * The line a board reads when a send stopped at the time limit. `safeToRepeat`
 * is for the sends that skip anybody already mailed (see recentlySent), where
 * pressing send again is the way to finish.
 */
export function stoppedLine(remaining: number, safeToRepeat: boolean): string {
  const people = remaining === 1 ? "1 person was" : `${remaining} people were`;
  return safeToRepeat
    ? `Stopped at the time limit. ${people} not reached. Send again to reach them. Nobody who already got this is sent it twice.`
    : `Stopped at the time limit. ${people} not reached.`;
}

/**
 * Writes one attempt to email_log and answers why it could not, or null
 * when the row is in.
 *
 * The answer used to be thrown away. That row is the only memory the repeat
 * guard has (recentlySent, below): when the write failed while the mail went
 * out, nothing marked those people as written to, and a send asked for
 * again, which the browser now does on its own while anybody remains,
 * mailed them again on every call. So the senders read this and stop.
 */
export async function logAttempt(
  admin: ReturnType<typeof supabaseAdmin>,
  row: Database["public"]["Tables"]["email_log"]["Insert"],
): Promise<string | null> {
  try {
    const { error } = await admin.from("email_log").insert(row);
    return error ? error.message : null;
  } catch (caught) {
    return caught instanceof Error ? caught.message : "unknown error";
  }
}

/** What a board reads when mail went out and its record could not be kept. */
export const UNRECORDED = "The log of this send could not be saved.";

/**
 * The line a board reads when a send stopped because email_log could not be
 * written. It does not say to send again: with no record, a second send
 * cannot tell who has the notice.
 */
export function unrecordedLine(notReached: number): string {
  const people = notReached === 1 ? "1 person was" : `${notReached} people were`;
  const rest = notReached > 0 ? ` ${people} not reached.` : "";
  return `Stopped. ${UNRECORDED}${rest} Sending again could write to people who already have it.`;
}

/**
 * One message to one address about one home, for telling a repeat from a
 * first send. The home is part of it because somebody who owns two homes
 * with the same amount due gets two notices under one subject, and the
 * second is not a repeat of the first.
 */
export function sentKey(email: string, subject: string, unitId: string | null | undefined): string {
  return `${email.trim().toLowerCase()}\n${unitId ?? ""}\n${subject}`;
}

/** How far back a repeat of the same message is treated as a repeat. */
export const REPEAT_WINDOW_MS = 60 * 60 * 1000;

/** PostgREST hands back at most a thousand rows to one read. */
export const LOG_PAGE = 1000;

/** Twenty pages is more than two sends a second can write in the hour. */
const LOG_PAGES_AT_MOST = 20;

/**
 * The messages of one category this association has already sent in the
 * last hour, by address, home and subject, successes only.
 *
 * This is what makes "send again" safe after a run that stopped early or
 * timed out: the people who already have the message are passed over, and
 * the rest get it. It is used where the same subject to the same address
 * within the hour is the same message: a dues notice, whose subject carries
 * the amount and the date, an invitation, and a board notice to more than
 * one home, which the browser asks for again until nobody is left. A note
 * to one home may be sent twice under one subject on purpose, a second
 * reply in a thread, so that never uses it.
 *
 * Read a page at a time. One read stops at a thousand rows with no error,
 * and the people past the thousandth would have been mailed twice.
 *
 * A read that fails answers with what it had read so far, which may be
 * nothing. A notice that goes out twice is better than a notice that does
 * not go out.
 */
export async function recentlySent(
  admin: ReturnType<typeof supabaseAdmin>,
  input: {
    associationId: string;
    category: Database["public"]["Enums"]["email_category"];
    now?: () => number;
  },
): Promise<Set<string>> {
  const since = new Date((input.now ?? Date.now)() - REPEAT_WINDOW_MS).toISOString();
  const seen = new Set<string>();
  try {
    for (let page = 0; page < LOG_PAGES_AT_MOST; page++) {
      const from = page * LOG_PAGE;
      const { data, error } = await admin
        .from("email_log")
        .select("to_email, subject, unit_id")
        .eq("association_id", input.associationId)
        .eq("category", input.category)
        .is("error", null)
        .gte("sent_at", since)
        // A fixed order, so no row falls between two pages.
        .order("sent_at")
        .order("id")
        .range(from, from + LOG_PAGE - 1);
      if (error) return seen;
      for (const row of data ?? []) seen.add(sentKey(row.to_email, row.subject, row.unit_id));
      if ((data ?? []).length < LOG_PAGE) break;
    }
  } catch {
    // Nothing more known to be sent.
  }
  return seen;
}
