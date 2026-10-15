/**
 * The nine areas every records export shares: the one-year screen and the
 * complete zip list the same money, vote, meeting, request, correspondence
 * and audit areas, so both are built here once.
 *
 * Rows that come from the bundle (payouts, ballots, meetings, requests) are
 * filtered to the window when there is one; rows that come from the export's
 * own reads (statements, ledger, email, activity) arrive already scoped by
 * the caller, because a signed-in read pages exactly what was asked for.
 */

import type { Community } from "@/lib/data/community";
import { isPaymentReversal, statementTotals } from "@/lib/statement";
import { ledgerTotals } from "@/lib/metrics";
import { homeLabel } from "@/lib/wording";
import type { RecordsFile, RecordsRow } from "./files";
import { columnsOf, dollars, homeName } from "./files";
import type { RecordsWindow, YearRecords } from "./rows";
import { inWindow } from "./rows";

/** One side of the statement: the lines that were billed, or the lines that came off. */
function statementFile(
  c: Community,
  rows: YearRecords,
  side: "charges" | "payments",
): RecordsRow[] {
  const charges = side === "charges";
  return rows.statement
    .filter((line) => (charges ? line.kind === "charge" : line.kind !== "charge"))
    .map((line) => ({
      Date: line.date,
      Home: homeName(c, rows.labels, line.homeId),
      Label: line.label,
      // A line that takes back a payment is a charge by kind, so the type is
      // what tells an auditor which side of the statement it moved.
      Type:
        line.kind === "charge"
          ? isPaymentReversal(line)
            ? "Reversed payment"
            : "Charge"
          : line.kind === "credit"
            ? "Credit"
            : "Payment",
      Category: line.category ?? "",
      Amount: dollars(line.amountCents),
    }));
}

const STATEMENT_COLUMNS = columnsOf("Date", "Home", "Label", "Type", "Category", "Amount");

/**
 * The shared areas, in the order the Annual records screen lists them. The
 * capability on each file is what a seat needs to read it, so a screen can
 * say "your seat cannot read this" rather than offering a file row level
 * security would fill with nothing.
 */
export function coreRecordsFiles(
  c: Community,
  rows: YearRecords,
  window?: RecordsWindow,
): RecordsFile[] {
  const inYear = (day: string) => (window ? inWindow(day, window) : true);
  const totals = statementTotals(rows.statement);
  const accountName = (id: string) => {
    const account = c.bankAccounts.find((a) => a.id === id);
    return account ? `${account.name} ••${account.mask}` : "Other";
  };

  const chargeRows = statementFile(c, rows, "charges");
  const paymentRows = statementFile(c, rows, "payments");

  const ledgerRows = rows.ledger.map((entry) => ({
    Date: entry.date,
    Description: entry.description,
    Who: entry.counterparty,
    Category: entry.category,
    Account: accountName(entry.accountId),
    Amount: dollars(entry.amountCents),
    Status: entry.status,
  }));
  const flows = ledgerTotals(rows.ledger);

  const payoutsInWindow = c.payouts.filter((p) => inYear(p.issuedDate));
  const payoutRows = payoutsInWindow.map((p) => ({
    Issued: p.issuedDate,
    Vendor: p.vendor,
    Invoice: p.invoiceNumber,
    Amount: dollars(p.amountCents),
    Method: p.method,
    Status: p.status,
    Approvals: p.approvals.map((a) => `${a.name} ${a.at}`).join("; "),
    Expected: p.expectedDate,
    Notes: p.notes ?? "",
  }));

  const ballotRows = c.ballots
    .filter((b) => inYear(b.closesDate))
    .map((b) => ({
      Reference: b.reference,
      Title: b.title,
      Kind: b.kind,
      Status: b.status,
      Opens: b.opensDate,
      Closes: b.closesDate,
      "Homes voted": String(b.homesVoted ?? b.options.reduce((t, o) => t + o.votes, 0)),
      Quorum: String(b.quorumRequired),
      Result: b.options.map((o) => `${o.label}: ${o.votes}`).join("; "),
    }));

  const meetingRows = c.meetings
    .filter((m) => inYear(m.date))
    .map((m) => ({
      Date: m.date,
      Title: m.title,
      Kind: m.kind,
      Status: m.status,
      Time: m.time,
      Location: m.location,
      Attended: String((m.attended ?? m.attendees)?.length ?? 0),
      "Minutes on": m.minutesDate ?? "",
      Minutes: m.minutes ?? "",
    }));

  const requestRows = c.requests
    .filter((request) => inYear(request.submittedDate))
    .map((request) => ({
      Reference: request.reference,
      Kind: request.kind,
      Title: request.title,
      Home: request.unit ? homeLabel(c, request.unit) : "",
      Status: request.status,
      Submitted: request.submittedDate,
      Decided: request.decisionDate ?? "",
      "Decided by": request.decidedBy ?? "",
    }));

  const emailRows = rows.emailLog.map((email) => ({
    Sent: email.sentAt,
    To: email.to,
    Unit: email.unit ?? "",
    Category: email.category,
    Subject: email.subject,
    Status: email.status ?? "",
    Error: email.error ?? "",
  }));

  const activityRows = rows.activity.map((action) => ({
    At: action.at,
    Who: action.actorName,
    What: action.subjectKind,
    Summary: action.summary,
    Details: JSON.stringify(action.details),
  }));

  return [
    {
      id: "charges",
      title: "Charges",
      blurb: "Dues, fees and one-off charges billed to homes.",
      name: "charges.csv",
      capabilities: ["finances"],
      columns: STATEMENT_COLUMNS,
      rows: chargeRows,
      totals: [
        { label: "Billed", moneyCents: totals.billedCents },
        { label: "Lines", count: chargeRows.length },
      ],
    },
    {
      id: "payments",
      title: "Payments",
      blurb: "Payments and credits that came off homes' balances.",
      name: "payments.csv",
      capabilities: ["finances"],
      columns: STATEMENT_COLUMNS,
      rows: paymentRows,
      totals: [
        { label: "Paid", moneyCents: totals.paidCents },
        { label: "Credits", moneyCents: totals.creditedCents },
        { label: "Lines", count: paymentRows.length },
      ],
    },
    {
      id: "ledger",
      title: "Bank lines",
      blurb: "Every line of the books, as Transactions shows them.",
      name: "ledger.csv",
      capabilities: ["finances"],
      columns: columnsOf("Date", "Description", "Who", "Category", "Account", "Amount", "Status"),
      rows: ledgerRows,
      totals: [
        { label: "Money in", moneyCents: flows.inCents },
        { label: "Money out", moneyCents: flows.outCents },
        { label: "Lines", count: ledgerRows.length },
      ],
    },
    {
      id: "vendor-payments",
      title: "Vendor payments",
      blurb: "Payments the board issued, with the signatures that released them.",
      name: "vendor-payments.csv",
      capabilities: ["finances"],
      columns: columnsOf(
        "Issued",
        "Vendor",
        "Invoice",
        "Amount",
        "Method",
        "Status",
        "Approvals",
        "Expected",
        "Notes",
      ),
      rows: payoutRows,
      totals: [
        { label: "Total", moneyCents: payoutsInWindow.reduce((t, p) => t + p.amountCents, 0) },
        { label: "Payments", count: payoutRows.length },
      ],
    },
    {
      id: "ballots",
      title: "Ballots and results",
      blurb: "Every vote, with the count for each option.",
      name: "ballots.csv",
      columns: columnsOf(
        "Reference",
        "Title",
        "Kind",
        "Status",
        "Opens",
        "Closes",
        "Homes voted",
        "Quorum",
        "Result",
      ),
      rows: ballotRows,
      totals: [{ label: "Ballots", count: ballotRows.length }],
    },
    {
      id: "meetings",
      title: "Meetings and minutes",
      blurb: "Meetings held, attendance as recorded, and the minutes.",
      name: "meetings.csv",
      columns: columnsOf(
        "Date",
        "Title",
        "Kind",
        "Status",
        "Time",
        "Location",
        "Attended",
        "Minutes on",
        "Minutes",
      ),
      rows: meetingRows,
      totals: [
        { label: "Meetings", count: meetingRows.length },
        { label: "With minutes", count: meetingRows.filter((m) => m.Minutes).length },
      ],
    },
    {
      id: "requests",
      title: "Requests",
      blurb: "What owners asked the board for, and what was decided.",
      name: "requests.csv",
      capabilities: ["requests"],
      columns: columnsOf(
        "Reference",
        "Kind",
        "Title",
        "Home",
        "Status",
        "Submitted",
        "Decided",
        "Decided by",
      ),
      rows: requestRows,
      totals: [{ label: "Requests", count: requestRows.length }],
    },
    {
      id: "email-log",
      title: "Email log",
      blurb: "Every email the association sent, and what became of it.",
      name: "email-log.csv",
      capabilities: ["communications"],
      columns: columnsOf("Sent", "To", "Unit", "Category", "Subject", "Status", "Error"),
      rows: emailRows,
      totals: [{ label: "Emails", count: emailRows.length }],
    },
    {
      id: "activity",
      title: "Activity",
      blurb: "Every board action, as the database recorded it.",
      name: "activity.csv",
      capabilities: ["settings"],
      columns: columnsOf("At", "Who", "What", "Summary", "Details"),
      rows: activityRows,
      totals: [{ label: "Actions", count: activityRows.length }],
    },
  ];
}
