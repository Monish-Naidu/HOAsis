import { describe, expect, it } from "vitest";
import { pinnedFirst } from "@/lib/announcements";

describe("announcement order", () => {
  it("puts pinned first, then newest first, and leaves the input alone", () => {
    const list = [
      { id: "a", pinned: false, postedDate: "2026-08-10" },
      { id: "b", pinned: true, postedDate: "2026-06-01" },
      { id: "c", pinned: false, postedDate: "2026-08-15" },
      { id: "d", pinned: true, postedDate: "2026-07-01" },
    ];
    expect(pinnedFirst(list).map((x) => x.id)).toEqual(["d", "b", "c", "a"]);
    expect(list.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});
