import { isEmail } from "@/lib/input-checks";
import type { Cents } from "@/lib/types";

/**
 * A roster from a spreadsheet.
 *
 * Every board has one: the list a treasurer keeps of who owns what, with an
 * email column that is half filled in and a balance column nobody trusts.
 * This reads that file as it is, names the problems row by row, and hands
 * back rows the product can seat. Nothing here touches the database; the
 * wizard adds the rows to its draft and the Homeowners screen sends them to
 * `import_households`.
 *
 * Deliberately forgiving on the way in and strict on what it reports. A
 * header that says "Owner" or "Homeowner name" is a name; "Lot", "Unit #"
 * and "Home" are all the register key; "$1,240.50" and "(120.00)" are both
 * money. What it will not do is guess: a row with no home and no address is
 * a problem, not a home, and two rows for one home are two bills.
 */

export interface RosterRow {
  /** 1-based line in the file, for the preview and the error message. */
  line: number;
  name: string;
  email: string;
  /** The register key: the number or lot, or the address when there is none. */
  unit: string;
  address: string;
  phone: string;
  /** Present only when the file has a balance column and the cell says something. */
  openingBalanceCents?: Cents;
  /**
   * This home's own regular assessment, when the file has a dues column and
   * the cell has an amount. A blank cell leaves the home on the usual rate.
   */
  duesCents?: Cents;
  /** What is wrong with this row, in words. Empty means it can be imported. */
  problems: string[];
}

export interface RosterParse {
  rows: RosterRow[];
  /** The columns the file was read as, by our names. */
  columns: Partial<Record<RosterColumn, string>>;
  /** Problems with the file as a whole rather than one row. */
  problems: string[];
}

export type RosterColumn = "name" | "email" | "unit" | "address" | "phone" | "balance" | "dues";

/** What each column may be called in the file, lower case, punctuation stripped. */
const HEADERS: Record<RosterColumn, string[]> = {
  name: ["name", "owner", "owners", "ownername", "homeowner", "homeownername", "household", "resident", "fullname", "member"],
  email: ["email", "emailaddress", "emails", "owneremail", "e-mail", "mail"],
  unit: ["unit", "unitnumber", "unitno", "unit#", "lot", "lotnumber", "lotno", "lot#", "home", "homenumber", "number", "no", "#", "apt", "apartment", "space", "site"],
  address: ["address", "streetaddress", "street", "propertyaddress", "homeaddress", "situs", "situsaddress", "location"],
  phone: ["phone", "phonenumber", "telephone", "mobile", "cell", "tel"],
  dues: ["dues", "assessment", "monthlydues", "regulardues", "regularassessment", "monthlyassessment", "duesamount", "assessmentamount"],
  balance: ["openingbalance", "balance", "balancedue", "owed", "amountowed", "amountdue", "due", "outstanding", "arrears", "balanceforward", "balancebroughtforward", "startingbalance"],
};

/** The file a board downloads to fill in. */
export const ROSTER_TEMPLATE_COLUMNS = ["Name", "Email", "Unit", "Address", "Phone", "Opening balance", "Dues"] as const;

export function rosterTemplateCsv(): string {
  const lines = [
    ROSTER_TEMPLATE_COLUMNS.join(","),
    'Pat Alvarez,pat@example.com,12,"1428 Willow Creek Lane",425-555-0114,0,',
    'Marcus Bell,marcus@example.com,14,"1432 Willow Creek Lane",,185.00,285.00',
    ',,16,"1436 Willow Creek Lane",,,',
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/* -------------------------------------------------------------------------- */
/* Reading the file                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Splits CSV text into cells. Quoted fields may hold commas, newlines and
 * doubled quotes; a tab separated export is read the same way. Blank lines
 * are dropped.
 */
export function splitCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  if (tabs > commas && tabs > semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_./()'"-]+/g, "");
}

/** Which of our columns a header is, if any. */
export function columnFor(header: string): RosterColumn | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  for (const [column, names] of Object.entries(HEADERS) as [RosterColumn, string[]][]) {
    if (names.includes(key)) return column;
  }
  // "Opening balance ($)" and friends.
  if (/balance|owed|arrears/.test(key)) return "balance";
  if (/dues|assessment/.test(key)) return "dues";
  if (/email/.test(key)) return "email";
  if (/phone|mobile|cell/.test(key)) return "phone";
  if (/address|street/.test(key)) return "address";
  if (/^(unit|lot|home)/.test(key)) return "unit";
  if (/name|owner/.test(key)) return "name";
  return null;
}

/** Reads a typed amount into cents. "$1,240.50", "(120.00)" and "-120" all work; "" is nothing. */
export function moneyToCents(input: string): Cents | null | undefined {
  const raw = input.trim();
  if (raw === "") return undefined;
  let text = raw.replace(/[$,\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  }
  if (!/^\d*\.?\d{0,2}$/.test(text) || text === "" || text === ".") return null;
  const value = Math.round(Number.parseFloat(text) * 100);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/**
 * The file, read into rows the product can seat.
 *
 * Rows are checked against each other only; `rosterSummary` compares them
 * with the register so the preview can say "already on the roster, will be
 * updated" instead of "duplicate".
 */
export function parseRosterCsv(text: string): RosterParse {
  const table = splitCsv(text);
  if (table.length === 0) {
    return { rows: [], columns: {}, problems: ["The file is empty."] };
  }

  const [header, ...body] = table;
  const columns: Partial<Record<RosterColumn, string>> = {};
  const index: Partial<Record<RosterColumn, number>> = {};
  header.forEach((cell, i) => {
    const column = columnFor(cell);
    if (column && index[column] === undefined) {
      index[column] = i;
      columns[column] = cell.trim();
    }
  });

  const problems: string[] = [];
  if (index.unit === undefined && index.address === undefined) {
    problems.push(
      'No column names a home. Add a "Unit" or "Lot" column, or an "Address" column, in the first row.',
    );
    return { rows: [], columns, problems };
  }
  if (index.name === undefined) {
    problems.push('No "Name" column, so every home comes in without an owner. Owners can be added later.');
  }
  if (index.email === undefined) {
    problems.push('No "Email" column, so nobody can be invited from this file.');
  }

  const cellAt = (row: string[], column: RosterColumn) => {
    const i = index[column];
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  const seen = new Map<string, number>();
  const rows: RosterRow[] = body.map((cells, i) => {
    const line = i + 2;
    const address = cellAt(cells, "address");
    const unit = cellAt(cells, "unit") || address;
    const email = cellAt(cells, "email").toLowerCase();
    const rawBalance = cellAt(cells, "balance");
    const balance = index.balance === undefined ? undefined : moneyToCents(rawBalance);
    const rawDues = cellAt(cells, "dues");
    const dues = index.dues === undefined ? undefined : moneyToCents(rawDues);
    const row: RosterRow = {
      line,
      name: cellAt(cells, "name"),
      email,
      unit,
      address,
      phone: cellAt(cells, "phone"),
      problems: [],
    };
    if (balance !== undefined && balance !== null) row.openingBalanceCents = balance;
    // Zero reads as no amount, as it does everywhere a home's dues are read.
    if (dues !== undefined && dues !== null && dues > 0) row.duesCents = dues;

    if (!unit) {
      row.problems.push("No unit, lot or address, so there is no home to add.");
    } else {
      const key = unit.toLowerCase();
      const first = seen.get(key);
      if (first !== undefined) {
        row.problems.push(`Same home as line ${first}. One home is one bill; keep one row.`);
      } else {
        seen.set(key, line);
      }
    }
    if (email && !isEmail(email)) {
      row.problems.push(`"${email}" does not look like an email address.`);
    }
    if (balance === null) {
      row.problems.push(`"${rawBalance}" is not an amount. Use 185.00, $185, or (20.00) for a credit.`);
    }
    if (dues === null || (dues !== undefined && dues < 0)) {
      row.problems.push(`"${rawDues}" is not a dues amount. Use 285.00 or $285.`);
    }
    return row;
  });

  return {
    rows,
    columns,
    problems,
  };
}

/** Rows that can go in, and what will happen to each. */
export function rosterSummary(rows: RosterRow[], existingUnits: string[] = []) {
  const existing = new Set(existingUnits.map((u) => u.trim().toLowerCase()));
  const ok = rows.filter((r) => r.problems.length === 0);
  const creating = ok.filter((r) => !existing.has(r.unit.toLowerCase()));
  const updating = ok.filter((r) => existing.has(r.unit.toLowerCase()));
  const withEmail = ok.filter((r) => r.email);
  const withBalance = ok.filter((r) => (r.openingBalanceCents ?? 0) !== 0);
  const withDues = ok.filter((r) => (r.duesCents ?? 0) > 0);
  const owedCents = withBalance.reduce((t, r) => t + (r.openingBalanceCents ?? 0), 0);
  return {
    ok,
    creating,
    updating,
    withEmail,
    withBalance,
    withDues,
    owedCents,
    problems: rows.filter((r) => r.problems.length > 0),
  };
}
