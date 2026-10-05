import type { AssistantContext } from "@/lib/data";

/** The snapshot plus the one setting the assistant has to honour. */
export type AssistantScope = AssistantContext & { fundsVisible: boolean };
import { formatDate, money, relativeDays } from "@/lib/utils";

/**
 * The in-app assistant.
 *
 * Deliberately not a language model. Every answer is assembled from the
 * context snapshot, so it cannot state a balance that is not the balance.
 * A wrong number here is worse than no answer at all.
 */

export interface Answer {
  text: string;
  facts?: { label: string; value: string }[];
  action?: { label: string; href: string };
}

interface Intent {
  id: string;
  keywords: string[];
  /** Phrases that should win outright, ahead of keyword scoring. */
  phrases?: string[];
  answer: (c: AssistantScope) => Answer;
}

const intents: Intent[] = [
  {
    id: "balance",
    keywords: ["balance", "owe", "late", "overdue", "past", "due", "behind", "payment"],
    phrases: ["do i owe", "am i late", "late payment", "what do i owe", "my balance"],
    answer: (c) => {
      const o = c.owner;
      if (o.daysPastDue > 0) {
        return {
          text: `Yes. Your dues are ${o.daysPastDue} days past due, and you owe ${money(o.balanceCents)}.`,
          facts: [
            { label: "Balance", value: money(o.balanceCents) },
            { label: "Days past due", value: String(o.daysPastDue) },
            { label: "Standing", value: o.standing },
          ],
          action: { label: "Pay now", href: "/resident/pay" },
        };
      }
      if (o.balanceCents === 0) {
        return {
          text: "No late payment. Your balance is zero and nothing is outstanding.",
          action: { label: "See your statement", href: "/resident/account" },
        };
      }
      return {
        text: `No late payment. You have ${money(o.balanceCents)} due${
          o.nextChargeDate ? ` ${formatDate(o.nextChargeDate, "long")}, ${relativeDays(o.nextChargeDate)}` : ""
        }.`,
        facts: [
          { label: "Balance", value: money(o.balanceCents) },
          ...(o.nextChargeDate ? [{ label: "Due", value: formatDate(o.nextChargeDate, "long") }] : []),
          { label: "Autopay", value: o.autopay ? "On" : "Off" },
        ],
        action: { label: "Pay dues", href: "/resident/pay" },
      };
    },
  },
  {
    id: "last-payment",
    keywords: ["last", "history", "receipt", "paid", "statement", "cleared"],
    phrases: ["last payment", "did my payment", "payment history", "when did i pay"],
    answer: (c) => {
      const p = c.owner.lastPayment;
      if (!p) return { text: "No payments on file yet." };
      return {
        text: `Your last payment was ${money(p.amountCents)} on ${formatDate(p.date, "long")}${
          p.method ? ` from ${p.method}` : ""
        }.${p.appliedTo.length ? ` It cleared ${p.appliedTo.join(" and ")}.` : ""}`,
        action: { label: "See your statement", href: "/resident/account" },
      };
    },
  },
  {
    id: "autopay",
    keywords: ["autopay", "automatic", "recurring", "auto"],
    phrases: ["turn on autopay", "set up autopay"],
    answer: (c) => ({
      text: c.owner.autopay
        ? `Autopay is on. Your dues of ${money(c.association.duesCents)} are paid for you when they come due.`
        : `Autopay is off. Turn it on and your dues of ${money(c.association.duesCents)} are paid for you when they come due.`,
      action: { label: "Autopay settings", href: "/resident/pay#autopay" },
    }),
  },
  {
    id: "meetings",
    keywords: ["meeting", "meet", "agenda", "board", "workshop", "annual", "calendar", "event"],
    phrases: ["next meeting", "meetings coming up", "upcoming meeting", "when is the meeting"],
    answer: (c) => {
      if (c.liveMeeting) {
        return {
          text: `${c.liveMeeting.title} is happening right now with ${c.liveMeeting.attendees} people on the call.`,
          action: { label: "Join the call", href: "/resident/calendar" },
        };
      }
      const next = c.meetings.slice(0, 3);
      if (!next.length) return { text: "Nothing scheduled right now." };
      return {
        text: `${next.length === 1 ? "One meeting" : `${next.length} meetings`} coming up.`,
        facts: next.map((m) => ({
          label: m.title,
          value: `${formatDate(m.date, "long")}, ${m.time}`,
        })),
        action: { label: "See meetings", href: "/resident/calendar" },
      };
    },
  },
  {
    id: "vote",
    keywords: ["vote", "ballot", "voting", "election", "amendment", "poll"],
    phrases: ["can i vote", "do i need to vote", "open ballots"],
    answer: (c) => {
      const unvoted = c.ballots.filter((b) => !b.voted);
      if (!c.ballots.length) return { text: "No ballots are open right now." };
      if (!unvoted.length) {
        return {
          text: "You have voted on everything that is open.",
          action: { label: "See results", href: "/resident/vote" },
        };
      }
      return {
        text: `${unvoted.length === 1 ? "One ballot needs" : `${unvoted.length} ballots need`} your vote.`,
        facts: unvoted.map((b) => ({
          label: b.title,
          value: `closes ${relativeDays(b.closesDate)}`,
        })),
        action: { label: "Vote now", href: "/resident/vote" },
      };
    },
  },
  {
    id: "new-request",
    keywords: ["request", "submit", "write", "help", "repair", "broken", "approval", "fence", "solar"],
    phrases: [
      "help me write a request",
      "new request",
      "submit a request",
      "how do i request",
      "file a request",
    ],
    answer: () => ({
      text: "Pick the type and the form walks you through it. Maintenance for anything broken in a common area, Home changes for a change to your home's outside, Records to see association records, Booking to reserve the clubhouse. The form tells you how soon the board will answer.",
      action: { label: "Start a request", href: "/resident/requests/new" },
    }),
  },
  {
    id: "my-requests",
    keywords: ["status", "my", "open", "pending", "waiting", "approved"],
    phrases: ["my requests", "status of my request", "request status"],
    answer: (c) => {
      const open = c.requests.filter(
        (r) => !["approved", "denied", "closed"].includes(r.status),
      );
      if (!c.requests.length) {
        return {
          text: "You have not submitted any requests yet.",
          action: { label: "Start one", href: "/resident/requests/new" },
        };
      }
      return {
        text: open.length
          ? `${open.length === 1 ? "One request is" : `${open.length} requests are`} still open.`
          : "All of your requests have been decided.",
        facts: c.requests.slice(0, 4).map((r) => ({
          label: r.title,
          value: r.status.replace("-", " "),
        })),
        action: { label: "All requests", href: "/resident/requests" },
      };
    },
  },
  {
    id: "funds",
    keywords: ["funds", "money", "reserve", "reserves", "cash", "interest", "savings", "account", "hoa"],
    phrases: [
      "how much money",
      "how much is in",
      "association funds",
      "how much does the hoa have",
      "reserve balance",
    ],
    answer: (c) => {
      if (!c.fundsVisible) {
        return {
          text: "The board has not published association balances. You can ask them to turn that on, or request the records directly.",
          action: { label: "Start a records request", href: "/resident/requests/new" },
        };
      }
      return {
      text: `The association holds ${money(c.association.operatingCents, { cents: false })} in operating and ${money(
        c.association.reserveCents,
        { cents: false },
      )} in reserves, earning ${c.association.blendedApy.toFixed(2)}%.`,
      facts: [
        { label: "Operating", value: money(c.association.operatingCents, { cents: false }) },
        { label: "Reserves", value: money(c.association.reserveCents, { cents: false }) },
        { label: "Interest this year", value: money(c.association.interestYtdCents, { cents: false }) },
        {
          label: "Reserves funded",
          value: `${Math.round(c.association.reservePercentFunded * 100)}%`,
        },
      ],
      action: { label: "See association funds", href: "/resident/finances" },
      };
    },
  },
  {
    id: "dues",
    keywords: ["dues", "assessment", "cost", "much", "monthly", "fee", "fees", "charge"],
    phrases: ["how much are dues", "what are my dues", "monthly dues"],
    answer: (c) => {
      return {
        text: `Dues are ${money(c.association.duesCents)} a month, and you pay exactly that on any method. A bank transfer costs the association the least to accept.`,
        action: { label: "Pay dues", href: "/resident/pay" },
      };
    },
  },
  {
    id: "documents",
    keywords: ["document", "documents", "ccr", "ccrs", "bylaws", "budget", "minutes", "rules", "study"],
    phrases: ["where are the documents", "find the ccrs", "meeting minutes"],
    answer: (c) => ({
      text: `${c.documentCount} documents are available to you, including the CC&Rs, bylaws, rules, the adopted budget, the reserve study, and meeting minutes.`,
      action: { label: "See documents", href: "/resident/documents" },
    }),
  },
  {
    id: "amenities",
    keywords: ["pool", "clubhouse", "tennis", "gym", "fitness", "amenity", "amenities", "open"],
    phrases: ["is the pool open", "book the clubhouse"],
    answer: (c) => ({
      text: "Here is where the amenities stand right now.",
      facts: c.amenities.map((a) => ({ label: a.name, value: a.detail })),
    }),
  },
  {
    id: "support",
    keywords: ["call", "phone", "contact", "support", "person", "someone", "reach"],
    phrases: ["talk to someone", "who do i call", "contact the board"],
    answer: () => ({
      // There is no phone line, and inventing one meant an owner would have
      // dialled it. Their board is the honest answer to almost everything an
      // owner asks here, and a request creates a record and a deadline that
      // email does not.
      text: `Your board handles this. Opening a request puts it on the record with a deadline, and you can see where it stands, which an email to somebody's inbox cannot do.`,
      action: { label: "Start a request", href: "/resident/requests/new" },
    }),
  },
];

const STOP = new Set([
  "a", "an", "the", "is", "are", "do", "does", "did", "i", "my", "me", "we", "our",
  "have", "has", "any", "there", "what", "when", "how", "of", "to", "in", "on", "for",
  "and", "or", "it", "this", "that", "can", "you", "please", "hoa",
]);

export function answerQuestion(question: string, context: AssistantScope): Answer {
  const q = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ");

  // An exact phrase beats keyword scoring. "late payment" should never be
  // scored against a generic "payment" hit somewhere else.
  for (const intent of intents) {
    if (intent.phrases?.some((p) => q.includes(p))) return intent.answer(context);
  }

  const words = q.split(/\s+/).filter((w) => w && !STOP.has(w));
  let best: { intent: Intent; score: number } | null = null;
  for (const intent of intents) {
    let score = 0;
    for (const w of words) {
      if (intent.keywords.includes(w)) score += 2;
      else if (intent.keywords.some((k) => k.startsWith(w) && w.length > 3)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }

  if (best) return best.intent.answer(context);

  return {
    text: "I could not match that one. I can answer questions about your balance and payments, autopay, meetings, ballots, your requests, association funds, dues, documents, and amenities.",
  };
}

export const suggestedQuestions = [
  "Do I have a late payment?",
  "Are there any meetings coming up?",
  "Help me write a request",
  "How much money does the HOA have?",
  "Do I need to vote on anything?",
];
