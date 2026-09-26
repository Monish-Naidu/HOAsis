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
import { videoJoinUrl } from "@/lib/meetings/video";
import { emailSender, resendKey } from "./sender";
import { unsubscribeUrl } from "./tokens";

/**
 * Everything the board sends that is not a dues run or an invitation.
 *
 * One sender for six moments, because they share every rule that matters:
 * the recipient list comes from `email_recipients`, which owns the opt out;
 * each person gets one link that signs them in; every attempt lands in
 * `email_log`, sent or not; and the words come from the row the board just
 * wrote, read back here, rather than from whatever the browser posted.
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
}

export interface NotifyResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
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
  const { data } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: person.email,
    options: { redirectTo: `${origin}${path}` },
  });
  return data?.properties?.action_link ?? `${origin}/signin`;
}

/** Resend's free tier allows two requests a second; a roster send must not trip it. */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendNotification(input: NotifyInput): Promise<NotifyResult> {
  const admin = supabaseAdmin();
  const result: NotifyResult = { sent: 0, failed: 0, skipped: 0, errors: [] };
  const category = CATEGORY[input.kind];
  const statutory = category === "meeting" || category === "ballot" || category === "delinquency";

  const { data: association } = await admin
    .from("associations")
    .select("name, join_code")
    .eq("id", input.associationId)
    .single();
  if (!association) throw new Error("No such association");

  // What the notice says, read from the row rather than the request.
  const content = await readContent(admin, input);
  if (!content) throw new Error("Nothing to send: the record was not found");

  const { data: recipients, error } = await admin.rpc("email_recipients", {
    p_association_id: input.associationId,
    p_category: category,
    p_only_past_due: false,
  });
  if (error) throw new Error(`Could not build the recipient list: ${error.message}`);

  const wanted = content.unitIds ? new Set(content.unitIds) : null;
  const people = ((recipients ?? []) as Recipient[]).filter((p) => p.email && (!wanted || wanted.has(p.unit_id)));
  if (wanted) result.skipped += wanted.size - new Set(people.map((p) => p.unit_id)).size;

  const key = resendKey();
  const client = input.dryRun ? null : key ? new Resend(key) : null;
  let path = LANDING[input.kind];
  if (input.kind === "request" && content.reference) path = `/resident/requests/${content.reference}`;

  for (const person of people) {
    const url = input.dryRun
      ? `${input.origin}${path}`
      : await signInLink(admin, person, path, input.origin, association.join_code);
    const unsub =
      statutory || !person.profile_id ? null : unsubscribeUrl(input.origin, person.profile_id, category);
    const built = content.build({
      associationName: association.name,
      ownerName: person.full_name || "Neighbor",
      url,
      unsubscribeUrl: unsub,
    });

    if (input.dryRun) {
      result.sent++;
      continue;
    }

    let providerId: string | null = null;
    let sendError: string | null = null;
    if (!client) {
      sendError = "RESEND_API_KEY is missing, so nothing can be sent.";
    } else {
      try {
        const sent = await client.emails.send({
          from: emailSender(),
          to: person.email,
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

    await admin.from("email_log").insert({
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
    if (people.length > 1) await pause(550);
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
      return {
        build: (p) =>
          meetingNoticeEmail({
            ...p,
            title: data.title,
            date: data.held_on,
            time: clockTime(data.held_at ?? ""),
            location: data.location,
            dialIn: data.dial_in ?? undefined,
            passcode: data.passcode ?? undefined,
            videoUrl: videoJoinUrl({ id: meetingId }, input.associationId),
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
