import { describe, expect, it } from "vitest";
import { pageNameFor } from "@/app/signin/page-name";

describe("pageNameFor", () => {
  it("names a resident page by its tab", () => {
    expect(pageNameFor("/resident/pay")).toBe("Pay");
    expect(pageNameFor("/resident/requests/REQ-2026-121?x=1")).toBe("Requests");
    expect(pageNameFor("/resident")).toBe("Home");
  });

  it("names a board page by its route", () => {
    expect(pageNameFor("/board")).toBe("Dashboard");
    expect(pageNameFor("/board/money")).toBeTruthy();
  });

  it("drops the association slug from a community link", () => {
    expect(pageNameFor("/c/willow-creek/resident/pay")).toBe("Pay");
    expect(pageNameFor("/c/willow-creek")).toBe("your association");
  });

  it("says nothing for a path it cannot name or a path off this site", () => {
    expect(pageNameFor(null)).toBeNull();
    expect(pageNameFor("")).toBeNull();
    expect(pageNameFor("https://evil.example")).toBeNull();
    expect(pageNameFor("/join?code=ABC123")).toBeNull();
    expect(pageNameFor("/resident/nowhere")).toBe("that page");
  });
});
