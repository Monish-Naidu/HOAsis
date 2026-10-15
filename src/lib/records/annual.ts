/**
 * The Annual records screen's selectors: which years exist, and the files a
 * chosen year holds.
 *
 * A records request or an audit asks for one year of everything: the
 * statements, the bank lines, the payments that left with signatures on them,
 * the votes, the minutes, the requests, what was emailed and who did what.
 * Each file's totals are read by the same selectors the matching screens use
 * (Statements' billed and paid, Transactions' money in and out), so the
 * export and the product cannot disagree about a figure. The integration
 * test pins that.
 */

import type { Community } from "@/lib/data/community";
import { statementPeriod, statementYearOf } from "@/lib/statement";
import type { RecordsFile } from "./files";
import { coreRecordsFiles } from "./areas";
import type { YearRecords } from "./rows";

/**
 * Every fiscal year the association's records touch, newest first.
 *
 * The years come from the records themselves, so a five-year association is
 * offered five and a first-year association is offered the one it is in. A
 * real association's older years are summed by the server (`history`), so
 * those months count too; an association with nothing yet still gets the
 * year of its own today, because a picker with no option is a dead screen.
 */
export function annualYears(c: Community): number[] {
  const fy = c.association.fiscalYearStart;
  const years = new Set<number>();
  const take = (day: string) => years.add(statementYearOf(fy, day));

  for (const lines of Object.values(c.homeCharges)) {
    for (const line of lines) take(line.date);
  }
  for (const entry of c.ledger) take(entry.date);
  for (const payout of c.payouts) take(payout.issuedDate);
  for (const ballot of c.ballots) take(ballot.closesDate);
  for (const meeting of c.meetings) take(meeting.date);
  for (const request of c.requests) take(request.submittedDate);
  for (const email of c.emailLog) take(email.sentAt);
  for (const action of c.activity ?? []) take(action.at);
  // What the server summed because the app no longer loads those rows.
  for (const month of c.history?.statementMonths ?? []) take(`${month.month}-01`);
  for (const month of c.history?.ledgerMonths ?? []) take(`${month.month}-01`);

  if (years.size === 0) years.add(statementYearOf(fy, c.asOf));
  return [...years].sort((a, b) => b - a);
}

/**
 * The one-year export. The rows are the chosen window's, read from the
 * fixtures in the demo and paged from the database signed in. The areas a
 * seat cannot read still appear, so the screen can say so rather than
 * offering a file that row level security would fill with nothing.
 */
export function annualRecordsFiles(c: Community, year: number, rows: YearRecords): RecordsFile[] {
  return coreRecordsFiles(c, rows, statementPeriod(c.association.fiscalYearStart, year));
}
