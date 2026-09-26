import { describe, expect, it } from "vitest";
import {
  communityPath,
  communityUrl,
  landingFor,
  parseCommunityPath,
  normalizeAssociationName,
  placeLabel,
  sameAssociationName,
  slugFromHost,
  slugify,
  uniqueSlug,
} from "@/lib/community-links";

describe("slugify", () => {
  it("lowercases, hyphenates and trims", () => {
    expect(slugify("Oakview Commons HOA")).toBe("oakview-commons-hoa");
    expect(slugify("  The Meadows at Mehr, Phase II ")).toBe("the-meadows-at-mehr-phase-ii");
    expect(slugify("Cedar--Hollow")).toBe("cedar-hollow");
    expect(slugify("Ünïcode Estates")).toBe("n-code-estates");
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("takes the clean form when it is free", () => {
    expect(uniqueSlug("Oakview Commons", [])).toBe("oakview-commons");
  });

  it("suffixes from 2 on collision, and keeps counting", () => {
    expect(uniqueSlug("Oakview Commons", ["oakview-commons"])).toBe("oakview-commons-2");
    expect(uniqueSlug("Oakview Commons", ["oakview-commons", "oakview-commons-2"])).toBe(
      "oakview-commons-3",
    );
  });

  it("never hands out a reserved word or an empty slug", () => {
    expect(uniqueSlug("Board", [])).toBe("board-hoa");
    expect(uniqueSlug("www", [])).toBe("www-hoa");
    expect(uniqueSlug("???", [])).toBe("community");
    expect(uniqueSlug("???", ["community"])).toBe("community-2");
  });

  it("caps the base at 48 characters before the suffix", () => {
    const long = "A".repeat(80);
    expect(uniqueSlug(long, []).length).toBe(48);
    expect(uniqueSlug(long, ["a".repeat(48)])).toBe(`${"a".repeat(48)}-2`);
  });
});

describe("slugFromHost", () => {
  it("reads the label in front of a vanity root", () => {
    expect(slugFromHost("oakview-commons.yourhoasis.com")).toBe("oakview-commons");
    expect(slugFromHost("Oakview-Commons.yourhoasis.com:443")).toBe("oakview-commons");
    expect(slugFromHost("cedar-hollow.localhost:3000")).toBe("cedar-hollow");
  });

  it("gives null for the site itself and anything that is not an association", () => {
    expect(slugFromHost("yourhoasis.com")).toBeNull();
    expect(slugFromHost("www.yourhoasis.com")).toBeNull();
    expect(slugFromHost("api.yourhoasis.com")).toBeNull();
    expect(slugFromHost("localhost:3000")).toBeNull();
    expect(slugFromHost("a.b.yourhoasis.com")).toBeNull();
    expect(slugFromHost("your-hoasis-abc.vercel.app")).toBeNull();
    expect(slugFromHost(null)).toBeNull();
  });
});

describe("community paths", () => {
  it("builds and parses the canonical form", () => {
    expect(communityPath("oakview-commons")).toBe("/c/oakview-commons");
    expect(communityPath("oakview-commons", "/board/settings")).toBe("/c/oakview-commons/board/settings");
    expect(communityPath("oakview-commons", "resident/pay")).toBe("/c/oakview-commons/resident/pay");
    expect(communityUrl("https://yourhoasis.com/", "oakview-commons", "/resident")).toBe(
      "https://yourhoasis.com/c/oakview-commons/resident",
    );
    expect(parseCommunityPath("/c/oakview-commons/board/settings")).toEqual({
      slug: "oakview-commons",
      path: "/board/settings",
    });
    expect(parseCommunityPath("/c/oakview-commons")).toEqual({ slug: "oakview-commons", path: "" });
    expect(parseCommunityPath("/board")).toEqual({ slug: null, path: "/board" });
    expect(parseCommunityPath("/c/Not%20A%20Slug/board")).toEqual({ slug: null, path: "/c/Not%20A%20Slug/board" });
  });

  it("lands on the shell that fits the role when no page is named", () => {
    expect(landingFor("", "president")).toBe("/board");
    expect(landingFor("", "resident")).toBe("/resident");
    expect(landingFor("/resident/pay", "president")).toBe("/resident/pay");
    expect(landingFor("/signin", "resident")).toBe("/resident");
  });
});

describe("normalizeAssociationName", () => {
  it("ignores case and runs of whitespace, and trims", () => {
    expect(normalizeAssociationName("  Maple   Ridge\tHOA ")).toBe("maple ridge hoa");
    expect(normalizeAssociationName("MAPLE RIDGE HOA")).toBe("maple ridge hoa");
    expect(normalizeAssociationName("")).toBe("");
    expect(normalizeAssociationName("   ")).toBe("");
  });

  it("keeps punctuation, since Maple Ridge and Maple-Ridge are different names", () => {
    expect(normalizeAssociationName("Maple-Ridge")).toBe("maple-ridge");
    expect(normalizeAssociationName("Maple Ridge")).not.toBe(normalizeAssociationName("Maple-Ridge"));
  });
});

describe("sameAssociationName", () => {
  it("matches the same name in different clothes", () => {
    expect(sameAssociationName("Maple Ridge", "maple  ridge")).toBe(true);
    expect(sameAssociationName("Maple Ridge", " MAPLE RIDGE ")).toBe(true);
  });

  it("never matches an empty name, and not a different one", () => {
    expect(sameAssociationName("", "")).toBe(false);
    expect(sameAssociationName("  ", "Maple Ridge")).toBe(false);
    expect(sameAssociationName("Maple Ridge", "Maple Ridge II")).toBe(false);
  });
});

describe("placeLabel", () => {
  it("joins what is known", () => {
    expect(placeLabel("Bothell", "WA")).toBe("Bothell, WA");
    expect(placeLabel("", "WA")).toBe("WA");
    expect(placeLabel(null, undefined)).toBe("");
  });
});
