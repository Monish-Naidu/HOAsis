import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { remoteInviteUrl } from "@/lib/invitations";
import { clockTime } from "@/lib/utils";
import { statusLabel } from "@/lib/request-status";
import type { RequestStatus } from "@/lib/types";
import {
  announcementEmail,
  ballotOpenEmail,
  boardMessageEmail,
  meetingNoticeEmail,
  requestUpdateEmail,
} from "./templates";
import { meetingJoin } from "@/lib/meetings/video";
import { emailSender, resendKey } from "./sender";
import { unsubscribeUrl } from "./tokens";
import { replyToFor } from "./reply-to";
import { signInUrl } from "./sign-in-link";
import {
  createPacer,
  logAttempt,
  recentlySent,
  sentKey,
  stoppedLine,
  unrecordedLine,
  UNRECORDED,
  type Pacer,
} from "./pace";

/**
 * Everything the board sends that is not a dues run or an invitation.
 *
 * One sender for six moments, because they share every rule that matters:
 * the recipient list comes from `email_recipients`, which owns the opt out;
 * each person gets one link that signs them in; every attempt lands in
 * `email_log`, sent or not; and the words come from the row the board just
 * wrote, read back here, rather than from whatever the browser posted.
 *
 * A notice to more than one home passes over anybody who got the same
 * notice in the last hour (src/lib/email/pace.ts). One call can stop at the
 * time limit with part of the roster unreached, and that is what lets the
 * next call carry on from there instead of starting over. That rests on
 * `email_log` alone, so a send to several homes whose log row cannot be
 * written stops there, with nobody left as `remaining` to call again for.
 *
 * Server only. The API route checks the caller's capability before this
 * runs, and this trusts that check the way the dues sender does.
 */

export type NotifyKind = "announcement" | "meeting" | "ballot" | "letter" | "message" | "request";

type Category = Database["public"]["Enums"]["email_category"];

export interface NotifyInput {
  associationId: string;
  kind: NotifyKind;
  /** The announcement, meeting, ballot or request the notice is about. */
  id?: string;
  /** For a letter or a message: the homes it goes to. */
  unitIds?: string[];
  subject?: string;
  body?: string;
  /** Who pressed send, for the sign-off on a message. */
  senderName?: string;
  origin: string;
  /** Build and log nothing, send nothing. */
  dryRun?: boolean;
  /** The pace and the time budget. Passed in by tests; made here otherwise. */
  pacer?: Pacer;
}

export interface NotifyResult {
  sent: number;
  /** Includes anybody not reached when the send stopped at the time limit. */
  failed: number;
  /** A home that was asked for and has nobody to write to. */
  skipped: number;
  errors: string[];
  /** Passed over because the same notice reached them in the last hour. */
  already: number;
  /** Not reached, because the send stopped at the time limit. Call again to reach them. */
  remaining: number;
  /**
   * Why `email_log` could not be written, when it could not. A send to
   * several homes stopped there, and whoever it did not reach is in `failed`
   * and not in `remaining`: calling again would write to the same people.
   */
  unrecorded?: string;
}

const CATEGORY: Record<NotifyKind, Category> = {
  announcement: "community",
  meeting: "meeting",
  ballot: "ballot",
  letter: "delinquency",
  message: "message",
  request: "request",
};

/** Where the one link lands, once the person is signed in. */
const LANDING: Record<NotifyKind, string> = {
  announcement: "/resident",
  meeting: "/resident/calendar",
  ballot: "/resident/vote",
  letter: "/resident/pay",
  message: "/resident/messages",
  request: "/resident/requests",
};

type Admin = ReturnType<typeof supabaseAdmin>;
type Recipient = Database["public"]["Functions"]["email_recipients"]["Returns"][number];

/**
 * One link that signs the person in. Somebody with an account gets a magic
 * link to the screen; somebody the board only has an address for gets the
 * join page with it filled in, which creates the account and claims the seat.
 */
async function signInLink(
  admin: Admin,
  person: { email: string; profile_id: string | null },
  path: string,
  origin: string,
  joinCode: string,
): Promise<string> {
  if (!person.profile_id) return remoteInviteUrl(joinCode, person.email, origin);
  return signInUrl(admin, { email: person.email, type: "magiclink", origin, path });
}

export async function sendNotification(input: NotifyInput): Promise<NotifyResult> {
  const admin = supabaseAdmin();
  const result: NotifyResult = { sent: 0, failed: 0, skipped: 0, errors: [], already: 0, remaining: 0 };
  const category = CATEGORY[input.kind];
  const statutory = category === "meeting" || category === "ballot" || category === "delinquency";

  const { data: association } = await admin
    .from("associations")
    .select("name, join_code, contact_email")
    .eq("id", input.associationId)
    .single();
  if (!association) throw new Error("No such association");

  // What the notice says, read from the row rather than the request.
  const content = await readContent(admin, input);
  if (!content) throw new Error("Nothing to send: that item was not found");

  const { data: recipients, error } = await admin.rpc("email_recipients", {
    p_association_id: input.associationId,
    p_category: category,
    p_only_past_due: false,
  });
  if (error) throw new Error(`Could not work out who to send this to: ${error.message}`);

  const wanted = content.unitIds ? new Set(content.unitIds) : null;
  const people = ((recipients ?? []) as Recipient[]).filter((p) => p.email && (!wanted || wanted.has(p.unit_id)));
  if (wanted) result.skipped += wanted.size - new Set(people.map((p) => p.unit_id)).size;

  const key = resendKey();
  const client = input.dryRun ? null : key ? new Resend(key) : null;
  let path = LANDING[input.kind];
  if (input.kind === "request" && content.reference) path = `/resident/requests/${content.reference}`;

  // Resend allows two requests a second, and the function has a time limit.
  // The pacer keeps under the first and stops the loop before the second
  // (src/lib/email/pace.ts), so a long roster ends with a count of who was
  // not reached. It used to end when the platform cut the function off.
  const pacer = input.pacer ?? createPacer();

  // A send that stopped is finished by calling again, and the second call
  // must not start over at the top of the roster. So whoever got this notice
  // in the last hour is passed over, as the dues run and the invitations do.
  //
  // Not for one home. A reply in a thread or a second update on a request
  // goes out under the subject of the first on purpose, and there is no
  // telling it from a repeat. One home is a handful of addresses, so that
  // send is never stopped at the time limit either: with nothing to tell a
  // repeat by, calling again would write to the first of them twice.
  const oneHome = wanted?.size === 1;
  const alreadySent = oneHome
    ? new Set<string>()
    : await recentlySent(admin, { associationId: input.associationId, category });

  const plainUrl = `${input.origin}${path}`;
  const build = (person: Recipient, url: string) =>
    content.build({
      associationName: association.name,
      ownerName: person.full_name || "Neighbor",
      url,
      unsubscribeUrl:
        statutory || !person.profile_id ? null : unsubscribeUrl(input.origin, person.profile_id, category),
      // Decides the line under the button and the footer for somebody the
      // board only has an address for: their link is the join page.
      hasAccount: Boolean(person.profile_id),
    });
  // Asked of the subject alone, which does not depend on the link, so no
  // sign-in link is minted for somebody who will not be sent anything.
  const hasIt = (person: Recipient) =>
    alreadySent.size > 0 &&
    alreadySent.has(sentKey(person.email, build(person, plainUrl).subject, person.unit_id));

  for (let index = 0; index < people.length; index++) {
    const person = people[index];
    if (!input.dryRun && !oneHome && pacer.outOfTime()) {
      // Whoever already has it is not waiting for it.
      result.remaining = people.slice(index).filter((rest) => !hasIt(rest)).length;
      if (result.remaining > 0) {
        result.failed += result.remaining;
        result.errors.unshift(stoppedLine(result.remaining, true));
      }
      break;
    }
    if (hasIt(person)) {
      result.already++;
      continue;
    }
    const url = input.dryRun
      ? plainUrl
      : await signInLink(admin, person, path, input.origin, association.join_code);
    const built = build(person, url);

    if (input.dryRun) {
      result.sent++;
      continue;
    }

    let providerId: string | null = null;
    let sendError: string | null = null;
    if (!client) {
      sendError = "Email is not set up, so nothing was sent.";
    } else {
      try {
        await pacer.turn();
        const sent = await client.emails.send({
          from: emailSender(),
          to: person.email,
          replyTo: replyToFor(association.contact_email),
          subject: built.subject,
          html: built.html,
          text: built.text,
        });
        providerId = sent.data?.id ?? null;
        sendError = sent.error?.message ?? null;
      } catch (caught) {
        sendError = caught instanceof Error ? caught.message : "unknown error";
      }
    }

    const unrecorded = await logAttempt(admin, {
      association_id: input.associationId,
      profile_id: person.profile_id,
      unit_id: person.unit_id,
      to_email: person.email,
      category,
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

    if (unrecorded) {
      // The log row is what the next call passes this person over by. With
      // no row, the browser asking again while anybody remains writes to the
      // same people on every call. So stop here, and leave `remaining` at
      // nothing: the people not reached are counted as failed, which the
      // browser reports and does not call again for.
      //
      // One home carries on. Nothing calls again for it, and stopping would
      // leave a co-owner unwritten with no way to reach them alone.
      if (oneHome) {
        if (!result.unrecorded) result.errors.unshift(UNRECORDED);
        result.unrecorded = unrecorded;
        continue;
      }
      result.unrecorded = unrecorded;
      const notReached = people.slice(index + 1).filter((rest) => !hasIt(rest)).length;
      result.failed += notReached;
      result.errors.unshift(unrecordedLine(notReached));
      break;
    }
  }

  return result;
}

interface Content {
  unitIds?: string[];
  reference?: string;
  build: (person: {
    associationName: string;
    ownerName: string;
    url: string;
    unsubscribeUrl: string | null;
    hasAccount: boolean;
  }) => { subject: string; html: string; text: string };
}

async function readContent(admin: Admin, input: NotifyInput): Promise<Content | null> {
  switch (input.kind) {
    case "announcement": {
      if (!input.id) return null;
      const { data } = await admin
        .from("announcements")
        .select("title, body")
        .eq("id", input.id)
        .eq("association_id", input.associationId)
        .maybeSingle();
      if (!data) return null;
      return { build: (p) => announcementEmail({ ...p, title: data.title, body: data.body }) };
    }
    case "meeting": {
      if (!input.id) return null;
      const meetingId = input.id;
      const { data } = await admin
        .from("meetings")
        .select("title, held_on, held_at, location, dial_in, passcode, agenda")
        .eq("id", input.id)
        .eq("association_id", input.associationId)
        .maybeSingle();
      if (!data) return null;
      // A link the board typed is the video link; see meetingJoin.
      const join = meetingJoin({ id: meetingId, dialIn: data.dial_in, passcode: data.passcode }, input.associationId);
      return {
        build: (p) =>
          meetingNoticeEmail({
            ...p,
            title: data.title,
            date: data.held_on,
            time: clockTime(data.held_at ?? ""),
            location: data.location,
            dialIn: join.dialIn || undefined,
            passcode: join.passcode || undefined,
            videoUrl: join.videoUrl,
            agenda: Array.isArray(data.agenda) ? (data.agenda as string[]) : [],
          }),
      };
    }
    case "ballot": {
      if (!input.id) return null;
      const { data } = await admin
        .from("ballots")
        .select("title, body, closes_on, audience")
        .eq("id", input.id)
        .eq("association_id", input.associationId)
        .maybeSingle();
      // A board-only vote is not notice to owners.
      if (!data || data.audience !== "owners") return null;
      return {
        build: (p) =>
          ballotOpenEmail({ ...p, title: data.title, body: data.body ?? [], closesDate: data.closes_on }),
      };
    }
    case "letter":
    case "message": {
      const subject = (input.subject ?? "").trim();
      const body = (input.body ?? "").trim();
      const unitIds = (input.unitIds ?? []).filter(Boolean);
      if (!subject || !body || unitIds.length === 0) return null;
      const senderName = (input.senderName ?? "").trim() || "The board";
      return {
        unitIds,
        build: (p) =>
          boardMessageEmail({ ...p, subject, body, senderName, statutory: input.kind === "letter" }),
      };
    }
    case "request": {
      if (!input.id) return null;
      const { data } = await admin
        .from("requests")
        .select("reference, title, status, decided_note, unit_id")
        .eq("id", input.id)
        .eq("association_id", input.associationId)
        .maybeSingle();
      if (!data) return null;
      const status = statusLabel[data.status as RequestStatus] ?? data.status;
      return {
        unitIds: [data.unit_id],
        reference: data.reference,
        build: (p) =>
          requestUpdateEmail({
            ...p,
            reference: data.reference,
            title: data.title,
            status,
            note: (input.body ?? data.decided_note ?? "").trim() || `Status changed to ${status.toLowerCase()}.`,
          }),
      };
    }
  }
}
