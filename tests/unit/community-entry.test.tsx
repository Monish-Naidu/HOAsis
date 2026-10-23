import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";

/**
 * An emailed link carries its whole address: the association, the page and
 * the home it is about. The community entry turns that address into the
 * right association and keeps the query string through the sign-in
 * hand-off, so a bill for one home cannot land on whichever home or
 * association this browser last had open.
 */

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

let auth: { loading: boolean; user: { id: string } | null } = {
  loading: false,
  user: { id: "profile-1" },
};
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));

let remote: { status: string; associations: { slug: string; role: string }[] } = {
  status: "ready",
  associations: [{ slug: "willow-creek", role: "resident" }],
};
const setRemoteAssociationBySlug = vi.fn<
  (slug: string) => Promise<"switched" | "already" | "not-a-member" | "not-ready">
>(async () => "switched");
const preferRemoteSlug = vi.fn();
vi.mock("@/lib/data/remote-store", () => ({
  useRemote: () => remote,
  setRemoteAssociationBySlug: (slug: string) => setRemoteAssociationBySlug(slug),
  preferRemoteSlug: (slug: string) => preferRemoteSlug(slug),
}));

vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({ communities: [], setCommunity: vi.fn() }),
}));

vi.mock("@/lib/supabase/env", () => ({ hasSupabase: true }));

const { CommunityEntry } = await import("@/components/app/community-entry");

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ found: "willow-creek" }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  auth = { loading: false, user: { id: "profile-1" } };
  remote = { status: "ready", associations: [{ slug: "willow-creek", role: "resident" }] };
});

describe("the home an emailed bill names", () => {
  it("keeps the home query through sign-in when nobody is signed in", async () => {
    auth = { loading: false, user: null };
    render(
      createElement(CommunityEntry, {
        slug: "willow-creek",
        path: "/resident/pay",
        search: "?home=u-1",
      }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(preferRemoteSlug).toHaveBeenCalledWith("willow-creek");
    expect(replace).toHaveBeenCalledWith(
      `/signin?next=${encodeURIComponent("/c/willow-creek/resident/pay?home=u-1")}`,
    );
  });

  it("lands a signed in member on the linked page, home query intact", async () => {
    render(
      createElement(CommunityEntry, {
        slug: "willow-creek",
        path: "/resident/pay",
        search: "?home=u-1",
      }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(setRemoteAssociationBySlug).toHaveBeenCalledWith("willow-creek");
    expect(replace).toHaveBeenCalledWith("/resident/pay?home=u-1");
  });

  it("sends a signed in stranger to join, never to the home", async () => {
    setRemoteAssociationBySlug.mockResolvedValueOnce("not-a-member");
    render(
      createElement(CommunityEntry, {
        slug: "willow-creek",
        path: "/resident/pay",
        search: "?home=u-1",
      }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/join?community=willow-creek");
  });
});
