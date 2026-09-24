/**
 * What is switched on for the first customers.
 *
 * Every part of the product is listed here with one boolean. The board and
 * resident navigations filter through it, and a page whose module is off says
 * so instead of rendering, so nothing is deleted and nothing is reachable by
 * typing the URL either. Turning something back on is one line; turning it on
 * for one association rather than all of them is a settings column later.
 *
 * The rule for the first cut, from the 2026-09-19 launch scope: a screen stays
 * if it answers a month-one question. Year-three and lawyer questions wait.
 */
export type ModuleKey =
  // Board
  | "setup"
  | "money"
  | "money-budget"
  | "money-trends"
  | "shared-costs"
  | "homeowners"
  | "notices"
  | "enforcement-full"
  | "vendors"
  | "requests"
  | "reserves"
  | "compliance"
  | "communications"
  | "forum"
  | "meetings"
  | "voting"
  | "documents"
  | "settings"
  // Pieces of a page, not whole pages
  | "deposit-insurance"
  | "money-compare"
  | "delivery-panel"
  | "vendor-tax-forms"
  | "documents-disclosure"
  | "settings-advanced"
  | "autopay-extras"
  | "request-records"
  // Resident
  | "resident-forum"
  | "resident-funds"
  | "resident-meetings"
  | "resident-report"
  | "phone-preview";

export interface ModuleFlag {
  label: string;
  on: boolean;
  /** Why it waits, for whoever turns it back on. */
  note?: string;
}

export const MODULES: Record<ModuleKey, ModuleFlag> = {
  setup: { label: "Setting up", on: true },
  money: { label: "Finances", on: true },
  "money-budget": {
    label: "Budget",
    on: false,
    note: "Line by line against the share of the year gone. Comes back with the first budget season.",
  },
  "money-trends": {
    label: "Trends",
    on: false,
    note: "One year beside another. Needs a second year of data to mean anything.",
  },
  "shared-costs": {
    label: "Shared costs",
    on: false,
    note: "Utility bills the association pays on everyone's behalf and splits across homes (a master water meter, one trash contract). Only associations on shared meters have any.",
  },
  homeowners: { label: "Homeowners", on: true },
  notices: { label: "Notices", on: true },
  "enforcement-full": {
    label: "Full enforcement queue",
    on: false,
    note: "Neighbour reports, city notices, the stage ladder and reporting patterns. The simple Notices page replaces it until a board asks.",
  },
  vendors: { label: "Vendors", on: true },
  requests: { label: "Requests", on: true },
  reserves: { label: "Reserves", on: true },
  compliance: {
    label: "Compliance",
    on: false,
    note: "State filing calendar and obligation register. Too much for month one; the insurance date is enough until then.",
  },
  communications: { label: "Communications", on: true },
  forum: { label: "Community", on: true },
  meetings: { label: "Meetings", on: true },
  voting: { label: "Voting", on: true },
  documents: { label: "Documents", on: true },
  settings: { label: "Settings", on: true },
  "deposit-insurance": {
    label: "Deposit insurance warning",
    on: false,
    note: "The FDIC limit callout on the dashboard and Finances. A year-three treasurer concern.",
  },
  "money-compare": {
    label: "Year against year",
    on: false,
    note: "This year beside last on Finances, the Compare years link and the spending donut. Needs a second year of data.",
  },
  "delivery-panel": {
    label: "Notice delivery rules",
    on: false,
    note: "How a statutory notice may reach people. Month three.",
  },
  "vendor-tax-forms": {
    label: "Vendor tax paperwork",
    on: false,
    note: "W-9 and 1099 warnings. Comes back before the first January.",
  },
  "documents-disclosure": {
    label: "New owner disclosure",
    on: false,
    note: "What a buyer must be told, by law. Resale season, not month one.",
  },
  "settings-advanced": {
    label: "Advanced settings",
    on: false,
    note: "The per-person capability grid and the board-change counts. Roles cover month one.",
  },
  "autopay-extras": {
    label: "Autopay cap and skip",
    on: false,
    note: "Only-when-my-balance-is-under and skip-a-month. Month two.",
  },
  "request-records": {
    label: "Records requests",
    on: false,
    note: "A statutory request to inspect association records. Not a month-one homeowner action.",
  },
  "resident-forum": { label: "Community", on: true },
  "resident-funds": { label: "Association funds", on: true },
  "resident-meetings": { label: "Meetings", on: true },
  "resident-report": {
    label: "Report a neighbour",
    on: false,
    note: "Rides with the full enforcement queue. Without verification on the board side, a report has nowhere to go.",
  },
  "phone-preview": {
    label: "Phone preview toggle",
    on: false,
    note: "The device frame in the resident top bar. A demo prop, not a customer feature.",
  },
};

/** Absent means the thing is not a module and is always on. */
export function moduleOn(key?: ModuleKey): boolean {
  return key ? MODULES[key].on : true;
}

/** The copy shown in place of a page whose module is off. */
export function moduleOffCopy(key: ModuleKey): { title: string; body: string } {
  return {
    title: `${MODULES[key].label} is not switched on for this association yet`,
    body:
      MODULES[key].note ??
      "It exists and it works. It is waiting until the first associations are settled in.",
  };
}
