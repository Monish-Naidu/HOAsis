import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Community } from "@/lib/data/community";
import type { RemoteCommunitySummary } from "@/lib/data/remote";

/**
 * Files on a request: the demo lists name and size, a signed in association
 * puts the bytes in the bucket and then tells the request about each. The
 * shared fake has no Storage, so the upload is a small stand-in beside it.
 */

const fake = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof import("../helpers/fake-supabase").createFakeSupabase> }));
const uploads = vi.hoisted(() => ({
  made: [] as { path: string; type: string }[],
  /** A path ending in this fails to upload. */
  failing: null as string | null,
}));
const reads = vi.hoisted(() => ({ loadCommunity: vi.fn(), loadMyAssociations: vi.fn() }));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));
vi.mock("@/lib/supabase/client", async () => {
  const { createFakeSupabase: make } = await import("../helpers/fake-supabase");
  fake.current = make();
  return {
    supabaseBrowser: () => ({
      from: fake.current.client.from,
      rpc: fake.current.client.rpc,
      storage: {
        from: () => ({
          upload: async (path: string, _file: Blob, options: { contentType: string }) => {
            if (uploads.failing && path.endsWith(uploads.failing)) return { data: null, error: { message: "Upload refused" } };
            uploads.made.push({ path, type: options.contentType });
            return { data: { path }, error: null };
          },
        }),
      },
    }),
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/requests",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/data/remote", async (original) => ({
  ...(await original<typeof import("@/lib/data/remote")>()),
  loadCommunity: reads.loadCommunity,
  loadMyAssociations: reads.loadMyAssociations,
}));

type Store = typeof import("@/lib/data/remote-store");
type State = typeof import("@/lib/app-state");
let store: Store;
let app: State;
let fixture: Community;

const ME = "pat";
const ASSOCIATION = "assoc-1";
const REQUEST = "0b9d6c1e-6f0a-4c56-9d53-3f1f0a8d2c11";
const SUMMARY: RemoteCommunitySummary = {
  id: ASSOCIATION,
  name: "Maple Ridge",
  role: "president",
  capabilities: [],
  slug: "maple-ridge",
  isHome: true,
  place: "Bothell, WA",
};

beforeAll(async () => {
  vi.resetModules();
  store = await import("@/lib/data/remote-store");
  app = await import("@/lib/app-state");
  ({ mehrMeadows: fixture } = await import("@/lib/data/communities"));
});

const file = (name: string, type: string, size = 2048) => new File([new Uint8Array(size)], name, { type });

describe("attachFiles in the demo", () => {
  it("lists the file on the request with its name and size, and sends nothing anywhere", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <app.AppStateProvider>{children}</app.AppStateProvider>;
    const { result } = renderHook(() => app.useAppState(), { wrapper });
    const target = result.current.requests[0];
    let ok = false;
    await act(async () => {
      ok = await result.current.attachFiles(target.id, [
        file("leak.jpg", "image/jpeg", 2.5 * 1048576),
        file("notes.exe", "application/x-msdownload"),
      ]);
    });
    const after = result.current.requests.find((r) => r.id === target.id)!;
    expect(after.attachments.slice(target.attachments.length)).toMatchObject([{ name: "leak.jpg", size: "2.5 MB" }]);
    // The second file could not go, so the answer is that not everything was saved.
    expect(ok).toBe(false);
    expect(uploads.made).toEqual([]);
  });
});

describe("attachFiles signed in", () => {
  beforeEach(async () => {
    uploads.made = [];
    uploads.failing = null;
    fake.current.reset();
    const community: Community = {
      ...fixture,
      id: ASSOCIATION,
      accounts: fixture.accounts.map((a) => (a.role === "president" ? { ...a, id: ME } : a)),
    };
    reads.loadMyAssociations.mockResolvedValue([SUMMARY]);
    reads.loadCommunity.mockImplementation(async () => community);
    await store.loadRemote(null);
    await store.loadRemote(ME);
    fake.current.reset();
  });

  const render = () =>
    renderHook(() => app.useAppState(), {
      wrapper: ({ children }: { children: ReactNode }) => <app.AppStateProvider>{children}</app.AppStateProvider>,
    });

  it("uploads each file under the request, then tells the request about it", async () => {
    const { result } = render();
    let ok = false;
    await act(async () => {
      ok = await result.current.attachFiles(REQUEST, [file("Leak.JPG", "image/jpeg"), file("quote.pdf", "application/pdf", 4096)]);
    });

    expect(ok).toBe(true);
    expect(uploads.made.map((u) => u.type)).toEqual(["image/jpeg", "application/pdf"]);
    for (const u of uploads.made) expect(u.path).toMatch(new RegExp(`^${ASSOCIATION}/requests/${REQUEST}/[a-z0-9]+-`));
    const told = fake.current.callsTo("rpc:add_request_attachment");
    expect(told.map((c) => c.args[1])).toMatchObject([
      { p_request_id: REQUEST, p_name: "Leak.JPG", p_size_bytes: 2048, p_path: uploads.made[0].path },
      { p_request_id: REQUEST, p_name: "quote.pdf", p_size_bytes: 4096, p_path: uploads.made[1].path },
    ]);
  });

  it("skips a file that cannot go and keeps going when one upload fails", async () => {
    uploads.failing = "bad.png";
    const { result } = render();
    let ok = true;
    await act(async () => {
      ok = await result.current.attachFiles(REQUEST, [
        file("huge.pdf", "application/pdf", 11 * 1048576),
        file("bad.png", "image/png"),
        file("good.png", "image/png"),
      ]);
    });

    expect(ok).toBe(false);
    // Only the one that uploaded was told to the request.
    const told = fake.current.callsTo("rpc:add_request_attachment");
    expect(told).toHaveLength(1);
    expect(told[0].args[1]).toMatchObject({ p_name: "good.png" });
  });
});
