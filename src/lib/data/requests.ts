import type { HomeRequest, Violation, ViolationReport } from "@/lib/types";

export const requests: HomeRequest[] = [
  {
    id: "req-118",
    reference: "REQ-2026-118",
    kind: "architectural",
    title: "Replace rear fence with 6' vinyl privacy fence",
    summary:
      "Existing wood fence is rotting at three posts. Requesting approval to replace with white vinyl matching units 40 and 44, same footprint and height.",
    ownerId: "own-042",
    ownerName: "Monish Naidu",
    unit: "42",
    status: "approved",
    submittedDate: "2026-07-28",
    dueDate: "2026-08-27",
    dueReason: "CC&Rs Art. VII §3: ARC must respond within 30 days",
    decisionDate: "2026-08-12",
    decidedBy: "Architectural Review Committee",
    certificateId: "ARC-2026-118-A7F3",
    attachments: [
      { name: "fence-quote-tidewater.pdf", size: "412 KB" },
      { name: "property-survey.pdf", size: "1.8 MB" },
      { name: "vinyl-sample-photo.jpg", size: "2.1 MB" },
    ],
    thread: [
      {
        id: "rt-1",
        at: "2026-07-28",
        actor: "Monish Naidu",
        actorRole: "resident",
        body: "Submitted with contractor quote and survey. Happy to provide additional photos if useful.",
        kind: "note",
      },
      {
        id: "rt-2",
        at: "2026-07-29",
        actor: "ExpressHOA",
        actorRole: "system",
        body: "Routed to the Architectural Review Committee. 30-day response clock expires Aug 27, 2026.",
        kind: "status",
      },
      {
        id: "rt-3",
        at: "2026-08-04",
        actor: "Sofia Bergman",
        actorRole: "board",
        body: "Committee reviewed. One question: will the gate stay on the north side? The survey shows it but the quote doesn't itemize it.",
        kind: "note",
      },
      {
        id: "rt-4",
        at: "2026-08-05",
        actor: "Monish Naidu",
        actorRole: "resident",
        body: "Yes, same location and swing direction. Northsound Fence confirmed the gate is in line 3 of the quote.",
        kind: "note",
      },
      {
        id: "rt-5",
        at: "2026-08-12",
        actor: "Architectural Review Committee",
        actorRole: "board",
        body: "Approved 3–0. Approval is valid for 180 days from today. Please keep the contractor's COI on file with the association.",
        kind: "status",
      },
    ],
  },
  {
    id: "req-121",
    reference: "REQ-2026-121",
    kind: "maintenance",
    title: "Sprinkler head spraying onto the driveway",
    summary:
      "Zone 4 head at the corner of the common lawn is misaligned and soaking the driveway every morning. Leaving a mineral stain.",
    ownerId: "own-042",
    ownerName: "Monish Naidu",
    unit: "42",
    status: "in-review",
    submittedDate: "2026-08-17",
    attachments: [{ name: "sprinkler.jpg", size: "1.4 MB" }],
    thread: [
      {
        id: "rt-6",
        at: "2026-08-17",
        actor: "Monish Naidu",
        actorRole: "resident",
        body: "Photo attached, taken around 6:15am when zone 4 runs.",
        kind: "note",
      },
      {
        id: "rt-7",
        at: "2026-08-18",
        actor: "ExpressHOA",
        actorRole: "system",
        body: "Assigned to Cascade Grounds Co. under the grounds contract.",
        kind: "status",
      },
      {
        id: "rt-8",
        at: "2026-08-19",
        actor: "Dana Whitcomb",
        actorRole: "board",
        body: "Cascade Grounds is on site Thursday for the regular cut and will realign it then. No charge, it\u2019s covered under contract.",
        kind: "note",
      },
    ],
  },
  {
    id: "req-114",
    reference: "REQ-2026-114",
    kind: "records",
    title: "Inspection of official records, FY2025 ledger and bank statements",
    summary:
      "Written request for the general ledger, bank statements, and reserve account activity for fiscal year 2025.",
    ownerId: "own-026",
    ownerName: "Gwen Halloran",
    unit: "26",
    status: "info-needed",
    submittedDate: "2026-08-11",
    dueDate: "2026-08-25",
    dueReason: "Association policy: 10 business days to respond",
    attachments: [{ name: "records-request-signed.pdf", size: "88 KB" }],
    thread: [
      {
        id: "rt-9",
        at: "2026-08-11",
        actor: "Gwen Halloran",
        actorRole: "resident",
        body: "Requesting inspection of the FY2025 general ledger, all bank statements, and reserve account activity.",
        kind: "note",
      },
      {
        id: "rt-10",
        at: "2026-08-11",
        actor: "ExpressHOA",
        actorRole: "system",
        body: "Records clock started. Response due Aug 25, 2026, 10 business days under association policy. Board notified.",
        kind: "status",
      },
      {
        id: "rt-11",
        at: "2026-08-14",
        actor: "Sofia Bergman",
        actorRole: "board",
        body: "Ledger and statements assembled. Counsel is reviewing redaction of the two accounts in collections before release.",
        kind: "note",
      },
    ],
  },
  {
    id: "req-119",
    reference: "REQ-2026-119",
    kind: "architectural",
    title: "Install roof-mounted solar array (14 panels, south face)",
    summary:
      "Requesting approval for a 5.6 kW rooftop array on the south-facing roof plane. Washington law limits what an association can restrict here.",
    ownerId: "own-078",
    ownerName: "Ibrahim Haddad",
    unit: "78",
    status: "in-review",
    submittedDate: "2026-08-06",
    dueDate: "2026-09-05",
    dueReason: "CC&Rs Art. VII §3: ARC must respond within 30 days",
    attachments: [
      { name: "solar-plan-set.pdf", size: "3.2 MB" },
      { name: "structural-letter.pdf", size: "640 KB" },
    ],
    thread: [
      {
        id: "rt-12",
        at: "2026-08-06",
        actor: "Ibrahim Haddad",
        actorRole: "resident",
        body: "Plan set and engineer's structural letter attached. Installer is licensed and insured, COI to follow.",
        kind: "note",
      },
      {
        id: "rt-13",
        at: "2026-08-13",
        actor: "Kestrel & Boyd LLP",
        actorRole: "board",
        body: "Reminder to the committee: Washington law limits how far an association can restrict solar. Aesthetic conditions hold up only where they don't materially reduce output.",
        kind: "note",
      },
    ],
  },
  {
    id: "req-120",
    reference: "REQ-2026-120",
    kind: "amenity",
    title: "Clubhouse reservation, Saturday Sept 12, 4–9 PM",
    summary: "Family birthday party, approximately 30 guests. Requesting the main room and kitchen.",
    ownerId: "own-055",
    ownerName: "Rhea Calloway",
    unit: "55",
    status: "denied",
    submittedDate: "2026-08-14",
    decisionDate: "2026-08-16",
    decidedBy: "Arya Mehr, President",
    attachments: [],
    thread: [
      {
        id: "rt-14",
        at: "2026-08-16",
        actor: "Arya Mehr",
        actorRole: "board",
        body: "Denied under the rental policy. The account is 62 days past due and amenity reservations require an account in good standing. Bring the balance current and resubmit; we'll hold the date until Aug 29.",
        kind: "status",
      },
    ],
  },
  {
    id: "req-122",
    reference: "REQ-2026-122",
    kind: "maintenance",
    title: "Common area light out at the Mehr Meadows Ln mailboxes",
    summary: "Pole light has been dark for about a week. It's the only light at the mailbox cluster.",
    ownerId: "own-012",
    ownerName: "Owen Brady",
    unit: "12",
    status: "submitted",
    submittedDate: "2026-08-19",
    attachments: [],
    thread: [
      {
        id: "rt-15",
        at: "2026-08-19",
        actor: "Owen Brady",
        actorRole: "resident",
        body: "Dark for about a week now. It's the only light at the mailboxes and it feels unsafe after sunset.",
        kind: "note",
      },
    ],
  },
];

/**
 * Enforcement, with the evidence attached.
 *
 * Two of these started as a report from a neighbour and two did not, which is
 * the ordinary mix and the reason the distinction is modelled at all. In both
 * cases the notice rests on a board member's own observation: the report is
 * what made somebody go and look, and nothing more than that. The last one is
 * from the county, which is the third source and the one with a deadline.
 *
 * The photographs are described rather than shown. We do not have enforcement
 * photographs of a fictional community and generating them would be inventing
 * evidence, which is a strange thing to do in the one part of the product that
 * is about not doing that. The brief, the date, the photographer and the
 * vantage are the parts a hearing actually turns on, and those are real here.
 */
export const violations: Violation[] = [
  {
    id: "vio-1",
    reference: "VIO-2026-041",
    ownerId: "own-063",
    ownerName: "Sandhill Property Holdings LLC",
    unit: "63",
    rule: "Commercial vehicle parked overnight in driveway",
    ruleCitation: "CC&Rs Art. IX §2(b)",
    stage: "first-notice",
    openedDate: "2026-08-06",
    nextActionDate: "2026-08-27",
    reportId: "rep-2026-018",
    photos: [
      {
        id: "vio-1-p1",
        brief:
          "A box truck with contractor lettering on the driveway apron, taken at 6:40am from the public sidewalk. The lettering and the plate are both legible.",
        takenOn: "2026-08-05",
        takenBy: "Arya Mehr, President",
        vantage: "street",
      },
      {
        id: "vio-1-p2",
        brief:
          "The same truck in the same position the following morning, showing it stayed overnight rather than being present for a job.",
        takenOn: "2026-08-06",
        takenBy: "Arya Mehr, President",
        vantage: "street",
      },
      {
        id: "vio-1-p3",
        brief:
          "Wide shot of the street showing the truck relative to the property line, so the driveway it is on is not in question.",
        takenOn: "2026-08-06",
        takenBy: "Arya Mehr, President",
        vantage: "street",
      },
    ],
    fineCents: 0,
  },
  {
    id: "vio-2",
    reference: "VIO-2026-039",
    ownerId: "own-055",
    ownerName: "Rhea Calloway",
    unit: "55",
    rule: "Trash receptacles visible from the street",
    ruleCitation: "Rules & Regs §4.1",
    stage: "courtesy",
    openedDate: "2026-08-15",
    nextActionDate: "2026-08-29",
    photos: [
      {
        id: "vio-2-p1",
        brief:
          "Two bins at the side of the house, visible from the sidewalk, on a Thursday. Collection on this street is Monday.",
        takenOn: "2026-08-14",
        takenBy: "Sofia Bergman, Secretary",
        vantage: "street",
      },
    ],
    fineCents: 0,
  },
  {
    id: "vio-3",
    reference: "VIO-2026-034",
    ownerId: "own-026",
    ownerName: "Gwen Halloran",
    unit: "26",
    rule: "Unapproved exterior paint color",
    ruleCitation: "CC&Rs Art. VII §1",
    stage: "hearing",
    openedDate: "2026-06-22",
    nextActionDate: "2026-09-16",
    reportId: "rep-2026-012",
    photos: [
      {
        id: "vio-3-p1",
        brief: "The front elevation as painted, taken from the street.",
        takenOn: "2026-06-21",
        takenBy: "Arya Mehr, President",
        vantage: "street",
      },
      {
        id: "vio-3-p2",
        brief:
          "The same elevation before the work, from the association's own file, for comparison.",
        takenOn: "2024-09-03",
        takenBy: "Association records",
        vantage: "street",
      },
      {
        id: "vio-3-p3",
        brief: "Close shot of the trim colour against the approved palette card.",
        takenOn: "2026-06-21",
        takenBy: "Arya Mehr, President",
        vantage: "street",
      },
      {
        id: "vio-3-p4",
        brief: "The side elevation, showing the same colour continues around the house.",
        takenOn: "2026-06-21",
        takenBy: "Arya Mehr, President",
        vantage: "street",
      },
      {
        id: "vio-3-p5",
        // Kept, flagged, and not relied on. The point of recording the vantage
        // is that a photograph like this one gets caught before the hearing
        // rather than raised at it.
        brief:
          "The rear elevation, taken over the boundary fence from the neighbouring lot. Not relied on in the notice.",
        takenOn: "2026-06-21",
        takenBy: "Arya Mehr, President",
        vantage: "over-boundary",
      },
    ],
    fineCents: 10_000,
  },
  {
    id: "vio-4",
    reference: "VIO-2026-028",
    ownerId: "own-050",
    ownerName: "Tessa Moreau",
    unit: "50",
    rule: "Landscaping not maintained, front bed",
    ruleCitation: "Rules & Regs §2.3",
    stage: "cured",
    openedDate: "2026-05-30",
    nextActionDate: "2026-06-20",
    resolvedDate: "2026-06-18",
    photos: [
      {
        id: "vio-4-p1",
        brief: "The front bed as found, from the sidewalk.",
        takenOn: "2026-05-29",
        takenBy: "Sofia Bergman, Secretary",
        vantage: "street",
      },
      {
        id: "vio-4-p2",
        brief: "The same bed after the work, which is what closed the matter.",
        takenOn: "2026-06-18",
        takenBy: "Sofia Bergman, Secretary",
        vantage: "street",
      },
    ],
    fineCents: 0,
  },
  {
    // A notice from the county rather than from a neighbour. Not hearsay, so
    // nobody has to go and look; it has a deadline instead, and the citation
    // is the agency's case rather than a section of the governing documents.
    id: "vio-5",
    reference: "CITY-2026-007",
    ownerId: "",
    ownerName: "The association",
    unit: "Common area",
    rule: "Retention pond fence on the east common area has two leaning panels and one missing. Repair or replace to code before the compliance date.",
    ruleCitation: "Snohomish County Code Enforcement, case CE-26-01187",
    stage: "first-notice",
    openedDate: "2026-08-13",
    nextActionDate: "2026-09-12",
    source: "city",
    agency: "Snohomish County Code Enforcement",
    caseNumber: "CE-26-01187",
    photos: [
      {
        id: "vio-5-p1",
        brief:
          "The east fence of the retention pond from the common area path, two panels leaning inward and the gap where the third was.",
        takenOn: "2026-08-14",
        takenBy: "Sofia Bergman, Secretary",
        vantage: "common-area",
      },
    ],
    fineCents: 0,
  },
];

/**
 * What neighbours have told the board.
 *
 * Deliberately a separate collection from `violations`. Two of these became
 * notices after somebody went and looked, one was dismissed because the board
 * looked and found nothing, and one is still sitting unverified. That last
 * state is the honest one and the one a queue has to be able to show.
 *
 * `rep-2026-020` and `rep-2026-021` are the same reporter on the same
 * neighbour inside a month. Neither is verified. The pattern is the finding,
 * not either report.
 */
export const violationReports: ViolationReport[] = [
  {
    id: "rep-2026-022",
    reference: "REP-2026-022",
    reporterId: "own-031",
    reporterName: "Colette Prieto",
    reporterUnit: "31",
    subjectUnit: "29",
    subjectOwnerId: "own-029",
    what: "Someone has been running a table saw in the driveway late in the evening for about a week.",
    observedOn: "2026-08-18",
    submittedOn: "2026-08-19",
    status: "new",
  },
  {
    id: "rep-2026-021",
    reference: "REP-2026-021",
    reporterId: "own-044",
    reporterName: "Hollis Nakamura",
    reporterUnit: "44",
    subjectUnit: "45",
    subjectOwnerId: "own-045",
    what: "Their guests park across the shared driveway entrance most weekends.",
    observedOn: "2026-08-16",
    submittedOn: "2026-08-17",
    status: "new",
  },
  {
    id: "rep-2026-020",
    reference: "REP-2026-020",
    reporterId: "own-044",
    reporterName: "Hollis Nakamura",
    reporterUnit: "44",
    subjectUnit: "45",
    subjectOwnerId: "own-045",
    what: "The recycling bin was left out two days after collection again.",
    observedOn: "2026-07-28",
    submittedOn: "2026-07-29",
    status: "new",
  },
  {
    id: "rep-2026-019",
    reference: "REP-2026-019",
    reporterId: "own-017",
    reporterName: "Devon Achebe",
    reporterUnit: "17",
    subjectUnit: "18",
    subjectOwnerId: "own-018",
    what: "I think they have put up a shed at the back without asking anybody.",
    observedOn: "2026-08-02",
    submittedOn: "2026-08-03",
    status: "dismissed",
    dismissedReason:
      "Looked on 5 August. It is a temporary garden store under the size the Committee reviews, and no approval was needed.",
  },
  {
    id: "rep-2026-018",
    reference: "REP-2026-018",
    reporterId: "own-062",
    reporterName: "Marguerite Lowry",
    reporterUnit: "62",
    subjectUnit: "63",
    subjectOwnerId: "own-063",
    what: "There is a work truck parked on the driveway overnight, most nights this month.",
    observedOn: "2026-08-03",
    submittedOn: "2026-08-04",
    status: "verified",
    verification: {
      by: "Arya Mehr, President",
      on: "2026-08-05",
      note: "Walked the street at 6:40am on the 5th and again on the 6th. Truck present both mornings in the same position, commercial lettering visible from the sidewalk. Photographed from the public way.",
    },
    violationId: "vio-1",
  },
  {
    id: "rep-2026-012",
    reference: "REP-2026-012",
    reporterId: "own-025",
    reporterName: "Ines Farrow",
    reporterUnit: "25",
    subjectUnit: "26",
    subjectOwnerId: "own-026",
    what: "Number 26 has been repainted a colour I do not think was approved.",
    observedOn: "2026-06-19",
    submittedOn: "2026-06-20",
    status: "verified",
    verification: {
      by: "Arya Mehr, President",
      on: "2026-06-21",
      note: "Checked the architectural file. No application on record for exterior paint since 2019. Colour on site does not match the approved palette.",
    },
    violationId: "vio-3",
  },
];
