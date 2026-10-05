import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Community } from "@/lib/data/community";
import type { RemoteCommunitySummary } from "@/lib/data/remote";

/**
 * The store a signed in person's association lives in.
 *
 * Every read in it crosses the network, and answers come back in whatever
 * order they like. These drive the reads by hand, resolving each one when
 * the test says, to prove that a late answer never lands over a newer one,
 * that a failure is left in the state where a screen can show it, and that a
 * write the database quietly matched to nothing is reported as refused.
 */

const reads = vi.hoisted(() => ({
  loadCommunity: vi.fn(),
  loadMyAssociations: vi.fn(),
}));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));

vi.mock("@/lib/supabase/client", () => {
  // Stands in for every query the store makes itself: the seat claim, the
  // skipped setup tasks, and the best-effort note of where to land.
  const rows = () => {
    const builder: Record<string, unknown> = {
      then: (done: (value: { data: never[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(done),
    };
    for (const method of ["select", "eq", "update"]) builder[method] = () => builder;
    return builder;
  };
  return {
    supabaseBrowser: () => ({ rpc: async () => ({ data: null, error: null }), from: rows }),
  };
});

vi.mock("@/lib/data/remote", async (original) => ({
  ...(await original<typeof import("@/lib/data/remote")>()),
  loadCommunity: reads.loadCommunity,
  loadMyAssociations: reads.loadMyAssociations,
}));

// The suite's setup file has already loaded the store against the real,
// unconfigured environment, so it is loaded afresh here, after the doubles
// above are in place.
type Store = typeof import("@/lib/data/remote-store");
let loadRemote: Store["loadRemote"];
let preferRemoteSlug: Store["preferRemoteSlug"];
let refreshRemote: Store["refreshRemote"];
let remoteSnapshot: Store["remoteSnapshot"];
let remoteWrite: Store["remoteWrite"];
let retryRemote: Store["retryRemote"];
let setRemoteAssociation: Store["setRemoteAssociation"];
let subscribeRemoteErrors: Store["subscribeRemoteErrors"];

beforeAll(async () => {
  vi.resetModules();
  ({
    loadRemote,
    preferRemoteSlug,
    refreshRemote,
    remoteSnapshot,
    remoteWrite,
    retryRemote,
    setRemoteAssociation,
    subscribeRemoteErrors,
  } = await import("@/lib/data/remote-store"));
});

const summary = (id: string, name: string): RemoteCommunitySummary => ({
  id,
  name,
  role: "president",
  capabilities: [],
  slug: `${id}-slug`,
  isHome: false,
  place: "Bothell, WA",
});

const MAPLE = summary("maple", "Maple Ridge");
const OAK = summary("oak", "Oak Hills");

/** A community is opaque to the store, so a labelled stub is enough. */
const copy = (id: string, version: string) => ({ id, label: `${id} ${version}` }) as unknown as Community;

/** A read the test resolves when it chooses. */
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Signed in as `who`, with Maple Ridge open and Oak Hills on the list. */
async function signedIn(who = "pat") {
  reads.loadMyAssociations.mockResolvedValue([MAPLE, OAK]);
  reads.loadCommunity.mockResolvedValueOnce(copy("maple", "first"));
  await loadRemote(who);
  expect(remoteSnapshot()).toMatchObject({ status: "ready", activeId: "maple", profileId: who });
}

beforeEach(async () => {
  reads.loadCommunity.mockReset();
  reads.loadMyAssociations.mockReset();
  preferRemoteSlug(null);
  await loadRemote(null);
  expect(remoteSnapshot().status).toBe("signed-out");
});

describe("a read that comes back late", () => {
  it("does not put the association just left under the new one's name", async () => {
    await signedIn();
    // A write in Maple Ridge kicks off a refresh, which is slow.
    const slow = pending<Community>();
    reads.loadCommunity.mockReturnValueOnce(slow.promise);
    const refresh = refreshRemote();

    // Meanwhile the member switches to Oak Hills, and that load lands.
    const oak = copy("oak", "first");
    reads.loadCommunity.mockResolvedValueOnce(oak);
    await setRemoteAssociation("oak");

    slow.resolve(copy("maple", "after the write"));
    await refresh;

    expect(remoteSnapshot().activeId).toBe("oak");
    expect(remoteSnapshot().community).toBe(oak);
  });

  it("does not put a member's association back after they sign out", async () => {
    await signedIn();
    const slow = pending<Community>();
    reads.loadCommunity.mockReturnValueOnce(slow.promise);
    const refresh = refreshRemote();

    await loadRemote(null);
    slow.resolve(copy("maple", "after sign-out"));
    await refresh;

    expect(remoteSnapshot()).toMatchObject({
      status: "signed-out",
      community: null,
      activeId: null,
      profileId: null,
      associations: [],
    });
  });

  it("keeps the newer of two refreshes when the older one lands last", async () => {
    await signedIn();
    const first = pending<Community>();
    const second = pending<Community>();
    reads.loadCommunity.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = refreshRemote();
    const two = refreshRemote();

    const newer = copy("maple", "both writes");
    second.resolve(newer);
    await two;
    first.resolve(copy("maple", "first write only"));
    await one;

    expect(remoteSnapshot().community).toBe(newer);
  });

  it("lands both of two refreshes that come back in order", async () => {
    await signedIn();
    const first = pending<Community>();
    const second = pending<Community>();
    reads.loadCommunity.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const one = refreshRemote();
    const two = refreshRemote();

    const older = copy("maple", "first write only");
    first.resolve(older);
    await one;
    expect(remoteSnapshot().community).toBe(older);

    const newer = copy("maple", "both writes");
    second.resolve(newer);
    await two;
    expect(remoteSnapshot().community).toBe(newer);
  });

  it("lets a refresh through while a load is under way, and the load still finishes", async () => {
    // The guard that drops stale reads must not also strand a load: a
    // refresh shares no counter with it, so the screen leaves "loading".
    await signedIn();
    const slowLoad = pending<Community>();
    reads.loadCommunity.mockReturnValueOnce(slowLoad.promise);
    const load = loadRemote("pat");
    await vi.waitFor(() => expect(reads.loadCommunity).toHaveBeenCalledTimes(2));
    expect(remoteSnapshot().status).toBe("loading");

    reads.loadCommunity.mockResolvedValue(copy("maple", "refreshed"));
    await refreshRemote();
    slowLoad.resolve(copy("maple", "loaded"));
    await load;

    expect(remoteSnapshot().status).toBe("ready");
    // A write landed while the load was reading, so it reads once more.
    await vi.waitFor(() => expect(reads.loadCommunity).toHaveBeenCalledTimes(4));
    await vi.waitFor(() => expect(remoteSnapshot().community).toMatchObject({ label: "maple refreshed" }));
  });

  it("drops a load that a sign-out overtook", async () => {
    const slow = pending<RemoteCommunitySummary[]>();
    reads.loadMyAssociations.mockReturnValueOnce(slow.promise);
    const load = loadRemote("pat");
    await loadRemote(null);
    slow.resolve([MAPLE]);
    await load;

    expect(remoteSnapshot().status).toBe("signed-out");
    expect(reads.loadCommunity).not.toHaveBeenCalled();
  });

  it("starts a different person from nothing", async () => {
    await signedIn("pat");
    const slow = pending<RemoteCommunitySummary[]>();
    reads.loadMyAssociations.mockReturnValueOnce(slow.promise);
    const load = loadRemote("sam");

    // While Sam's list is on its way, none of Pat's is in memory.
    expect(remoteSnapshot()).toMatchObject({
      status: "loading",
      profileId: "sam",
      associations: [],
      community: null,
      activeId: null,
    });

    slow.resolve([]);
    await load;
    expect(remoteSnapshot().status).toBe("empty");
  });
});

describe("a load that fails", () => {
  it("says so in the state and keeps who was asking", async () => {
    reads.loadMyAssociations.mockRejectedValueOnce(new Error("Could not load your associations: timeout"));
    await loadRemote("pat");

    expect(remoteSnapshot()).toMatchObject({
      status: "error",
      message: "Could not load your associations: timeout",
      profileId: "pat",
    });
  });

  it("can be asked again without signing in a second time", async () => {
    reads.loadMyAssociations.mockRejectedValueOnce(new Error("timeout"));
    await loadRemote("pat");
    expect(remoteSnapshot().status).toBe("error");

    reads.loadMyAssociations.mockResolvedValueOnce([MAPLE]);
    reads.loadCommunity.mockResolvedValueOnce(copy("maple", "second try"));
    await retryRemote();

    expect(remoteSnapshot()).toMatchObject({ status: "ready", activeId: "maple", message: undefined });
  });

  it("is not asked again when nothing failed", async () => {
    await signedIn();
    reads.loadMyAssociations.mockClear();
    await retryRemote();
    expect(reads.loadMyAssociations).not.toHaveBeenCalled();
  });
});

describe("the association a link asked for", () => {
  it("is opened once, and a later load stays where the member went", async () => {
    reads.loadMyAssociations.mockResolvedValue([MAPLE, OAK]);
    reads.loadCommunity.mockImplementation(async (_client: unknown, id: string) => copy(id, "loaded"));

    // Arrived by /c/oak-slug, so the first load opens Oak Hills.
    preferRemoteSlug("oak-slug");
    await loadRemote("pat");
    expect(remoteSnapshot().activeId).toBe("oak");

    // Then switched to Maple Ridge. A full reload must not drag them back.
    await setRemoteAssociation("maple");
    await loadRemote("pat");
    expect(remoteSnapshot().activeId).toBe("maple");
  });
});

describe("remoteWrite", () => {
  function reported() {
    const messages: string[] = [];
    const stop = subscribeRemoteErrors((message) => messages.push(message));
    return { messages, stop };
  }

  it("treats a counted write that changed no row as refused", async () => {
    // Row level security hides a row it will not let you change: the update
    // matches nothing and the database reports no error.
    const { messages, stop } = reported();
    const ok = await remoteWrite("Saving the kind of home", async () => ({ error: null, count: 0 }));
    stop();

    expect(ok).toBe(false);
    expect(messages).toEqual([
      "Saving the kind of home: nothing was changed. You may not have access to change this",
    ]);
  });

  it("passes a counted write that changed a row, and one that did not ask for a count", async () => {
    const { messages, stop } = reported();
    expect(await remoteWrite("Saving", async () => ({ error: null, count: 2 }))).toBe(true);
    expect(await remoteWrite("Saving", async () => ({ error: null, count: null }))).toBe(true);
    expect(await remoteWrite("Saving", async () => ({ error: null }))).toBe(true);
    expect(await remoteWrite("Saving", async () => undefined)).toBe(true);
    stop();
    expect(messages).toEqual([]);
  });

  it("still reports what the database said when it did refuse outright", async () => {
    const { messages, stop } = reported();
    const ok = await remoteWrite("Saving", async () => ({ error: { message: "permission denied" }, count: null }));
    stop();
    expect(ok).toBe(false);
    expect(messages).toEqual(["Saving: permission denied"]);
  });
});
