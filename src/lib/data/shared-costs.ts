import type { SharedCost, SharedCostBill, SpecialAssessment } from "@/lib/types";

/**
 * What Mehr Meadows pays on everyone's behalf, and what it costs.
 *
 * The association is on a single master water meter and one commercial waste
 * contract, which is ordinary for a development of this age and the reason
 * owners cannot look any of it up themselves. Two years of bills are seeded so
 * the trend is real: water rises every summer and has climbed each year, which
 * is the shape of every municipal water bill in the country.
 *
 * A community that bills nothing but dues has none of this, and never sees the
 * screens that read it.
 */

export const sharedCosts: SharedCost[] = [
  {
    id: "sc-water",
    name: "Water and sewer",
    kind: "water",
    provider: "Cascade Water District",
    accountRef: "CWD-88-4471",
    // 88 single family homes on one meter. Occupancy is the fairest basis the
    // association has without cutting into the mains to fit submeters.
    allocation: "occupants",
    markupPercent: 0,
    active: true,
    usageUnit: "hundred cubic feet",
  },
  {
    id: "sc-trash",
    name: "Trash and recycling",
    kind: "trash",
    provider: "Republic Services",
    accountRef: "RS-3-118820",
    // One cart per home, so an equal split is the accurate one.
    allocation: "equal",
    markupPercent: 0,
    active: true,
    usageUnit: "",
  },
  {
    id: "sc-lights",
    name: "Street and common area lighting",
    kind: "electric",
    provider: "Puget Sound Energy",
    accountRef: "PSE-77-2210",
    allocation: "equal",
    markupPercent: 0,
    active: true,
    usageUnit: "kWh",
  },
];

const HOMES = 88;

/** First of the month, counting back from the seeded present. */
function monthStart(monthsBack: number): string {
  const d = new Date(Date.UTC(2026, 7, 1));
  d.setUTCMonth(d.getUTCMonth() - monthsBack);
  return d.toISOString().slice(0, 10);
}

/**
 * Twenty-four months of bills.
 *
 * Water is seasonal and rising; trash is flat with one contract increase;
 * lighting is the inverse of water because the lights run longest in winter.
 * Written as a shape rather than a table so the trend is honest rather than
 * hand tuned to look good.
 */
function buildBills(): SharedCostBill[] {
  const bills: SharedCostBill[] = [];
  for (let back = 23; back >= 0; back--) {
    const start = monthStart(back);
    const end = monthStart(back - 1);
    const month = Number(start.slice(5, 7));
    const yearsAgo = Math.floor(back / 12);
    // Peaks in July, troughs in January.
    const summer = 1 + 0.32 * Math.sin(((month - 4) / 12) * 2 * Math.PI);

    const water = Math.round(486_00 * summer * Math.pow(1.06, 1 - yearsAgo));
    bills.push({
      id: `bill-water-${start}`,
      sharedCostId: "sc-water",
      periodStart: start,
      periodEnd: end,
      dueOn: end,
      totalCents: water,
      usageAmount: Math.round(water / 512),
      homes: HOMES,
      averageShareCents: Math.round(water / HOMES),
    });

    const trash = back >= 12 ? 742_00 : 791_00;
    bills.push({
      id: `bill-trash-${start}`,
      sharedCostId: "sc-trash",
      periodStart: start,
      periodEnd: end,
      dueOn: end,
      totalCents: trash,
      homes: HOMES,
      averageShareCents: Math.round(trash / HOMES),
    });

    const lights = Math.round(198_00 * (2 - summer));
    bills.push({
      id: `bill-lights-${start}`,
      sharedCostId: "sc-lights",
      periodStart: start,
      periodEnd: end,
      dueOn: end,
      totalCents: lights,
      usageAmount: Math.round(lights / 11),
      homes: HOMES,
      averageShareCents: Math.round(lights / HOMES),
    });
  }
  return bills;
}

export const sharedCostBills: SharedCostBill[] = buildBills();

/**
 * The roof assessment, halfway through.
 *
 * Approved by ballot, split by floor area, paid over twenty-four months. It is
 * seeded mid-flight because a finished one teaches nothing and a brand new one
 * has no progress to show.
 */
export const specialAssessments: SpecialAssessment[] = [
  {
    id: "sa-roofs",
    title: "Roof replacement, buildings A through D",
    reason:
      "The 2025 reserve study found the original roofs at the end of their service life. Reserves covered 61% of the quote and the balance is being levied over two years.",
    totalCents: 412_000_00,
    allocation: "square_feet",
    installments: 24,
    firstDueOn: "2025-11-01",
    ballotId: "bal-roof-assessment",
    collectedCents: 168_920_00,
    status: "active",
  },
];
