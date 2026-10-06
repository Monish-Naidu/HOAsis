import { describe, expect, it } from "vitest";
import {
  addressLabel,
  boardOffices,
  boardSignature,
  isMine,
  officeChoiceLabel,
  unansweredByAddress,
} from "@/lib/board-offices";
import { officeRecipients, type OfficeSeat } from "@/lib/email/office-message";
import type { MessageThread } from "@/lib/types";

const accounts = [
  { name: "Arya Mehr", role: "president" as const },
  { name: "Dana Whitcomb", role: "treasurer" as const },
  { name: "Owen Brady", role: "resident" as const },
];

describe("boardOffices", () => {
  it("lists the four offices in order with who holds each and what it handles", () => {
    const offices = boardOffices(accounts);
    expect(offices.map((o) => o.label)).toEqual(["President", "Vice President", "Treasurer", "Secretary"]);
    expect(offices.map((o) => o.holder)).toEqual(["Arya Mehr", null, "Dana Whitcomb", null]);
    expect(offices[0].handles).toBe("Anything, and the final say.");
    expect(offices[1].handles).toBe("Steps in when the President is away.");
    expect(offices[2].handles).toBe("Dues, payments and the budget.");
    expect(offices[3].handles).toBe("Records, minutes and meetings.");
  });

  it("never lists a resident as holding an office", () => {
    expect(boardOffices([{ name: "Owen Brady", role: "resident" }]).every((o) => o.holder === null)).toBe(true);
  });

  it("words a choice with the holder, or says nobody holds it", () => {
    const [president, vice] = boardOffices(accounts);
    expect(officeChoiceLabel(president)).toBe("President, Arya Mehr");
    expect(officeChoiceLabel(vice)).toBe("Vice President, nobody holds this office yet");
  });
});

describe("the Mine filter", () => {
  it("keeps what is addressed to the viewer's office and to the board", () => {
    expect(isMine({ toRole: "treasurer" }, "treasurer")).toBe(true);
    expect(isMine({ toRole: "board" }, "treasurer")).toBe(true);
    expect(isMine({ toRole: "secretary" }, "treasurer")).toBe(false);
  });

  it("gives a seat with no office only the board's", () => {
    expect(isMine({ toRole: "board" }, "resident")).toBe(true);
    expect(isMine({ toRole: "president" }, "resident")).toBe(false);
    expect(isMine({ toRole: "president" }, undefined)).toBe(false);
  });
});

describe("unanswered counts", () => {
  const thread = (toRole: MessageThread["toRole"], last: "resident" | "board") => ({
    toRole,
    messages: [{ fromRole: last }] as MessageThread["messages"],
  });
  it("counts threads whose last word is the owner's, per address", () => {
    const counts = unansweredByAddress([
      thread("treasurer", "resident"),
      thread("treasurer", "board"),
      thread("board", "resident"),
      thread("secretary", "resident"),
      thread("treasurer", "resident"),
    ]);
    expect(counts).toEqual({ board: 1, president: 0, "vice-president": 0, treasurer: 2, secretary: 1 });
  });
});

describe("addresses and signatures", () => {
  it("names an address for a label", () => {
    expect(addressLabel("board")).toBe("The board");
    expect(addressLabel("vice-president")).toBe("Vice President");
  });

  it("signs with the name and office, or as the board", () => {
    expect(boardSignature("Dana Whitcomb", "treasurer")).toBe("Dana Whitcomb, Treasurer, for the board");
    expect(boardSignature("Dana Whitcomb", null)).toBe("Dana Whitcomb, for the board");
    expect(boardSignature(undefined, null)).toBe("The board");
  });
});

describe("who is emailed", () => {
  const seat = (over: Partial<OfficeSeat>): OfficeSeat => ({
    full_name: "Someone",
    profile_id: null,
    invited_email: null,
    role: "resident",
    capabilities: [],
    ...over,
  });
  const seats: OfficeSeat[] = [
    seat({ full_name: "Arya", profile_id: "p1", role: "president", capabilities: ["communications"] }),
    seat({ full_name: "Dana", profile_id: "p2", role: "treasurer", capabilities: ["finances"] }),
    seat({ full_name: "Sofia", profile_id: "p3", role: "secretary", capabilities: ["communications"] }),
    seat({ full_name: "Vic", profile_id: null, role: "vice-president", invited_email: null, capabilities: [] }),
  ];
  const emails = new Map([
    ["p1", "arya@example.com"],
    ["p2", "dana@example.com"],
    ["p3", "sofia@example.com"],
  ]);

  it("goes to the holder of the addressed office", () => {
    const { office, people } = officeRecipients("treasurer", seats, emails);
    expect(office).toBe(true);
    expect(people.map((p) => p.email)).toEqual(["dana@example.com"]);
  });

  it("goes to the communications holders when written to the board", () => {
    const { office, people } = officeRecipients("board", seats, emails);
    expect(office).toBe(false);
    expect(people.map((p) => p.email)).toEqual(["arya@example.com", "sofia@example.com"]);
  });

  it("falls back to the communications holders when nobody reachable holds the office", () => {
    const { office, people } = officeRecipients("vice-president", seats, emails);
    expect(office).toBe(false);
    expect(people.map((p) => p.email)).toEqual(["arya@example.com", "sofia@example.com"]);
  });
});
