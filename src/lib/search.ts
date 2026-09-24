import type { Community } from "@/lib/data/community";
import type { TintName } from "@/components/ui/primitives";
import type { Owner } from "@/lib/types";
import { money } from "@/lib/utils";
import { statusLabel } from "@/lib/request-status";
import { homeLabel } from "@/lib/wording";

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
  | "action";

export interface SearchHit {
  id: string;
  kind: SearchKind;
  /** The group heading in the results, which is the tab it opens. */
  section: string;
  title: string;
  subtitle: string;
  /** `YYYY-MM-DD`, for ordering ties by recency. */
  date: string;
  href: string;
  tint: TintName;
  /** Extra words that should find this, never shown. */
  keywords: string;
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
};

/** The tab each kind lives on, for the board's capability gate. */
export const KIND_ROUTE: Record<SearchKind, string> = {
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

const TINT: Record<SearchKind, TintName> = {
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
};

const q = (s: string) => encodeURIComponent(s);

/** Everything a board seat may search, before the capability gate. */
export function boardIndex(c: Community): SearchHit[] {
  const hits: SearchHit[] = [];
  const hit = (h: Omit<SearchHit, "tint" | "section">) =>
    hits.push({ ...h, tint: TINT[h.kind], section: KIND_LABEL[h.kind] });

  for (const o of c.owners) {
    hit({
      id: `own-${o.id}`,
      kind: "household",
      title: o.displayName,
      // Homes numbered without addresses read "Unit 4 · · $9,950.00 owed" otherwise.
      subtitle: [homeLabel(c, o.unit), o.address, o.balanceCents > 0 ? `${money(o.balanceCents)} owed` : ""]
        .filter(Boolean)
        .join(" · "),
      date: o.moveInDate,
      href: `/board/homeowners?q=${q(o.displayName)}`,
      keywords: [o.members.join(" "), o.email, o.phone, o.boardRole ?? ""].join(" "),
    });
  }
  for (const e of c.ledger) {
    const year = e.date.slice(0, 4);
    hit({
      id: `tx-${e.id}`,
      kind: "transaction",
      title: e.description,
      subtitle: `${e.counterparty} · ${money(Math.abs(e.amountCents))} · ${e.date}`,
      date: e.date,
      href: `/board/money/transactions?q=${q(e.description)}&from=${year}-01-01&to=${year}-12-31`,
      keywords: `${e.category} ${e.status} ${year}`,
    });
  }
  for (const d of c.documents) {
    hit({
      id: `doc-${d.id}`,
      kind: "document",
      title: d.name,
      subtitle: `${d.category} · ${d.updatedDate}`,
      date: d.updatedDate,
      href: `/board/documents?q=${q(d.name)}`,
      keywords: `${d.fileType} ${d.visibility} ${d.updatedDate.slice(0, 4)}`,
    });
  }
  for (const t of c.threads) {
    hit({
      id: `th-${t.id}`,
      kind: "thread",
      title: t.subject,
      subtitle: `${t.participants.join(", ")}${t.unit ? ` · ${homeLabel(c, t.unit)}` : ""} · ${t.updatedDate}`,
      date: t.updatedDate,
      href: `/board/communications?thread=${q(t.id)}`,
      keywords: `${t.tag} ${t.messages.map((m) => m.body).join(" ").slice(0, 600)}`,
    });
  }
  for (const m of c.meetings) {
    hit({
      id: `mtg-${m.id}`,
      kind: "meeting",
      title: m.title,
      subtitle: `${m.date} · ${m.time} · ${m.location}${m.status === "ended" ? " · ended" : ""}`,
      date: m.date,
      href: `/board/meetings#mtg-${m.id}`,
      keywords: `${m.kind} ${m.agenda.join(" ")} ${m.date.slice(0, 4)}`,
    });
  }
  for (const b of c.ballots) {
    hit({
      id: `bal-${b.id}`,
      kind: "ballot",
      title: b.title,
      subtitle: `${b.reference} · ${b.status} · closes ${b.closesDate}`,
      date: b.closesDate,
      href: `/board/voting#ballot-${b.id}`,
      keywords: `${b.kind} ${b.body.join(" ").slice(0, 400)} ${b.closesDate.slice(0, 4)}`,
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
      keywords: `${r.kind} ${r.summary} ${r.submittedDate.slice(0, 4)}`,
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
      keywords: `${v.ruleCitation} ${v.openedDate.slice(0, 4)}`,
    });
  }
  for (const v of c.vendors) {
    hit({
      id: `ven-${v.id}`,
      kind: "vendor",
      title: v.name,
      subtitle: `${v.service} · ${money(v.ytdPaidCents)} paid this year`,
      date: v.coiExpires ?? "",
      href: `/board/vendors#vendor-${v.id}`,
      keywords: v.defaultCategory,
    });
  }
  for (const a of c.announcements) {
    hit({
      id: `ann-${a.id}`,
      kind: "announcement",
      title: a.title,
      subtitle: `${a.category} · ${a.postedDate}`,
      date: a.postedDate,
      href: `/board/communications/announcements#announcements`,
      keywords: `${a.body.slice(0, 400)} ${a.postedDate.slice(0, 4)}`,
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
      subtitle: `${a.ownerName}${a.dueOn ? ` · due ${a.dueOn}` : ""}${a.doneOn ? " · done" : ""}`,
      date: a.dueOn ?? a.doneOn ?? "",
      href: `/board/meetings#action-items`,
      keywords: "",
    });
  }
  return hits;
}

/** What one resident may search: their own things, and what every owner may read. */
export function residentIndex(c: Community, owner: Owner | null): SearchHit[] {
  const hits: SearchHit[] = [];
  const hit = (h: Omit<SearchHit, "tint" | "section">) =>
    hits.push({ ...h, tint: TINT[h.kind], section: KIND_LABEL[h.kind] });

  for (const d of c.documents) {
    if (d.visibility === "board") continue;
    hit({
      id: `doc-${d.id}`,
      kind: "document",
      title: d.name,
      subtitle: `${d.category} · ${d.updatedDate}`,
      date: d.updatedDate,
      href: `/resident/documents?q=${q(d.name)}`,
      keywords: `${d.fileType} ${d.updatedDate.slice(0, 4)}`,
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
      subtitle: `${m.date} · ${m.time} · ${m.location}${m.status === "ended" ? " · ended" : ""}`,
      date: m.date,
      href: `/resident/calendar`,
      keywords: `${m.kind} ${m.agenda.join(" ")} ${m.date.slice(0, 4)}`,
    });
  }
  for (const b of c.ballots) {
    if (b.audience !== "owners") continue;
    hit({
      id: `bal-${b.id}`,
      kind: "ballot",
      title: b.title,
      subtitle: `${b.status} · closes ${b.closesDate}`,
      date: b.closesDate,
      href: `/resident/vote#ballot-${b.id}`,
      keywords: `${b.kind} ${b.body.join(" ").slice(0, 400)}`,
    });
  }
  if (owner) {
    for (const r of c.requests) {
      if (r.ownerId !== owner.id) continue;
      hit({
        id: `req-${r.id}`,
        kind: "request",
        title: r.title,
        subtitle: `${r.reference} · ${statusLabel[r.status]} · ${r.submittedDate}`,
        date: r.submittedDate,
        href: `/resident/requests/${q(r.reference)}`,
        keywords: `${r.kind} ${r.summary}`,
      });
    }
    for (const v of c.violations) {
      if (v.ownerId !== owner.id) continue;
      hit({
        id: `vio-${v.id}`,
        kind: "notice",
        title: v.rule,
        subtitle: `${v.reference} · ${v.stage} · ${v.openedDate}`,
        date: v.openedDate,
        href: `/resident/notices`,
        keywords: v.ruleCitation,
      });
    }
  }
  for (const a of c.announcements) {
    hit({
      id: `ann-${a.id}`,
      kind: "announcement",
      title: a.title,
      subtitle: `${a.author} · ${a.postedDate}`,
      date: a.postedDate,
      href: `/resident`,
      keywords: a.body.slice(0, 400),
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

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * Every word typed has to appear somewhere on the hit. A word at the start
 * of the title outranks one in the middle, which outranks one in the
 * subtitle or the hidden keywords; ties go to the newest.
 */
export function searchHits(index: SearchHit[], query: string, limit = 30): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { hit: SearchHit; score: number }[] = [];
  for (const hit of index) {
    const title = fold(hit.title);
    const subtitle = fold(hit.subtitle);
    const keywords = fold(hit.keywords);
    let score = 0;
    for (const word of words) {
      if (title.startsWith(word) || title.includes(` ${word}`)) score += 6;
      else if (title.includes(word)) score += 4;
      else if (subtitle.includes(word)) score += 2;
      else if (keywords.includes(word)) score += 1;
      else {
        score = 0;
        break;
      }
    }
    if (score > 0) scored.push({ hit, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.hit.date.localeCompare(a.hit.date))
    .slice(0, limit)
    .map((s) => s.hit);
}

/** Hits in the order found, grouped under their tab, each group capped. */
export function groupHits(hits: SearchHit[], perGroup = 5): { section: string; hits: SearchHit[] }[] {
  const groups: { section: string; hits: SearchHit[] }[] = [];
  for (const hit of hits) {
    let group = groups.find((g) => g.section === hit.section);
    if (!group) {
      group = { section: hit.section, hits: [] };
      groups.push(group);
    }
    if (group.hits.length < perGroup) group.hits.push(hit);
  }
  return groups;
}
