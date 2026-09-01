import { describe, expect, it } from "vitest";
import { invitePath, inviteUrl, parseInvitation } from "@/lib/invitations";

const COMMUNITY = "cedar-hollow-abcd";
const OWNER = "cedar-hollow-abcd-own-6";

function query(path: string) {
  return new URLSearchParams(path.slice(path.indexOf("?")));
}

describe("invitations", () => {
  it("round-trips a link back to the household it was issued for", () => {
    const parsed = parseInvitation(query(invitePath(COMMUNITY, OWNER)));
    expect(parsed).toEqual({ communityId: COMMUNITY, ownerId: OWNER, code: expect.any(String) });
  });

  it("rejects a link whose unit was swapped", () => {
    // The whole point: changing the owner in the address bar must not hand you
    // someone else's balance.
    const params = query(invitePath(COMMUNITY, OWNER));
    params.set("o", `${COMMUNITY}-own-1`);
    expect(parseInvitation(params)).toBeNull();
  });

  it("rejects a link pointed at another association", () => {
    const params = query(invitePath(COMMUNITY, OWNER));
    params.set("c", "mehr-meadows");
    expect(parseInvitation(params)).toBeNull();
  });

  it("rejects a missing or empty code", () => {
    const params = query(invitePath(COMMUNITY, OWNER));
    params.delete("k");
    expect(parseInvitation(params)).toBeNull();
    expect(parseInvitation(new URLSearchParams())).toBeNull();
  });

  it("is stable, so a link sent last week still opens", () => {
    expect(invitePath(COMMUNITY, OWNER)).toBe(invitePath(COMMUNITY, OWNER));
  });

  it("gives each household its own code", () => {
    const a = query(invitePath(COMMUNITY, `${COMMUNITY}-own-1`)).get("k");
    const b = query(invitePath(COMMUNITY, `${COMMUNITY}-own-2`)).get("k");
    expect(a).not.toBe(b);
  });

  it("builds an absolute link for pasting into an email", () => {
    expect(inviteUrl(COMMUNITY, OWNER, "https://expresshoa.app")).toMatch(
      /^https:\/\/expresshoa\.app\/join\?/,
    );
  });
});
