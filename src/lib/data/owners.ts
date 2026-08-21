import type { Owner } from "@/lib/types";

/** The resident persona the prototype signs you in as. */
export const CURRENT_OWNER_ID = "own-042";

export const owners: Owner[] = [
  {
    id: "own-042",
    displayName: "Monish Naidu",
    members: ["Monish Naidu"],
    email: "monish.naidu@example.com",
    phone: "(425) 555-0142",
    unit: "42",
    address: "1428 Mehr Gardens Lane",
    moveInDate: "2021-06-11",
    balanceCents: 28_500,
    autopay: false,
    standing: "current",
    daysPastDue: 0,
  },
  {
    id: "own-007",
    displayName: "Arya Mehr",
    members: ["Arya Mehr"],
    email: "arya.mehr@example.com",
    phone: "(425) 555-0107",
    unit: "7",
    address: "1302 Mehr Gardens Lane",
    moveInDate: "2018-02-01",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "ACH ••4471",
    standing: "current",
    daysPastDue: 0,
    boardRole: "President",
  },
  {
    id: "own-019",
    displayName: "Dana Whitcomb",
    members: ["Dana Whitcomb"],
    email: "dana.whitcomb@example.com",
    phone: "(425) 555-0119",
    unit: "19",
    address: "1355 Alder Ridge Court",
    moveInDate: "2019-09-20",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "ACH ••8890",
    standing: "current",
    daysPastDue: 0,
    boardRole: "Treasurer",
  },
  {
    id: "own-031",
    displayName: "Sofia Bergman",
    members: ["Sofia Bergman"],
    email: "s.bergman@example.com",
    phone: "(425) 555-0131",
    unit: "31",
    address: "1391 Alder Ridge Court",
    moveInDate: "2020-04-15",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "ACH ••2214",
    standing: "current",
    daysPastDue: 0,
    boardRole: "Secretary",
  },
  {
    id: "own-071",
    displayName: "Ellis Wright",
    members: ["Ellis Wright"],
    email: "ellis.wright@example.com",
    phone: "(425) 555-0171",
    unit: "71",
    address: "1588 Alder Ridge Court",
    moveInDate: "2021-02-14",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "ACH ••7741",
    standing: "current",
    daysPastDue: 0,
    boardRole: "Director",
  },
  {
    id: "own-015",
    displayName: "Nina Sharma",
    members: ["Nina Sharma"],
    email: "nina.sharma@example.com",
    phone: "(425) 555-0115",
    unit: "15",
    address: "1326 Mehr Gardens Lane",
    moveInDate: "2022-05-09",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "ACH ••3390",
    standing: "current",
    daysPastDue: 0,
  },
  {
    id: "own-058",
    displayName: "Mark & Elena Iancu",
    members: ["Mark Iancu", "Elena Iancu"],
    email: "iancu.home@example.com",
    phone: "(425) 555-0158",
    unit: "58",
    address: "1514 Alder Ridge Court",
    moveInDate: "2020-08-21",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "ACH ••5521",
    standing: "current",
    daysPastDue: 0,
  },
  {
    id: "own-078",
    displayName: "Ibrahim Haddad",
    members: ["Ibrahim Haddad"],
    email: "i.haddad@example.com",
    phone: "(425) 555-0178",
    unit: "78",
    address: "1610 Alder Ridge Court",
    moveInDate: "2024-03-22",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "Apple Pay",
    standing: "current",
    daysPastDue: 0,
  },
  {
    id: "own-084",
    displayName: "Tom & Jean Barrow",
    members: ["Tom Barrow", "Jean Barrow"],
    email: "barrows@example.com",
    phone: "(425) 555-0184",
    unit: "84",
    address: "1628 Alder Ridge Court",
    moveInDate: "2015-07-19",
    balanceCents: 0,
    autopay: true,
    autopayMethod: "ACH ••6603",
    standing: "current",
    daysPastDue: 0,
  },
  {
    id: "own-055",
    displayName: "Rhea Calloway",
    members: ["Rhea Calloway"],
    email: "r.calloway@example.com",
    phone: "(425) 555-0155",
    unit: "55",
    address: "1502 Mehr Gardens Lane",
    moveInDate: "2022-08-30",
    balanceCents: 85_500,
    autopay: false,
    standing: "late",
    daysPastDue: 62,
  },
  {
    id: "own-063",
    displayName: "Sandhill Property Holdings LLC",
    members: ["Sandhill Property Holdings LLC"],
    email: "ap@sandhillholdings.example.com",
    phone: "(206) 555-0163",
    unit: "63",
    address: "1544 Alder Ridge Court",
    moveInDate: "2023-01-10",
    balanceCents: 57_000,
    autopay: false,
    standing: "late",
    daysPastDue: 38,
    isCorporateOwner: true,
  },
  {
    id: "own-012",
    displayName: "Owen Brady",
    members: ["Owen Brady"],
    email: "owen.brady@example.com",
    phone: "(425) 555-0112",
    unit: "12",
    address: "1318 Mehr Gardens Lane",
    moveInDate: "2017-05-02",
    balanceCents: 29_400,
    autopay: false,
    standing: "grace",
    daysPastDue: 9,
  },
  {
    id: "own-026",
    displayName: "Gwen Halloran",
    members: ["Gwen Halloran"],
    email: "g.halloran@example.com",
    phone: "(425) 555-0126",
    unit: "26",
    address: "1372 Mehr Gardens Lane",
    moveInDate: "2016-10-08",
    balanceCents: 342_000,
    autopay: false,
    standing: "collections",
    daysPastDue: 214,
  },
  {
    id: "own-050",
    displayName: "Tessa Moreau",
    members: ["Tessa Moreau"],
    email: "t.moreau@example.com",
    phone: "(425) 555-0150",
    unit: "50",
    address: "1466 Mehr Gardens Lane",
    moveInDate: "2023-11-05",
    balanceCents: 31_900,
    autopay: false,
    standing: "grace",
    daysPastDue: 4,
  },
];

/* -------------------------------------------------------------------------- */
/* The rest of the community                                                   */
/*                                                                             */
/* The twelve records above are the ones the prototype tells stories about.    */
/* Mehr Gardens has 88 units, so the remaining households are generated          */
/* deterministically. No randomness, so the roster and every rate derived       */
/* from it read identically on every machine.                                   */
/* -------------------------------------------------------------------------- */

const FIRST = [
  "Alan", "Bianca", "Curtis", "Delia", "Emmett", "Fiona", "Gabriel", "Harriet",
  "Ibrahim", "Jolene", "Kwame", "Lucia", "Miles", "Noor", "Oscar", "Petra",
  "Quinn", "Rafael", "Simone", "Tobias", "Uma", "Vince", "Willa", "Xavier",
  "Yara", "Zane", "Adele", "Bruno", "Callie", "Devon", "Esme", "Felix",
  "Greta", "Hugo", "Imani", "Jonas", "Keiko", "Lars", "Mara", "Nico",
];

const LAST = [
  "Alvarez", "Bennett", "Castillo", "Dunlap", "Everly", "Fischer", "Guerra",
  "Holloway", "Ivers", "Jensen", "Koval", "Lund", "Mercer", "Novak", "Ortega",
  "Pruitt", "Quintero", "Rhodes", "Sorensen", "Tran", "Underwood", "Vance",
  "Whitaker", "Ybarra", "Zamora", "Ashford", "Brennan", "Cortez", "Duval",
  "Ellery", "Falk", "Grimaldi", "Hayes", "Ito", "Janssen", "Kirby",
];

const TAKEN = new Set(owners.map((o) => Number(o.unit)));

function fillerOwners(): Owner[] {
  const rows: Owner[] = [];
  for (let unit = 1; unit <= 88 && owners.length + rows.length < 88; unit++) {
    if (TAKEN.has(unit)) continue;
    const i = rows.length;
    const first = FIRST[(unit * 7 + i) % FIRST.length];
    const last = LAST[(unit * 3 + i * 5) % LAST.length];
    const name = `${first} ${last}`;
    // Roughly three quarters of the community pays automatically.
    const autopay = unit % 4 !== 0;
    rows.push({
      id: `own-${String(unit).padStart(3, "0")}`,
      displayName: name,
      members: [name],
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone: `(425) 555-${String(1000 + unit).slice(1)}`,
      unit: String(unit),
      address: `${1300 + unit * 4} ${unit % 2 ? "Mehr Gardens Lane" : "Alder Ridge Court"}`,
      moveInDate: `20${15 + (unit % 11)}-0${(unit % 9) + 1}-${String((unit % 27) + 1).padStart(2, "0")}`,
      balanceCents: 0,
      autopay,
      autopayMethod: autopay ? `ACH ••${2000 + unit}` : undefined,
      standing: "current",
      daysPastDue: 0,
    });
  }
  return rows;
}

owners.push(...fillerOwners());

export const currentOwner = owners.find((o) => o.id === CURRENT_OWNER_ID)!;

/** Board roster, derived. One source of truth for who holds a seat. */
export const boardMembers = owners.filter((o) => o.boardRole);
