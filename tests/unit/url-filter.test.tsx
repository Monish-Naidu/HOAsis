import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/board/homeowners",
  useSearchParams: () => new URLSearchParams(search),
}));

const { readFilter, withFilter, useUrlFilter, useUrlClear } = await import("@/lib/url-filter");

const FILTERS = ["all", "paid-up", "past-due"] as const;

describe("readFilter", () => {
  it("takes an allowed value, falls back on an unknown or missing one", () => {
    expect(readFilter("past-due", FILTERS, "all")).toBe("past-due");
    expect(readFilter("nonsense", FILTERS, "all")).toBe("all");
    expect(readFilter(null, FILTERS, "all")).toBe("all");
  });

  it("accepts any text when nothing is listed, for a search box", () => {
    expect(readFilter("smith", null, "")).toBe("smith");
  });
});

describe("withFilter", () => {
  it("sets a key and keeps the others", () => {
    expect(withFilter("q=smith", "filter", "past-due", "all")).toBe("q=smith&filter=past-due");
  });

  it("removes the key when the value is the default, so a clean link stays clean", () => {
    expect(withFilter("filter=past-due&q=smith", "filter", "all", "all")).toBe("q=smith");
    expect(withFilter("q=smith", "q", "", "")).toBe("");
  });
});

describe("useUrlFilter", () => {
  it("reads the value from the URL", () => {
    search = "filter=paid-up";
    const { result } = renderHook(() => useUrlFilter("filter", FILTERS, "all"));
    expect(result.current[0]).toBe("paid-up");
  });

  it("falls back for a value that is not allowed", () => {
    search = "filter=weird";
    const { result } = renderHook(() => useUrlFilter("filter", FILTERS, "all"));
    expect(result.current[0]).toBe("all");
  });

  it("writes the choice to the URL with replace, keeping other params, and shows it at once", () => {
    search = "q=smith";
    replace.mockClear();
    const { result } = renderHook(() => useUrlFilter("filter", FILTERS, "all"));
    act(() => result.current[1]("past-due"));
    expect(replace).toHaveBeenCalledWith("/board/homeowners?q=smith&filter=past-due", { scroll: false });
    expect(result.current[0]).toBe("past-due");
  });

  it("drops the param when the default is chosen", () => {
    search = "filter=past-due";
    replace.mockClear();
    const { result } = renderHook(() => useUrlFilter("filter", FILTERS, "all"));
    act(() => result.current[1]("all"));
    expect(replace).toHaveBeenCalledWith("/board/homeowners", { scroll: false });
  });

  it("follows the URL when it changes underneath", () => {
    search = "filter=paid-up";
    const { result, rerender } = renderHook(() => useUrlFilter("filter", FILTERS, "all"));
    search = "filter=past-due";
    rerender();
    expect(result.current[0]).toBe("past-due");
  });
});

describe("useUrlClear", () => {
  it("removes several keys in one write", () => {
    search = "status=needs-review&category=Repairs&period=this-year";
    replace.mockClear();
    const { result } = renderHook(() => useUrlClear());
    act(() => result.current(["status", "category"]));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/board/homeowners?period=this-year", { scroll: false });
  });
});
