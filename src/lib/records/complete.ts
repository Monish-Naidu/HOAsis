/**
 * The complete export: every record the association holds, in one zip.
 *
 * This is the answer to the records request a board gets from an owner, a
 * buyer's lender, a manager taking over or an accountant in April: hand over
 * the association, not a screen at a time. It is the year's areas without a
 * window, plus the register, the people, the governing text, the files, the
 * correspondence and the configuration the money was spent under.
 *
 * The areas the Annual records screen already builds come from `areas.ts`, so
 * a figure in the complete zip and the same figure on a screen come from one
 * selector. Everything here is the record of something the product holds: a
 * row a screen shows, with the same wording it shows it in.
 */

import type { Community } from "@/lib/data/community";
import type { AccountRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import {
  budgetSummary,
  budgetVariance,
  ledgerTotals,
  reserveSummary,
  vendorPaidThisYear,
} from "@/lib/metrics";
import { policyFor } from "@/lib/collections";
import { duesFor, HOME_TYPE_LABEL } from "@/lib/home-types";
import { money } from "@/lib/utils";
import { homeLabel } from "@/lib/wording";
import type { RecordsFile, RecordsRow } from "./files";
import { columnsOf, dollars, homeName } from "./files";
import { coreRecordsFiles } from "./areas";
import type { CompleteRecords } from "./rows";

/** The office or "Resident" for a seat's role, as the roster prints it. */
function roleWord(role: string): string {
  return ROLE_LABEL[role as AccountRole] ?? role;
}

/** "45 minutes" from minutes past midnight, so a booking reads like a clock. */
function clockWord(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Paragraphs, in one cell: a spreadsheet wraps at the newlines. */
function paragraphs(text: string[] | undefined): string {
  return (text ?? []).join("\n\n");
}

/**
 * Every file the complete export holds, in the order the zip lists them: the
 * association first, then the people, then money, then governance, then what
 * was said and done.
 */
export function completeRecordsFiles(c: Community, rows: CompleteRecords): RecordsFile[] {
  const totals = ledgerTotals(rows.ledger);
  const budget = budgetSummary(c);
  const reserve = reserveSummary(c);
  const policy = policyFor(c.settings);
  const unitOf = (homeId: string) => rows.labels.get(homeId) ?? "";
  // Every home as one row: the register's own figures, then the homes the
  // register no longer carries, which a records request still asks about.
  const onRegister = new Set(c.homes.map((h) => h.id));
  const homeRows: RecordsRow[] = [
    ...c.homes.map((h) => ({
      Unit: h.unit,
      Address: h.address,
      Kind: h.homeType ? HOME_TYPE_LABEL[h.homeType].short : "",
      Assessment: dollars(duesFor(c.association, h.homeType, h.duesCents)),
      Seats: String(h.seats?.length ?? h.members.length),
      Standing: h.standing,
      Balance: dollars(h.balanceCents),
      "Moved in": h.moveInDate,
      Status: "On the register",
    })),
    ...rows.homes
      .filter((h) => !onRegister.has(h.id))
      .map((h) => ({
        Unit: h.unit,
        Address: h.address,
        Kind: h.homeType ?? "",
        Assessment: dollars(duesFor(c.association, undefined, h.duesCents)),
        Seats: "",
        Standing: "",
        Balance: "",
        "Moved in": "",
        Status: h.retiredOn ? `Retired ${h.retiredOn}` : "Off the register",
      })),
  ];

  const seatRows: RecordsRow[] = rows.seats.map((seat) => ({
    Home: homeLabel(c, unitOf(seat.homeId)),
    Name: seat.name,
    Email: seat.email,
    Phone: seat.phone ?? "",
    Role: roleWord(seat.role),
    Access: seat.access,
    "Seat opened": seat.startsOn,
    "Seat closed": seat.endsOn ?? "",
  }));

  const attendanceRows: RecordsRow[] = c.meetings.flatMap((meeting) =>
    (meeting.attended ?? []).map((person) => ({
      Date: meeting.date,
      Meeting: meeting.title,
      Name: person.name,
      Home: person.unit ? homeLabel(c, person.unit) : "",
      Role: person.role ?? "",
      How: person.channel,
      Host: person.isHost ? "Yes" : "",
    })),
  );

  const onlineRows: RecordsRow[] = rows.onlinePayments.map((payment) => ({
    Home: homeName(c, rows.labels, payment.homeId),
    Amount: dollars(payment.amountCents),
    "Fee to the association": dollars(payment.processorFeeCents + payment.platformFeeCents),
    Refunded: payment.refundedCents ? dollars(payment.refundedCents) : "",
    Rail: payment.rail,
    State: payment.state,
    Started: payment.createdAt,
    Settled: payment.settledAt ?? "",
  }));

  const vendorRows: RecordsRow[] = c.vendors.map((v) => ({
    Vendor: v.name,
    "What they do": v.service,
    "Paid this year": dollars(vendorPaidThisYear(c, v)),
    "W-9 on file": v.w9OnFile ? "Yes" : "No",
    "Pays by": v.achEnabled ? "Bank transfer" : "Check",
    "Insurance expires": v.coiExpires ?? "",
    "Usual category": v.defaultCategory,
  }));

  const invoiceRows: RecordsRow[] = c.invoices.map((i) => ({
    Invoice: i.number,
    Vendor: i.vendor,
    Amount: dollars(i.amountCents),
    Received: i.receivedDate,
    Due: i.dueDate,
    Status: i.status,
    Via: i.via,
    Description: i.description,
    File: i.file?.name ?? "",
    Notes: i.notes ?? "",
  }));

  // Actuals are the books, derived through the one selector every Finances
  // reader uses, so the file cannot disagree with the Budget screen.
  const variance = budgetVariance(c);
  const budgetRows: RecordsRow[] = [...variance.income, ...variance.expense].map((line) => ({
    Category: line.category,
    Kind: line.kind === "income" ? "Income" : "Expense",
    Annual: dollars(line.annualCents),
    "Year to date": dollars(line.ytdActualCents),
    Remaining: dollars(line.remainingCents),
  }));

  const reserveRows: RecordsRow[] = c.reserveComponents.map((component) => ({
    Component: component.name,
    "Useful life": `${component.usefulLifeYears} years`,
    "Life left": `${component.remainingLifeYears} years`,
    "Replacement cost": dollars(component.replacementCostCents),
    Funded: dollars(component.fundedCents),
    "Last inspected": component.lastInspection ?? "",
    Note: component.note ?? "",
  }));

  const accountRows: RecordsRow[] = c.bankAccounts.map((account) => ({
    Account: account.name,
    Fund: account.kind,
    Institution: account.institution,
    Number: `••${account.mask}`,
    Balance: dollars(account.balanceCents),
    Status: account.status,
    "Reconciled through": account.reconciledThroughDate,
    "Unreconciled lines": String(account.unreconciledCount),
    APY: `${account.apy}%`,
    "Interest this year": dollars(account.interestYtdCents),
    "Insured to": dollars(account.insuredLimitCents),
    Matures: account.maturityDate ?? "",
  }));

  // The months the server summed, for an association with more history than
  // the app holds line by line. Without this file, an export of a five year
  // association would open on two years and say nothing about the rest.
  const historyRows: RecordsRow[] = [
    ...(c.history?.ledgerMonths ?? []).map((month) => ({
      Month: month.month,
      Area: "Books",
      Detail: month.category,
      In: dollars(month.inCents),
      Out: dollars(month.outCents),
      Lines: String(month.count),
    })),
    ...(c.history?.statementMonths ?? []).map((month) => ({
      Month: month.month,
      Area: "Statements",
      Detail: month.kind,
      In: month.cents > 0 ? dollars(month.cents) : "",
      Out: month.cents < 0 ? dollars(-month.cents) : "",
      Lines: String(month.count),
    })),
  ];

  const sharedCostRows: RecordsRow[] = c.sharedCosts.map((cost) => ({
    Name: cost.name,
    Kind: cost.kind,
    Provider: cost.provider,
    "Account reference": cost.accountRef,
    "Split between homes": cost.allocation,
    Administration: `${cost.markupPercent}%`,
    "In use": cost.active ? "Yes" : "No",
    Metered: cost.usageUnit,
  }));

  const sharedBillRows: RecordsRow[] = c.sharedCostBills.map((bill) => {
    const cost = c.sharedCosts.find((x) => x.id === bill.sharedCostId);
    return {
      Cost: cost ? cost.name : "Not on the list",
      Period: `${bill.periodStart} to ${bill.periodEnd}`,
      Due: bill.dueOn,
      Total: dollars(bill.totalCents),
      Usage: bill.usageAmount === undefined ? "" : String(bill.usageAmount),
      Homes: String(bill.homes),
      "Middle home paid": dollars(bill.averageShareCents),
    };
  });

  const assessmentRows: RecordsRow[] = rows.specialAssessments.map((a) => ({
    Assessment: a.title,
    Why: a.reason,
    Total: dollars(a.totalCents),
    "Split between homes": a.allocation,
    Instalments: String(a.installments),
    "First due": a.firstDueOn,
    Status: a.status,
  }));

  const files: RecordsFile[] = [
    // ---------------------------------------------------------------- register
    {
      id: "homes",
      title: "Homes",
      blurb: "Every home on the register, its assessment and its balance today.",
      name: "homes.csv",
      capabilities: ["finances", "communications"],
      columns: columnsOf(
        "Unit",
        "Address",
        "Kind",
        "Assessment",
        "Seats",
        "Standing",
        "Balance",
        "Moved in",
        "Status",
      ),
      rows: homeRows,
      totals: [
        { label: "Homes", count: homeRows.length },
        {
          label: "On the register",
          count: c.homes.length,
        },
      ],
    },
    {
      id: "seats",
      title: "People and their seats",
      blurb: "Who holds a seat on which home, what it opens, and when it began.",
      name: "seats.csv",
      capabilities: ["finances", "communications"],
      columns: columnsOf(
        "Home",
        "Name",
        "Email",
        "Phone",
        "Role",
        "Access",
        "Seat opened",
        "Seat closed",
      ),
      rows: seatRows,
      totals: [
        { label: "Seats", count: seatRows.length },
        { label: "Closed", count: seatRows.filter((s) => s["Seat closed"]).length },
      ],
    },
    {
      id: "board-terms",
      title: "Board terms",
      blurb: "Every term of office on record, current ones included.",
      name: "board-terms.csv",
      capabilities: ["settings"],
      columns: columnsOf("Name", "Role", "Home", "From", "To"),
      rows: (c.boardTerms ?? []).map((term) => ({
        Name: term.name,
        Role: roleWord(term.role),
        Home: term.unit ? homeLabel(c, term.unit) : "",
        From: term.from,
        To: term.to ?? "",
      })),
      totals: [{ label: "Terms", count: (c.boardTerms ?? []).length }],
    },
    // ------------------------------------------------------------------- money
    ...coreRecordsFiles(c, rows),
    {
      id: "online-payments",
      title: "Online payments",
      blurb: "Cards and bank transfers through the product, settled and in flight.",
      name: "online-payments.csv",
      capabilities: ["finances"],
      columns: columnsOf(
        "Home",
        "Amount",
        "Fee to the association",
        "Refunded",
        "Rail",
        "State",
        "Started",
        "Settled",
      ),
      rows: onlineRows,
      totals: [
        { label: "Taken", moneyCents: rows.onlinePayments.reduce((t, p) => t + p.amountCents, 0) },
        {
          label: "Fees",
          moneyCents: rows.onlinePayments.reduce(
            (t, p) => t + p.processorFeeCents + p.platformFeeCents,
            0,
          ),
        },
        { label: "Payments", count: onlineRows.length },
      ],
    },
    {
      id: "vendors",
      title: "Vendors",
      blurb: "Who the association pays, and the paperwork on file for each of them.",
      name: "vendors.csv",
      capabilities: ["vendors"],
      columns: columnsOf(
        "Vendor",
        "What they do",
        "Paid this year",
        "W-9 on file",
        "Pays by",
        "Insurance expires",
        "Usual category",
      ),
      rows: vendorRows,
      totals: [
        {
          label: "Paid this year",
          moneyCents: c.vendors.reduce((t, v) => t + vendorPaidThisYear(c, v), 0),
        },
        { label: "Vendors", count: vendorRows.length },
      ],
    },
    {
      id: "vendor-invoices",
      title: "Vendor bills",
      blurb: "Bills vendors sent, what became of them, and the file that came with each.",
      name: "vendor-invoices.csv",
      capabilities: ["vendors"],
      columns: columnsOf(
        "Invoice",
        "Vendor",
        "Amount",
        "Received",
        "Due",
        "Status",
        "Via",
        "Description",
        "File",
        "Notes",
      ),
      rows: invoiceRows,
      totals: [
        { label: "Billed", moneyCents: c.invoices.reduce((t, i) => t + i.amountCents, 0) },
        {
          label: "Still to pay",
          moneyCents: c.invoices
            .filter((i) => i.status !== "paid" && i.status !== "rejected")
            .reduce((t, i) => t + i.amountCents, 0),
        },
        { label: "Bills", count: invoiceRows.length },
      ],
    },
    {
      id: "bank-accounts",
      title: "Bank accounts",
      blurb: "Every account the association holds, its balance and what it earns.",
      name: "bank-accounts.csv",
      capabilities: ["finances"],
      columns: columnsOf(
        "Account",
        "Fund",
        "Institution",
        "Number",
        "Balance",
        "Status",
        "Reconciled through",
        "Unreconciled lines",
        "APY",
        "Interest this year",
        "Insured to",
        "Matures",
      ),
      rows: accountRows,
      totals: [
        {
          label: "Balance",
          moneyCents: c.bankAccounts.reduce((t, a) => t + a.balanceCents, 0),
        },
        { label: "Accounts", count: accountRows.length },
      ],
    },
    {
      id: "budget",
      title: "Budget",
      blurb: "The adopted budget against what the year has actually done.",
      name: "budget.csv",
      capabilities: ["finances"],
      columns: columnsOf("Category", "Kind", "Annual", "Year to date", "Remaining"),
      rows: budgetRows,
      totals: [
        { label: "Income budgeted", moneyCents: budget.incomeAnnual },
        { label: "Income to date", moneyCents: budget.incomeYtd },
        { label: "Expenses budgeted", moneyCents: budget.expenseAnnual },
        { label: "Expenses to date", moneyCents: budget.expenseYtd },
        { label: "Net to date", moneyCents: budget.netYtd },
      ],
    },
    {
      id: "reserves",
      title: "Reserve study",
      blurb: "Every component, what replacing it costs, and how much is set aside.",
      name: "reserves.csv",
      capabilities: ["finances"],
      columns: columnsOf(
        "Component",
        "Useful life",
        "Life left",
        "Replacement cost",
        "Funded",
        "Last inspected",
        "Note",
      ),
      rows: reserveRows,
      totals: [
        { label: "Funded", moneyCents: reserve.funded },
        { label: "Replacement cost", moneyCents: reserve.required },
        { label: "Funded share", text: `${Math.round(reserve.percentFunded * 100)}%` },
      ],
    },
    // --------------------------------------------------------- shared costs
    // Only for an association that has them: the layer is optional, and an
    // empty file in a zip is a question the board has to answer.
    ...(c.sharedCosts.length
      ? [
          {
            id: "shared-costs",
            title: "Shared costs",
            blurb: "Bills the association receives and passes on, and how they are split.",
            name: "shared-costs.csv",
            capabilities: ["finances" as const],
            columns: columnsOf(
              "Name",
              "Kind",
              "Provider",
              "Account reference",
              "Split between homes",
              "Administration",
              "In use",
              "Metered",
            ),
            rows: sharedCostRows,
            totals: [{ label: "Costs", count: sharedCostRows.length }],
          },
          {
            id: "shared-cost-bills",
            title: "Shared cost bills",
            blurb: "Each provider bill, already divided between homes.",
            name: "shared-cost-bills.csv",
            capabilities: ["finances" as const],
            columns: columnsOf(
              "Cost",
              "Period",
              "Due",
              "Total",
              "Usage",
              "Homes",
              "Middle home paid",
            ),
            rows: sharedBillRows,
            totals: [
              {
                label: "Passed on",
                moneyCents: c.sharedCostBills.reduce((t, b) => t + b.totalCents, 0),
              },
              { label: "Bills", count: sharedBillRows.length },
            ],
          },
        ]
      : []),
    ...(rows.specialAssessments.length
      ? [
          {
            id: "special-assessments",
            title: "Special assessments",
            blurb: "Each levy, why it was made, and where it stands.",
            name: "special-assessments.csv",
            capabilities: ["finances" as const],
            columns: columnsOf(
              "Assessment",
              "Why",
              "Total",
              "Split between homes",
              "Instalments",
              "First due",
              "Status",
            ),
            rows: assessmentRows,
            totals: [
              {
                label: "Levied",
                moneyCents: rows.specialAssessments.reduce((t, a) => t + a.totalCents, 0),
              },
              { label: "Assessments", count: assessmentRows.length },
            ],
          },
        ]
      : []),
    ...(c.history
      ? [
          {
            id: "earlier-months",
            title: "Earlier years, by month",
            blurb: "The months the server summed, before the lines the app holds.",
            name: "earlier-months.csv",
            capabilities: ["finances" as const],
            columns: columnsOf("Month", "Area", "Detail", "In", "Out", "Lines"),
            rows: historyRows,
            totals: [
              { label: "Months", count: historyRows.length },
              { label: "Books in", moneyCents: totals.inCents },
            ],
          },
        ]
      : []),
    // -------------------------------------------------------------- governance
    {
      id: "governing",
      title: "Governing documents",
      blurb: "The declaration, the bylaws and the rules, article by article.",
      name: "governing.csv",
      capabilities: ["documents"],
      columns: columnsOf(
        "Document",
        "Number",
        "Title",
        "Topic",
        "Affects",
        "Amended",
        "Adopted",
        "In plain words",
        "Text",
      ),
      rows: c.governingDocs.map((article) => ({
        Document: article.document,
        Number: article.number,
        Title: article.title,
        Topic: article.topic,
        Affects: article.affects,
        Amended: article.amendedOn ?? "",
        Adopted: article.adoptedOn ?? "",
        "In plain words": article.plain ?? "",
        Text: paragraphs(article.text),
      })),
      totals: [{ label: "Articles", count: c.governingDocs.length }],
    },
    {
      id: "amendments",
      title: "Proposed amendments",
      blurb: "Changes to the governing documents, and which vote carried them.",
      name: "amendments.csv",
      capabilities: ["documents"],
      columns: columnsOf(
        "Document",
        "Number",
        "Title",
        "Change",
        "Stage",
        "Proposed by",
        "Proposed on",
        "Threshold",
        "Text",
      ),
      rows: c.governingAmendments.map((a) => ({
        Document: a.document,
        Number: a.number,
        Title: a.title,
        Change: a.kind,
        Stage: a.stage,
        "Proposed by": a.proposedBy,
        "Proposed on": a.proposedOn,
        Threshold: a.thresholdLabel,
        Text: paragraphs(a.text),
      })),
      totals: [{ label: "Amendments", count: c.governingAmendments.length }],
    },
    {
      id: "documents",
      title: "Files",
      blurb: "Every file the association holds, with who may open it. The files stay here.",
      name: "documents.csv",
      capabilities: ["documents"],
      columns: columnsOf(
        "Name",
        "Category",
        "Who may open",
        "Updated",
        "Size",
        "Type",
        "Required by",
        "Where it lives",
      ),
      rows: c.documents.map((doc) => ({
        Name: doc.name,
        Category: doc.category,
        "Who may open": doc.visibility,
        Updated: doc.updatedDate,
        Size: doc.size,
        Type: doc.fileType,
        "Required by": doc.requiredBy ?? "",
        "Where it lives": doc.storagePath ?? "No file uploaded",
      })),
      totals: [
        { label: "Files", count: c.documents.length },
        { label: "Not uploaded yet", count: c.documents.filter((d) => !d.storagePath).length },
      ],
    },
    {
      id: "forms",
      title: "Forms",
      blurb: "The forms the association hands out, and the questions on each.",
      name: "forms.csv",
      capabilities: ["requests"],
      columns: columnsOf(
        "Form",
        "Description",
        "Questions",
        "From",
        "Governed by",
        "Days to decide",
        "File",
        "Updated",
      ),
      rows: c.forms.map((form) => ({
        Form: form.label,
        Description: form.description,
        Questions: (form.fields ?? []).map((field) => field.label).join("; "),
        From: form.source,
        "Governed by": form.governedBy ?? "",
        "Days to decide": form.decisionDays === undefined ? "" : String(form.decisionDays),
        File: form.fileName,
        Updated: form.updatedDate,
      })),
      totals: [{ label: "Forms", count: c.forms.length }],
    },
    {
      id: "announcements",
      title: "Announcements",
      blurb: "What the board posted to the community, newest first.",
      name: "announcements.csv",
      capabilities: ["communications"],
      columns: columnsOf("Posted", "Title", "Category", "Author", "Pinned", "Body"),
      rows: c.announcements.map((a) => ({
        Posted: a.postedDate,
        Title: a.title,
        Category: a.category,
        Author: a.author,
        Pinned: a.pinned ? "Yes" : "",
        Body: a.body,
      })),
      totals: [{ label: "Announcements", count: c.announcements.length }],
    },
    {
      id: "threads",
      title: "Conversations",
      blurb: "Every message thread between a home and the board, with who is on it.",
      name: "threads.csv",
      capabilities: ["communications"],
      columns: columnsOf(
        "Subject",
        "Home",
        "Addressed to",
        "Tag",
        "People",
        "Messages",
        "Last message",
      ),
      rows: c.threads.map((thread) => ({
        Subject: thread.subject,
        Home: thread.unit ? homeLabel(c, thread.unit) : "",
        "Addressed to": thread.toRole,
        Tag: thread.tag,
        People: thread.participants.join("; "),
        Messages: String(thread.messages.length),
        "Last message": thread.updatedDate,
      })),
      totals: [{ label: "Threads", count: c.threads.length }],
    },
    {
      id: "messages",
      title: "Messages",
      blurb: "Every message in those threads, in one file, oldest first.",
      name: "messages.csv",
      capabilities: ["communications"],
      columns: columnsOf(
        "At",
        "Thread",
        "Home",
        "From",
        "Office",
        "Direction",
        "Channel",
        "Message",
      ),
      rows: c.threads
        .flatMap((thread) =>
          thread.messages.map((message) => ({
            At: message.at,
            Thread: thread.subject,
            Home: thread.unit ? homeLabel(c, thread.unit) : "",
            From: message.from,
            Office: message.fromOffice ?? "",
            Direction: message.direction,
            Channel: message.channel,
            Message: message.body,
          })),
        )
        .sort((a, b) => a.At.localeCompare(b.At)),
      totals: [
        {
          label: "Messages",
          count: c.threads.reduce((t, thread) => t + thread.messages.length, 0),
        },
      ],
    },
    {
      id: "posts",
      title: "Community posts",
      blurb: "What neighbours posted, what became of it, and the replies.",
      name: "posts.csv",
      capabilities: ["forum"],
      columns: columnsOf(
        "At",
        "Title",
        "Category",
        "Author",
        "Home",
        "Approved by",
        "Likes",
        "Replies",
        "Body",
        "Reply",
      ),
      rows: c.posts.flatMap((post) => {
        const head: RecordsRow = {
          At: post.at,
          Title: post.title,
          Category: post.category,
          Author: post.author,
          Home: post.unit ? homeLabel(c, post.unit) : "",
          "Approved by": post.moderatedBy ?? "",
          Likes: String(post.likes),
          Replies: String(post.replies.length),
          Body: post.body,
          Reply: "",
        };
        // One line per reply, so a reply is never hidden inside a cell.
        return [
          head,
          ...post.replies.map((reply) => ({
            At: reply.at,
            Title: post.title,
            Category: post.category,
            Author: reply.author,
            Home: reply.unit ? homeLabel(c, reply.unit) : "",
            "Approved by": "",
            Likes: "",
            Replies: "",
            Body: "",
            Reply: reply.body,
          })),
        ];
      }),
      totals: [
        { label: "Posts", count: c.posts.length },
        { label: "Replies", count: c.posts.reduce((t, p) => t + p.replies.length, 0) },
      ],
    },
    {
      id: "amenities",
      title: "Amenities",
      blurb: "What the association offers, and whether it can be booked.",
      name: "amenities.csv",
      columns: columnsOf("Amenity", "Detail", "Status", "Bookable"),
      rows: c.amenities.map((a) => ({
        Amenity: a.name,
        Detail: a.detail,
        Status: a.status,
        Bookable: a.reservable ? "Yes" : "No",
      })),
      totals: [{ label: "Amenities", count: c.amenities.length }],
    },
    {
      id: "bookings",
      title: "Amenity bookings",
      blurb: "Every slot a home holds, confirmed or still waiting.",
      name: "amenity-bookings.csv",
      columns: columnsOf("Date", "From", "To", "Amenity", "Home", "Booked by", "Status"),
      rows: c.amenityBookings.map((booking) => {
        const amenity = c.amenities.find((a) => a.id === booking.amenityId);
        return {
          Date: booking.date,
          From: clockWord(booking.startMinute),
          To: clockWord(booking.endMinute),
          Amenity: amenity ? amenity.name : "Not on the list",
          Home: booking.unit ? homeLabel(c, booking.unit) : "",
          "Booked by": booking.ownerName,
          Status: booking.status,
        };
      }),
      totals: [{ label: "Bookings", count: c.amenityBookings.length }],
    },
    // ---------------------------------------------------------- what was decided
    {
      id: "attendance",
      title: "Meeting attendance",
      blurb: "Who came to each meeting, as the board marked it with the minutes.",
      name: "attendance.csv",
      columns: columnsOf("Date", "Meeting", "Name", "Home", "Role", "How", "Host"),
      rows: attendanceRows,
      totals: [{ label: "Attendances", count: attendanceRows.length }],
    },
    {
      id: "action-items",
      title: "What the board agreed to do",
      blurb: "One line each, who owns it, and whether it was done.",
      name: "action-items.csv",
      capabilities: ["settings"],
      columns: columnsOf("Agreed", "Item", "Owner", "Due", "Done"),
      rows: c.actionItems.map((item) => ({
        Agreed: item.createdOn,
        Item: item.title,
        Owner: item.ownerName,
        Due: item.dueOn ?? "",
        Done: item.doneOn ?? "",
      })),
      totals: [
        { label: "Items", count: c.actionItems.length },
        { label: "Done", count: c.actionItems.filter((i) => i.doneOn).length },
      ],
    },
    {
      id: "request-updates",
      title: "Request notes and updates",
      blurb: "Every note, status change and file added to a request, in order.",
      name: "request-updates.csv",
      capabilities: ["requests"],
      columns: columnsOf("Reference", "At", "By", "Role", "Kind", "Note"),
      rows: c.requests
        .flatMap((request) =>
          (request.thread ?? []).map((event) => ({
            Reference: request.reference,
            At: event.at,
            By: event.actor,
            Role: event.actorRole,
            Kind: event.kind,
            Note: event.body,
          })),
        )
        .sort((a, b) => a.At.localeCompare(b.At)),
      totals: [
        {
          label: "Updates",
          count: c.requests.reduce((t, request) => t + (request.thread ?? []).length, 0),
        },
      ],
    },
    {
      id: "violations",
      title: "Notices to owners",
      blurb: "Every notice the board raised, the rule it rests on, and where it stands.",
      name: "notices.csv",
      capabilities: ["requests"],
      columns: columnsOf(
        "Reference",
        "Home",
        "Owner",
        "Rule",
        "Citation",
        "Stage",
        "Opened",
        "Next step due",
        "Fine",
        "Photographs",
        "Where it came from",
        "Resolved",
      ),
      rows: c.violations.map((v) => ({
        Reference: v.reference,
        Home: v.unit ? homeLabel(c, v.unit) : "",
        Owner: v.ownerName,
        Rule: v.rule,
        Citation: v.ruleCitation,
        Stage: v.stage,
        Opened: v.openedDate,
        "Next step due": v.nextActionDate,
        Fine: dollars(v.fineCents),
        Photographs: String(v.photos.length),
        "Where it came from": v.source ?? "board",
        Resolved: v.resolvedDate ?? "",
      })),
      totals: [
        { label: "Notices", count: c.violations.length },
        { label: "Fines", moneyCents: c.violations.reduce((t, v) => t + v.fineCents, 0) },
      ],
    },
    // A report is an input to an investigation and never a basis for
    // enforcement, so it is its own file rather than a column on a notice.
    ...(c.violationReports.length
      ? [
          {
            id: "reports",
            title: "What neighbours reported",
            blurb: "Reports to the board, who verified them, and what they became.",
            name: "reports.csv",
            capabilities: ["requests" as const],
            columns: columnsOf(
              "Reference",
              "About",
              "Reported by",
              "Their home",
              "What was seen",
              "Observed",
              "Reported",
              "Status",
              "Verified by",
              "Verified on",
              "Became",
            ),
            rows: c.violationReports.map((report) => ({
              Reference: report.reference,
              About: report.subjectUnit ? homeLabel(c, report.subjectUnit) : "",
              "Reported by": report.reporterName,
              "Their home": report.reporterUnit ? homeLabel(c, report.reporterUnit) : "",
              "What was seen": report.what,
              Observed: report.observedOn,
              Reported: report.submittedOn,
              Status: report.status,
              "Verified by": report.verification?.by ?? "",
              "Verified on": report.verification?.on ?? "",
              Became: report.violationId ?? "",
            })),
            totals: [{ label: "Reports", count: c.violationReports.length }],
          },
        ]
      : []),
    {
      id: "join-requests",
      title: "People who asked to join",
      blurb: "Who typed the join code, and what the board decided.",
      name: "join-requests.csv",
      capabilities: ["settings"],
      columns: columnsOf(
        "Asked",
        "Name",
        "Email",
        "Home",
        "Status",
        "Decided",
        "Decided by",
        "Note",
      ),
      rows: c.joinRequests.map((join) => ({
        Asked: join.requestedOn,
        Name: join.name,
        Email: join.email,
        Home: join.unit,
        Status: join.status,
        Decided: join.decidedOn ?? "",
        "Decided by": join.decidedBy ?? "",
        Note: join.note,
      })),
      totals: [{ label: "Requests", count: c.joinRequests.length }],
    },
    {
      id: "settings",
      title: "Association settings",
      blurb: "The association's own details, the dues it bills and the policy it follows.",
      name: "association.csv",
      capabilities: ["settings"],
      columns: columnsOf("Setting", "Value"),
      rows: [
        { Setting: "Name", Value: c.association.name },
        { Setting: "Address", Value: c.association.addressLine },
        { Setting: "State", Value: c.association.stateName },
        { Setting: "Homes", Value: String(c.association.unitCount) },
        { Setting: "Tax id", Value: c.association.ein ?? "" },
        { Setting: "Fiscal year starts", Value: c.association.fiscalYearStart },
        {
          Setting: "Dues",
          Value: `${money(c.association.duesCents)} ${c.association.duesCadence}`,
        },
        {
          Setting: "Dues by kind of home",
          Value: Object.entries(c.association.duesByType ?? {})
            .map(([kind, cents]) => `${kind}: ${money(cents ?? 0)}`)
            .join("; "),
        },
        { Setting: "Books managed by", Value: c.association.managedBy },
        { Setting: "Reply-to address", Value: c.association.contactEmail ?? "" },
        {
          Setting: "Bills emailed to owners",
          Value: c.association.billsByEmail === false ? "No" : "Yes",
        },
        { Setting: "Insurance carrier", Value: c.association.insuranceCarrier ?? "" },
        { Setting: "Insurance policy", Value: c.association.insurancePolicyNo ?? "" },
        { Setting: "Insurance renews", Value: c.association.insuranceExpiresOn ?? "" },
        // The ladder is a written policy, the same for everybody, every step
        // dated: it is the defence when a lien is challenged. A board that
        // never edited it follows the default, which is what `policyFor` says.
        { Setting: "Reminder day", Value: String(policy.reminderDay) },
        { Setting: "Late notice day", Value: String(policy.lateNoticeDay) },
        { Setting: "Demand letter day", Value: String(policy.demandDay) },
      ],
      totals: [],
    },
  ];

  return files;
}
