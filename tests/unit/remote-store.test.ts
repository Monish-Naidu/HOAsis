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

  it("is still the one opened when the first load fails and is asked again", async () => {
    // This browser had Maple Ridge open last, and the link names Oak Hills.
    window.localStorage.setItem("hoasis:last-association", "maple");
    reads.loadMyAssociations.mockResolvedValue([MAPLE, OAK]);
    preferRemoteSlug("oak-slug");

    reads.loadCommunity.mockRejectedValueOnce(new Error("Could not load the homes: timeout"));
    await loadRemote("pat");
    expect(remoteSnapshot().status).toBe("error");

    // The ask was not spent on the load that failed.
    reads.loadCommunity.mockImplementation(async (_client: unknown, id: string) => copy(id, "loaded"));
    await retryRemote();
    expect(remoteSnapshot()).toMatchObject({ status: "ready", activeId: "oak" });

    // And once honoured it is spent, as before.
    await setRemoteAssociation("maple");
    await loadRemote("pat");
    expect(remoteSnapshot().activeId).toBe("maple");
  });

  it("gives way to a switch the member made while its load was still away", async () => {
    reads.loadMyAssociations.mockResolvedValue([MAPLE, OAK]);
    preferRemoteSlug("oak-slug");
    const slow = pending<Community>();
    reads.loadCommunity.mockReturnValueOnce(slow.promise);
    const load = loadRemote("pat");
    await vi.waitFor(() => expect(reads.loadCommunity).toHaveBeenCalledTimes(1));

    reads.loadCommunity.mockImplementation(async (_client: unknown, id: string) => copy(id, "loaded"));
    await setRemoteAssociation("maple");
    slow.resolve(copy("oak", "too late"));
    await load;

    // The link's load never landed, so its ask was never spent. A later full
    // load must still stay where the member chose to go.
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

  it("runs one at a time, the next only after the one before has been re-read", async () => {
    // Two quick presses that each replace a whole list. Side by side, both
    // built on the same old copy and the second erased the first.
    await signedIn();
    const order: string[] = [];
    const label = () => (remoteSnapshot().community as unknown as { label: string }).label;
    const firstWrite = pending<{ error: null }>();
    const reread = pending<Community>();
    reads.loadCommunity.mockReturnValueOnce(reread.promise);

    const one = remoteWrite("First", () => {
      order.push(`first starts on ${label()}`);
      return firstWrite.promise;
    });
    const two = remoteWrite("Second", async () => {
      order.push(`second starts on ${label()}`);
      return { error: null };
    });

    await vi.waitFor(() => expect(order).toEqual(["first starts on maple first"]));
    firstWrite.resolve({ error: null });
    // The first has landed and is being read back. The second still waits.
    await vi.waitFor(() => expect(reads.loadCommunity).toHaveBeenCalledTimes(2));
    expect(order).toEqual(["first starts on maple first"]);

    reads.loadCommunity.mockResolvedValue(copy("maple", "after both"));
    reread.resolve(copy("maple", "after the first write"));
    expect(await one).toBe(true);
    expect(await two).toBe(true);
    expect(order).toEqual([
      "first starts on maple first",
      "second starts on maple after the first write",
    ]);
  });

  it("keeps the queue moving after a write that failed", async () => {
    const { messages, stop } = reported();
    const one = remoteWrite("First", async () => {
      throw new Error("the network dropped");
    });
    const two = remoteWrite("Second", async () => ({ error: null }));
    expect(await one).toBe(false);
    expect(await two).toBe(true);
    stop();
    expect(messages).toEqual(["First: the network dropped"]);
  });

  it("re-reads after a write that failed, so a retry is not built on the old copy", async () => {
    // A write of several statements can fail after the first few landed.
    await signedIn();
    const { stop } = reported();
    reads.loadCommunity.mockResolvedValueOnce(copy("maple", "after the failure"));
    const ok = await remoteWrite("Recording the sale", async () => ({
      error: { message: "the closing date is before the tenure began" },
    }));
    stop();

    expect(ok).toBe(false);
    expect(remoteSnapshot().community).toMatchObject({ label: "maple after the failure" });
  });

  it("still reports what the database said when it did refuse outright", async () => {
    const { messages, stop } = reported();
    const ok = await remoteWrite("Saving", async () => ({ error: { message: "permission denied" }, count: null }));
    stop();
    expect(ok).toBe(false);
    expect(messages).toEqual(["Saving: permission denied"]);
  });

  describe("when nothing comes back", () => {
    // A browser request has no time limit of its own. One that never
    // answered held every later write behind it until the tab was reloaded.
    const never = () => new Promise<never>(() => {});

    beforeEach(() => {
      vi.useFakeTimers();
      return () => {
        vi.useRealTimers();
      };
    });

    it("gives up on a write that never answers, says so, and runs the next one", async () => {
      const { messages, stop } = reported();
      const ran: string[] = [];
      const one = remoteWrite("Saving settings", never);
      const two = remoteWrite("Posting the announcement", async () => {
        ran.push("second");
        return { error: null };
      });

      // Still inside the allowance: the second waits its turn.
      await vi.advanceTimersByTimeAsync(29_000);
      expect(ran).toEqual([]);
      expect(messages).toEqual([]);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(await one).toBe(false);
      expect(await two).toBe(true);
      stop();
      expect(ran).toEqual(["second"]);
      expect(messages).toEqual([
        "Saving settings: no answer after 30 seconds. Check your connection. It may still have gone through, so look before you try again",
      ]);
    });

    it("gives up on a re-read that never answers, and the write still counts", async () => {
      vi.useRealTimers();
      await signedIn();
      vi.useFakeTimers();
      const { messages, stop } = reported();
      reads.loadCommunity.mockReturnValueOnce(never());
      const ran: string[] = [];
      const one = remoteWrite("First", async () => ({ error: null }));
      const two = remoteWrite("Second", async () => {
        ran.push("second");
        return { error: null };
      });

      await vi.advanceTimersByTimeAsync(19_000);
      expect(ran).toEqual([]);

      reads.loadCommunity.mockResolvedValue(copy("maple", "after the second"));
      await vi.advanceTimersByTimeAsync(1_000);
      // The first write landed; only its re-read was lost, so it is not
      // reported as a failure.
      expect(await one).toBe(true);
      expect(await two).toBe(true);
      stop();
      expect(messages).toEqual([]);
      expect(remoteSnapshot().community).toMatchObject({ label: "maple after the second" });
    });

    it("lets a write of many rows ask for longer", async () => {
      const { messages, stop } = reported();
      const slow = pending<{ error: null }>();
      const one = remoteWrite("Saving opening balances", () => slow.promise, { timeoutMs: 90_000 });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(messages).toEqual([]);
      slow.resolve({ error: null });
      expect(await one).toBe(true);
      stop();
    });

    it("does not report a write twice when it answers after it was given up on", async () => {
      const { messages, stop } = reported();
      const late = pending<{ error: { message: string } }>();
      const one = remoteWrite("Saving", () => late.promise);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await one).toBe(false);
      late.resolve({ error: { message: "permission denied" } });
      await vi.advanceTimersByTimeAsync(0);
      stop();
      expect(messages).toHaveLength(1);
    });

    it("reads the association again when a write it gave up on lands after all", async () => {
      // The re-read at the timeout ran before the write landed. Without a
      // second one the payment is missing from the screen the message says
      // to look at, and it gets entered twice.
      vi.useRealTimers();
      await signedIn();
      vi.useFakeTimers();
      const { stop } = reported();
      const late = pending<{ error: null }>();
      reads.loadCommunity.mockResolvedValueOnce(copy("maple", "before it landed"));
      const one = remoteWrite("Recording the payment", () => late.promise);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await one).toBe(false);
      expect(remoteSnapshot().community).toMatchObject({ label: "maple before it landed" });
      const readsSoFar = reads.loadCommunity.mock.calls.length;

      reads.loadCommunity.mockResolvedValueOnce(copy("maple", "with the late write"));
      late.resolve({ error: null });
      await vi.advanceTimersByTimeAsync(0);
      stop();
      expect(reads.loadCommunity).toHaveBeenCalledTimes(readsSoFar + 1);
      expect(remoteSnapshot().community).toMatchObject({ label: "maple with the late write" });
    });

    it("reads again when the write it gave up on fails late, since part of it may have landed", async () => {
      vi.useRealTimers();
      await signedIn();
      vi.useFakeTimers();
      const { messages, stop } = reported();
      const late = pending<{ error: null }>();
      reads.loadCommunity.mockResolvedValueOnce(copy("maple", "at the timeout"));
      const one = remoteWrite("Recording the sale", () => late.promise);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await one).toBe(false);

      reads.loadCommunity.mockResolvedValueOnce(copy("maple", "after the late failure"));
      late.reject(new Error("the second statement was refused"));
      await vi.advanceTimersByTimeAsync(0);
      stop();
      // Said once, at the timeout. The late answer only brings the screen up to date.
      expect(messages).toHaveLength(1);
      expect(remoteSnapshot().community).toMatchObject({ label: "maple after the late failure" });
    });
  });
});
