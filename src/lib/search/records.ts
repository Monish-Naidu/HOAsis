import type { LucideIcon } from "lucide-react";
import type { Community } from "@/lib/data/community";
import type { TintName } from "@/components/ui/primitives";
import type { Home } from "@/lib/types";
import { formatDate, money } from "@/lib/utils";
import { vendorPaidThisYear } from "@/lib/metrics";
import { statusLabel } from "@/lib/request-status";
import { homeLabel } from "@/lib/wording";
import { ballotPhase, meetingPhase } from "@/lib/phases";
import type { Searchable } from "./match";

/**
 * One search across everything the association has ever recorded.
 *
 * A board in its third year does not want a filter bar on twelve tabs; it
 * wants to type "roof" or "Calloway" or "2024 budget" and land on the thing.
 * The index is built from the records already in memory, so it is exactly as
 * current as every screen, and each hit carries a link that opens the item in
 * place on its own tab.
 *
 * Kinds are gated two ways: the board sees a kind only when its tab is open
 * to that seat (the route table decides), and a resident sees only what their
 * own tabs would show them.
 */

export type SearchKind =
  | "household"
  | "transaction"
  | "document"
  | "thread"
  | "meeting"
  | "ballot"
  | "request"
  | "notice"
  | "vendor"
  | "announcement"
  | "post"
  | "action"
  | "charge"
  | "page"
  | "shortcut";

export interface SearchHit extends Searchable {
  id: string;
  kind: SearchKind;
  /** The group heading in the results, which is the tab it opens. */
  section: string;
  href: string;
  tint: TintName;
  /** A page's own icon, where it has one; otherwise the kind's. */
  icon?: LucideIcon;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  household: "Homeowners",
  transaction: "Transactions",
  document: "Documents",
  thread: "Messages",
  meeting: "Meetings",
  ballot: "Voting",
  request: "Requests",
  notice: "Notices",
  vendor: "Vendors",
  announcement: "Announcements",
  post: "Community",
  action: "Action items",
  charge: "Your account",
  page: "Go to",
  shortcut: "Shortcuts",
};

/** The tab each kind lives on, for the board's capability gate. */
export const KIND_ROUTE: Record<Exclude<SearchKind, "charge" | "page" | "shortcut">, string> = {
  household: "/board/homeowners",
  transaction: "/board/money/transactions",
  document: "/board/documents",
  thread: "/board/communications",
  meeting: "/board/meetings",
  ballot: "/board/voting",
  request: "/board/requests",
  notice: "/board/violations",
  vendor: "/board/vendors",
  announcement: "/board/communications/announcements",
  post: "/board/forum",
  // Action items live on Meetings since the 2026-09-24 board pass.
  action: "/board/meetings",
};

export const TINT: Record<SearchKind, TintName> = {
  household: "violet",
  transaction: "teal",
  document: "violet",
  thread: "blue",
  meeting: "amber",
  ballot: "violet",
  request: "blue",
  notice: "coral",
  vendor: "amber",
  announcement: "coral",
  post: "coral",
  action: "coral",
  charge: "teal",
  page: "blue",
  shortcut: "teal",
};

const q = (s: string) => encodeURIComponent(s);

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "2026-10-03" → "october 2026 oct". The month by name is how people say a date. */
export function dateWords(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const name = MONTHS[m - 1];
  if (!name) return iso.slice(0, 4);
  return `${name} ${name.slice(0, 3)} ${iso.slice(0, 4)}`;
}

/** 28500 → "285 285.00", the two ways a person types an amount. */
export function amountWords(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  return `${dollars} ${(abs / 100).toFixed(2)}`;
}

/** What people call an assessment when they are not reading the ledger. */
const CATEGORY_WORDS: Record<string, string> = {
  Assessments: "dues assessment hoa fees",
  "Late fees": "fine penalty",
  "Reserve transfer": "reserves savings",
  "Interest income": "earned",
  "Repairs & maintenance": "repair fix",
  "Legal & professional": "lawyer attorney",
};

function categoryWords(category: string): string {
  return `${category} ${CATEGORY_WORDS[category] ?? ""}`;
}

type Draft = Omit<SearchHit, "tint" | "section">;

/** Everything a board seat may search, before the capability gate. */
export function boardIndex(c: Community): SearchHit[] {
  const hits: SearchHit[] = [];
  const hit = (h: Draft) => hits.push({ ...h, tint: TINT[h.kind], section: KIND_LABEL[h.kind] });

  for (const o of c.homes) {
    hit({
      id: `own-${o.id}`,
      kind: "household",
      title: o.displayName,
      // Homes numbered without addresses read "Unit 4 · · $9,950.00 owed" otherwise.
      subtitle: [homeLabel(c, o.unit), o.address, o.balanceCents > 0 ? `${money(o.balanceCents)} owed` : ""]
        .filter(Boolean)
        .join(" · "),
      date: o.moveInDate,
      // The household itself, expanded, not the roster it is somewhere on.
      href: `/board/homeowners?q=${q(o.displayName)}&open=${q(o.id)}`,
      keywords: [
        o.members.join(" "),
        o.email,
        o.phone,
        o.phone.replace(/\D/g, ""),
        o.unit,
        o.boardRole ?? "",
        o.standing,
        o.balanceCents > 0 ? `owed behind ${amountWords(o.balanceCents)}` : "",
        o.autopay ? "autopay" : "",
      ].join(" "),
    });
  }
  for (const e of c.ledger) {
    const year = e.date.slice(0, 4);
    hit({
      id: `tx-${e.id}`,
      kind: "transaction",
      title: e.description,
      subtitle: `${e.counterparty} · ${money(Math.abs(e.amountCents))} · ${formatDate(e.date)}`,
      date: e.date,
      href: `/board/money/transactions?q=${q(e.description)}&from=${year}-01-01&to=${year}-12-31`,
      keywords: `${categoryWords(e.category)} ${e.status} ${dateWords(e.date)} ${amountWords(e.amountCents)}`,
    });
  }
  for (const d of c.documents) {
    hit({
      id: `doc-${d.id}`,
      kind: "document",
      title: d.name,
      subtitle: `${d.category} · ${formatDate(d.updatedDate)}`,
      date: d.updatedDate,
      href: `/board/documents?q=${q(d.name)}`,
      keywords: `${d.fileType} ${d.visibility} ${dateWords(d.updatedDate)}`,
    });
  }
  for (const t of c.threads) {
    hit({
      id: `th-${t.id}`,
      kind: "thread",
      title: t.subject,
      subtitle: `${t.participants.join(", ")}${t.unit ? ` · ${homeLabel(c, t.unit)}` : ""} · ${formatDate(t.updatedDate)}`,
      date: t.updatedDate,
      href: `/board/communications?thread=${q(t.id)}`,
      keywords: `${t.tag} ${t.unit ?? ""} ${dateWords(t.updatedDate)} ${t.messages.map((m) => m.body).join(" ").slice(0, 600)}`,
    });
  }
  for (const m of c.meetings) {
    hit({
      id: `mtg-${m.id}`,
      kind: "meeting",
      title: m.title,
      // By phase, as the Meetings page reads it: nothing marks a real
      // association's meeting ended, so its date does.
      subtitle: `${formatDate(m.date)} · ${m.time} · ${m.location}${meetingPhase(m) === "ended" ? " · ended" : ""}`,
      date: m.date,
      href: `/board/meetings#mtg-${m.id}`,
      keywords: `${m.kind} ${meetingPhase(m)} ${m.agenda.join(" ")} ${dateWords(m.date)}`,
    });
  }
  for (const b of c.ballots) {
    hit({
      id: `bal-${b.id}`,
      kind: "ballot",
      title: b.title,
      // A ballot past its closing date reads closed, pressed or not.
      subtitle: `${b.reference} · ${ballotPhase(b)} · closes ${formatDate(b.closesDate)}`,
      date: b.closesDate,
      href: `/board/voting#ballot-${b.id}`,
      keywords: `${b.kind} ${b.reference} ${b.body.join(" ").slice(0, 400)} ${dateWords(b.closesDate)}`,
    });
  }
  for (const r of c.requests) {
    hit({
      id: `req-${r.id}`,
      kind: "request",
      title: r.title,
      subtitle: `${r.reference} · ${r.ownerName}, ${homeLabel(c, r.unit)} · ${statusLabel[r.status]}`,
      date: r.submittedDate,
      href: `/board/requests#req-${r.id}`,
      keywords: `${r.reference} ${r.kind} ${r.unit} ${r.summary} ${dateWords(r.submittedDate)}`,
    });
  }
  for (const v of c.violations) {
    hit({
      id: `vio-${v.id}`,
      kind: "notice",
      title: v.rule,
      subtitle: `${v.reference} · ${v.ownerName}, ${homeLabel(c, v.unit)} · ${v.stage === "cured" ? "resolved" : "open"}`,
      date: v.openedDate,
      // The notice itself, open, not the list it is somewhere on.
      href: `/board/violations?open=${q(v.id)}#vio-${v.id}`,
      keywords: `${v.reference} ${v.ruleCitation} ${v.unit} violation ${dateWords(v.openedDate)}`,
    });
  }
  for (const v of c.vendors) {
    hit({
      id: `ven-${v.id}`,
      kind: "vendor",
      title: v.name,
      subtitle: `${v.service} · ${money(vendorPaidThisYear(c, v))} paid this year`,
      date: v.coiExpires ?? "",
      href: `/board/vendors#vendor-${v.id}`,
      keywords: `${v.defaultCategory} contractor payee ${v.w9OnFile ? "w9" : "no w9"}${v.coiExpires ? " coi insurance" : ""}`,
    });
  }
  for (const a of c.announcements) {
    hit({
      id: `ann-${a.id}`,
      kind: "announcement",
      title: a.title,
      subtitle: `${a.category} · ${formatDate(a.postedDate)}`,
      date: a.postedDate,
      href: `/board/communications/announcements#announcements`,
      keywords: `${a.author} ${a.body.slice(0, 400)} ${dateWords(a.postedDate)}`,
    });
  }
  for (const p of c.posts) {
    hit({
      id: `post-${p.id}`,
      kind: "post",
      title: p.title || p.body.slice(0, 60),
      subtitle: `${p.author} · ${p.category} · ${p.at}`,
      date: p.at,
      href: `/board/forum#post-${p.id}`,
      keywords: `${p.body.slice(0, 400)} ${p.status}`,
    });
  }
  for (const a of c.actionItems) {
    hit({
      id: `act-${a.id}`,
      kind: "action",
      title: a.title,
      subtitle: `${a.ownerName}${a.dueOn ? ` · due ${formatDate(a.dueOn)}` : ""}${a.doneOn ? " · done" : ""}`,
      date: a.dueOn ?? a.doneOn ?? "",
      href: `/board/meetings#action-items`,
      keywords: `todo task ${a.dueOn ? dateWords(a.dueOn) : ""}`,
    });
  }
  return hits;
}

/** What one resident may search: their own things, and what every owner may read. */
export function residentIndex(c: Community, home: Home | null): SearchHit[] {
  const hits: SearchHit[] = [];
  const hit = (h: Draft) => hits.push({ ...h, tint: TINT[h.kind], section: KIND_LABEL[h.kind] });

  for (const d of c.documents) {
    if (d.visibility === "board") continue;
    hit({
      id: `doc-${d.id}`,
      kind: "document",
      title: d.name,
      subtitle: `${d.category} · ${formatDate(d.updatedDate)}`,
      date: d.updatedDate,
      href: `/resident/documents?q=${q(d.name)}`,
      keywords: `${d.fileType} ${dateWords(d.updatedDate)}`,
    });
  }
  // Forms an owner fills in here. The Documents page suggests searching for
  // "fence", and this palette answered "nothing matches" with the fence form
  // one screen away.
  for (const f of c.forms) {
    if (!(f.fields ?? []).length) continue;
    hit({
      id: `form-${f.id}`,
      kind: "document",
      title: f.label,
      subtitle: f.decisionDays ? `Form · answered within ${f.decisionDays} days` : "Form",
      date: f.updatedDate,
      href: `/resident/documents/forms/${f.id}`,
      keywords: `form application request ${f.description}`,
    });
  }
  for (const m of c.meetings) {
    hit({
      id: `mtg-${m.id}`,
      kind: "meeting",
      title: m.title,
      subtitle: `${formatDate(m.date)} · ${m.time} · ${m.location}${meetingPhase(m) === "ended" ? " · ended" : ""}`,
      date: m.date,
      href: `/resident/calendar`,
      keywords: `${m.kind} ${m.agenda.join(" ")} ${dateWords(m.date)}`,
    });
  }
  for (const b of c.ballots) {
    if (b.audience !== "owners") continue;
    hit({
      id: `bal-${b.id}`,
      kind: "ballot",
      title: b.title,
      subtitle: `${ballotPhase(b)} · closes ${formatDate(b.closesDate)}`,
      date: b.closesDate,
      href: `/resident/vote#ballot-${b.id}`,
      keywords: `${b.kind} ${b.body.join(" ").slice(0, 400)} ${dateWords(b.closesDate)}`,
    });
  }
  if (home) {
    for (const r of c.requests) {
      if (r.homeId !== home.id) continue;
      hit({
        id: `req-${r.id}`,
        kind: "request",
        title: r.title,
        subtitle: `${r.reference} · ${statusLabel[r.status]} · ${formatDate(r.submittedDate)}`,
        date: r.submittedDate,
        href: `/resident/requests/${q(r.reference)}`,
        keywords: `${r.reference} ${r.kind} ${r.summary} ${dateWords(r.submittedDate)}`,
      });
    }
    for (const v of c.violations) {
      if (v.homeId !== home.id) continue;
      hit({
        id: `vio-${v.id}`,
        kind: "notice",
        title: v.rule,
        subtitle: `${v.reference} · ${v.stage} · ${formatDate(v.openedDate)}`,
        date: v.openedDate,
        href: `/resident/notices`,
        keywords: `${v.reference} ${v.ruleCitation} violation ${dateWords(v.openedDate)}`,
      });
    }
    // Their own charges and payments: "october dues" or "285" finds the line.
    for (const line of c.homeCharges[home.id] ?? []) {
      hit({
        id: `chg-${line.id}`,
        kind: "charge",
        title: line.label,
        subtitle: `${line.kind === "charge" ? "Charged" : line.kind === "payment" ? "Paid" : "Credit"} · ${money(Math.abs(line.amountCents))} · ${formatDate(line.date)}`,
        date: line.date,
        href: `/resident/account`,
        keywords: `${line.kind} ${line.kind === "charge" ? "dues assessment" : ""} ${line.method ?? ""} ${dateWords(line.date)} ${amountWords(line.amountCents)}`,
      });
    }
  }
  for (const a of c.announcements) {
    hit({
      id: `ann-${a.id}`,
      kind: "announcement",
      title: a.title,
      subtitle: `${a.author} · ${formatDate(a.postedDate)}`,
      date: a.postedDate,
      href: `/resident`,
      keywords: `${a.body.slice(0, 400)} ${dateWords(a.postedDate)}`,
    });
  }
  for (const p of c.posts) {
    if (p.status !== "published") continue;
    hit({
      id: `post-${p.id}`,
      kind: "post",
      title: p.title || p.body.slice(0, 60),
      subtitle: `${p.author} · ${p.category} · ${p.at}`,
      date: p.at,
      href: `/resident/forum#post-${p.id}`,
      keywords: p.body.slice(0, 400),
    });
  }
  return hits;
}
