import { describe, expect, it } from "vitest";
import { joinNoticeRecipients } from "@/lib/email/join-request";
import { joinRequestEmail } from "@/lib/email/templates";

/**
 * The notice that tells the board somebody is at the door: who receives it
 * (every officer who can manage homeowners, once per address) and what it
 * says (the person, their address, the home they claim, and the one page
 * where the request is answered).
 */

const input = {
  associationName: "Willow Creek Estates",
  officerName: "Grace Okafor",
  requesterName: "Nadia Bell",
  requesterEmail: "nadia@example.com",
  unitLabel: "115 Willow Creek Dr",
  note: "Closed last week",
  url: "https://yourhoasis.com/c/willow-creek/board/homeowners?token_hash=t&type=magiclink&next=/c/willow-creek/board/homeowners",
};

function links(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

describe("who hears about a join request", () => {
  const seat = {
    full_name: "Dana Whitcomb",
    profile_id: "p-1",
    invited_email: "dana@old.example",
    capabilities: ["settings"],
  };

  it("is every current seat that holds settings, at the account's own address", () => {
    const people = joinNoticeRecipients(
      [
        seat,
        {
          full_name: "Arya Mehr",
          profile_id: "p-2",
          invited_email: null,
          capabilities: ["settings", "finances"],
        },
      ],
      new Map([
        ["p-1", "dana@example.com"],
        ["p-2", "arya@example.com"],
      ]),
    );
    expect(people).toEqual([
      { name: "Dana Whitcomb", email: "dana@example.com", profileId: "p-1" },
      { name: "Arya Mehr", email: "arya@example.com", profileId: "p-2" },
    ]);
  });

  it("leaves out a seat without the settings capability", () => {
    // A default treasurer sees Homeowners but cannot let anybody in, so the
    // notice is not theirs to act on.
    const people = joinNoticeRecipients(
      [
        { ...seat, capabilities: ["finances", "vendors"] },
        { ...seat, capabilities: null },
        { ...seat, capabilities: [] },
      ],
      new Map([["p-1", "dana@example.com"]]),
    );
    expect(people).toEqual([]);
  });

  it("falls back to the address on the roster, and skips a seat with none", () => {
    const people = joinNoticeRecipients(
      [
        {
          full_name: "Lee Park",
          profile_id: null,
          invited_email: " lee@example.com ",
          capabilities: ["settings"],
        },
        {
          full_name: "No Address",
          profile_id: null,
          invited_email: null,
          capabilities: ["settings"],
        },
      ],
      new Map(),
    );
    expect(people).toEqual([{ name: "Lee Park", email: "lee@example.com", profileId: null }]);
  });

  it("writes to one address once, however many seats share it", () => {
    const people = joinNoticeRecipients(
      [seat, { ...seat, full_name: "Dana W", profile_id: null, invited_email: "DANA@example.com" }],
      new Map([["p-1", "dana@example.com"]]),
    );
    expect(people).toHaveLength(1);
  });
});

describe("joinRequestEmail", () => {
  it("names the person in the subject and carries their address and home", () => {
    const built = joinRequestEmail(input);
    expect(built.subject).toBe("Nadia Bell asked to join Willow Creek Estates");
    expect(built.html).toContain("Nadia Bell (nadia@example.com)");
    expect(built.html).toContain("They say their home is 115 Willow Creek Dr.");
    expect(built.html).toContain('They wrote: "Closed last week"');
    expect(built.text).toContain("Nadia Bell (nadia@example.com)");
    expect(built.text).toContain("115 Willow Creek Dr");
  });

  it("has one link, straight to Homeowners, and says what the board does there", () => {
    const built = joinRequestEmail(input);
    expect(links(built.html)).toEqual([input.url]);
    expect(built.html).toContain("Review their request");
    // A magic link signs the officer in, so the footer line is the honest one.
    expect(built.html).toContain("This link signs you in");
  });

  it("says nothing about a home or a note the person did not give", () => {
    const built = joinRequestEmail({ ...input, unitLabel: " ", note: " " });
    expect(built.html).not.toContain("They say their home is");
    expect(built.html).not.toContain("They wrote");
  });

  it("escapes the names it was given, in the body and the note", () => {
    const built = joinRequestEmail({
      ...input,
      associationName: "Smith & Sons <HOA>",
      requesterName: 'Nadia "Spike" Bell',
      note: "We closed on the <condo> & moved in",
    });
    expect(built.subject).toBe('Nadia "Spike" Bell asked to join Smith & Sons <HOA>');
    expect(built.html).toContain("Smith &amp; Sons &lt;HOA&gt;");
    expect(built.html).toContain("Nadia &quot;Spike&quot; Bell");
    expect(built.html).toContain("We closed on the &lt;condo&gt; &amp; moved in");
    expect(built.html).not.toContain("<condo>");
  });

  it("keeps a name with line breaks out of the subject", () => {
    const built = joinRequestEmail({ ...input, requesterName: "Nadia\nBell" });
    expect(built.subject).toBe("Nadia Bell asked to join Willow Creek Estates");
  });
});
