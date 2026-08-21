"use client";

import { Badge, Card, CardHeader, Meter, PageHeader } from "@/components/ui/primitives";

/**
 * The key.
 *
 * Colour carries meaning all over this product, and colour that is never
 * explained is just decoration a board has to guess at. Everything that means
 * something is written down here once, so a new treasurer in January can look
 * it up instead of inferring it.
 */

interface Entry {
  sample: React.ReactNode;
  name: string;
  meaning: string;
}

const TONES: Entry[] = [
  {
    sample: <Badge tone="ok">Cleared</Badge>,
    name: "Green",
    meaning: "Settled and counted. Nothing is owed and nothing is pending.",
  },
  {
    sample: <Badge tone="warn">Needs review</Badge>,
    name: "Amber",
    meaning:
      "A person has to decide. Amber never means broken; it means the software will not guess on your behalf.",
  },
  {
    sample: <Badge tone="danger">Overdue</Badge>,
    name: "Red",
    meaning: "A deadline has passed or money is at risk. Red is reserved for things with a consequence.",
  },
  {
    sample: <Badge tone="info">In review</Badge>,
    name: "Blue",
    meaning: "In motion, on schedule, nothing required from you yet.",
  },
  {
    sample: <Badge tone="brand">President</Badge>,
    name: "Navy",
    meaning: "Identity and role. Who someone is, not how something is going.",
  },
  {
    sample: <Badge tone="neutral">Pending</Badge>,
    name: "Grey",
    meaning: "Recorded but inert. Waiting on time rather than on a person.",
  },
];

const LEDGER: Entry[] = [
  {
    sample: <Badge tone="ok">cleared</Badge>,
    name: "Cleared",
    meaning: "Matched to a bank feed line. Counts toward every report on the site.",
  },
  {
    sample: <Badge tone="neutral">pending</Badge>,
    name: "Pending",
    meaning: "Booked by the board but not yet seen on the bank feed.",
  },
  {
    sample: <Badge tone="warn">review</Badge>,
    name: "Needs review",
    meaning:
      "Held out of every report until a human confirms it. This is why the dashboard can say the books tie out and mean it.",
  },
  {
    sample: <Badge tone="danger">Duplicate?</Badge>,
    name: "Possible duplicate",
    meaning: "The same counterparty and amount within a few days. Confirm one and remove the other.",
  },
];

const STANDING: Entry[] = [
  { sample: <Badge tone="ok">Current</Badge>, name: "Current", meaning: "Nothing outstanding." },
  {
    sample: <Badge tone="warn">In grace</Badge>,
    name: "In grace",
    meaning: "Past the due date but inside the window before a late fee applies.",
  },
  {
    sample: <Badge tone="warn">Late</Badge>,
    name: "Late",
    meaning: "Past the grace window. Late fees have started and reminders are going out.",
  },
  {
    sample: <Badge tone="danger">Collections</Badge>,
    name: "Collections",
    meaning: "Referred to counsel. Do not contact the owner about the balance directly.",
  },
];

const REQUESTS: Entry[] = [
  {
    sample: <Badge tone="neutral">submitted</Badge>,
    name: "Submitted",
    meaning: "Received, not yet picked up by anyone.",
  },
  {
    sample: <Badge tone="info">in review</Badge>,
    name: "In review",
    meaning: "A board member has it and the clock is running.",
  },
  {
    sample: <Badge tone="warn">info needed</Badge>,
    name: "Info needed",
    meaning: "Waiting on the owner. The statutory clock does not stop for this.",
  },
  {
    sample: <Badge tone="ok">approved</Badge>,
    name: "Approved",
    meaning: "Decided. Produces a certificate the owner can show a contractor or the county.",
  },
  {
    sample: <Badge tone="danger">denied</Badge>,
    name: "Denied",
    meaning: "Decided against, with the reason on the thread. Still a permanent record.",
  },
];

const SHORTHAND: Entry[] = [
  {
    sample: <span className="tnum text-[13px] font-medium text-fg">••4471</span>,
    name: "Two dots and four digits",
    meaning: "The last four of an account or card. The full number is never stored anywhere.",
  },
  {
    sample: <span className="tnum text-[13px] font-medium text-fg">$563k</span>,
    name: "Abbreviated money",
    meaning: "Rounded for a summary tile. The exact figure is always on the detail screen.",
  },
  {
    sample: <span className="tnum text-[13px] font-medium text-fg">2.01% APY</span>,
    name: "APY",
    meaning: "Annual percentage yield. Blended figures are weighted by balance, not averaged.",
  },
  {
    sample: <span className="text-[13px] font-medium text-fg">YTD</span>,
    name: "Year to date",
    meaning: "From the start of the fiscal year, which begins January 1 for this association.",
  },
  {
    sample: <span className="text-[13px] font-medium text-fg">COI</span>,
    name: "Certificate of insurance",
    meaning: "Proof a vendor carries liability cover. Amber inside 60 days of expiry.",
  },
  {
    sample: <span className="text-[13px] font-medium text-fg">W-9</span>,
    name: "IRS Form W-9",
    meaning: "A vendor's tax details. Without one the January 1099 filing will be wrong.",
  },
  {
    sample: <span className="text-[13px] font-medium text-fg">ACH</span>,
    name: "ACH",
    meaning: "Bank to bank transfer. Slower than a card to settle, far cheaper to accept.",
  },
  {
    sample: <span className="text-[13px] font-medium text-fg">Quorum</span>,
    name: "Quorum",
    meaning: "The minimum votes needed for a result to count. Shown even while tallies are sealed.",
  },
];

const MARKS: Entry[] = [
  {
    sample: (
      <div className="relative w-24">
        <Meter value={0.64} />
        <span className="absolute -top-0.5 h-2.5 w-px bg-fg-subtle" style={{ left: "64%" }} />
      </div>
    ),
    name: "Tick on a budget bar",
    meaning: "Today's point in the fiscal year. A bar past the tick is running hot.",
  },
  {
    sample: <Meter value={0.41} tone="warn" className="w-24" />,
    name: "Amber meter",
    meaning: "Behind where it should be. On reserves this is the percent funded against the study.",
  },
  {
    sample: <span className="size-2 rounded-full bg-danger" />,
    name: "Red dot",
    meaning: "Unread or unseen. On the calendar, coloured dots mark what falls on that day.",
  },
  {
    sample: <Badge tone="ok" dot>Live</Badge>,
    name: "Pulsing green",
    meaning: "Happening right now, such as a meeting in progress or a bank feed that is current.",
  },
];

const SECTIONS: { title: string; subtitle: string; entries: Entry[] }[] = [
  { title: "Colour", subtitle: "What each tone means, everywhere it appears", entries: TONES },
  { title: "Ledger status", subtitle: "How a transaction is counted", entries: LEDGER },
  { title: "Owner standing", subtitle: "How far behind an account is", entries: STANDING },
  { title: "Request status", subtitle: "Where a request sits", entries: REQUESTS },
  { title: "Shorthand", subtitle: "Abbreviations used across the product", entries: SHORTHAND },
  { title: "Marks", subtitle: "Things that are drawn rather than written", entries: MARKS },
];

export function Legend() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Legend"
        description="Every colour, badge, and abbreviation this product uses, and what it means."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader title={section.title} subtitle={section.subtitle} />
            {section.entries.map((entry, index) => (
              <div
                key={entry.name}
                className={`flex items-start gap-4 px-5 py-3 ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="flex w-28 shrink-0 items-center">{entry.sample}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">{entry.name}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">
                    {entry.meaning}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        ))}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-fg-subtle">
        One rule holds everywhere: amber asks for a decision, red reports a consequence. If a
        screen ever uses red for something you cannot act on, that is a bug.
      </p>
    </>
  );
}
