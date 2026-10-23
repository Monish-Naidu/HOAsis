import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";

/**
 * The home an emailed link names (?home=) wins over the home this browser
 * last had open, but only when it is one of the person's own seats: an id
 * that belongs to somebody else's home is ignored, so a mistyped or guessed
 * link cannot switch what the portal shows. The shell's own behavior is what
 * is tested; its furniture is stubbed away.
 */

const chooseHome = vi.fn();
let mySeats: { homeId: string }[] = [];

vi.mock("next/navigation", () => ({ usePathname: () => "/resident/pay" }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    createElement("a", { href }, children),
}));
vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({
    settings: { displayName: "Willow Creek Estates" },
    community: { id: "assoc-1" },
    mySeats,
    chooseHome,
  }),
  useCurrentHome: () => ({ id: "u-1", members: ["Nadia Bell"], unit: "115", address: "" }),
}));
vi.mock("@/lib/wording", () => ({ homeLabel: (_c: unknown, unit: string) => unit }));
vi.mock("@/lib/modules", () => ({ moduleOn: () => false }));
vi.mock("@/components/app/notifications", () => ({ ResidentBell: () => null }));
vi.mock("@/components/app/search-palette", () => ({
  SearchButton: () => null,
  SearchPalette: () => null,
}));
vi.mock("@/components/app/theme", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/app/logo", () => ({ Wordmark: () => null }));
vi.mock("@/components/app/rail", () => ({
  Rail: () => null,
  RailNav: () => null,
  RailRow: () => null,
}));
vi.mock("@/components/app/resident-nav", () => ({
  residentBarTabs: () => [],
  residentModuleFor: () => null,
  residentMoreRows: () => [],
  residentRailRows: () => [],
  residentSectionFor: () => null,
  residentTabs: [],
  visibleResidentTabs: () => [],
}));
vi.mock("@/components/app/resident-section-tabs", () => ({ ResidentSectionTabs: () => null }));
vi.mock("@/components/app/resident-badges", () => ({ useResidentBadges: () => ({}) }));
vi.mock("@/components/app/module-gate", () => ({ ModuleOff: () => null }));
vi.mock("@/components/app/page-transition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/app/account-menu", () => ({
  AccountMenu: () => null,
  RequireSession: () => null,
  ViewSwitcher: () => null,
}));
vi.mock("@/components/app/community-hero", () => ({
  CommunityHero: () => null,
  CommunityName: () => null,
  PhotoStrip: () => null,
}));
vi.mock("@/components/app/home-switcher", () => ({ HomeSwitcher: () => null }));
vi.mock("@/components/app/home-badge", () => ({ HomeBadge: () => null }));
vi.mock("@/components/app/local-copy-banner", () => ({ DemoBanner: () => null }));

const { ResidentShell } = await import("@/components/app/resident-shell");

function renderShellAt(url: string) {
  window.history.pushState({}, "", url);
  return render(createElement(ResidentShell, null, createElement("p", null, "the page")));
}

beforeEach(() => {
  mySeats = [{ homeId: "u-1" }, { homeId: "u-2" }];
});

afterEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/resident/pay");
});

describe("the home an emailed link names", () => {
  it("opens the home the link names when it is one of theirs", async () => {
    renderShellAt("/resident/pay?home=u-2");

    await waitFor(() => expect(chooseHome).toHaveBeenCalledWith("u-2"));
  });

  // Effects have flushed by the time render returns, so a wrong call would
  // already have happened.
  it("ignores a home id that is not theirs", () => {
    renderShellAt("/resident/pay?home=u-9");

    expect(chooseHome).not.toHaveBeenCalled();
  });

  it("leaves the remembered home alone when the link names none", () => {
    renderShellAt("/resident/pay");

    expect(chooseHome).not.toHaveBeenCalled();
  });
});
