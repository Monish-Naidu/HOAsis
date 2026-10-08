import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Community } from "@/lib/data/community";
import type { RemoteCommunitySummary } from "@/lib/data/remote";

/**
 * The same mutations as app-state.test.tsx, for a signed in association.
 *
 * That suite drives the demo, where a write is a change to a store in the
 * browser. Here every write goes to the database, and the things that go
 * wrong are different: a statement the database quietly matched to nothing,
 * a second statement written after the first was refused, two presses that
 * each replace a whole list from the same old copy.
 *
 * The database is a double that records every statement in the order it
 * ran, answers as the test tells it to, and keeps a copy of the association
 * that the store re-reads after each write, the way the real one does.
 */

interface Statement {
  /** A table name, or `rpc:<function>`. */
  target: string;
  op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  values?: unknown;
  /** Whether the write asked how many rows it changed. */
  counted: boolean;
  filters: unknown[][];
}

type Answer = { data?: unknown; error?: { message: string } | null; count?: number };

const db = vi.hoisted(() => ({
  statements: [] as Statement[],
  /** What the database says to one statement. Nothing means it worked. */
  answer: (() => undefined) as (statement: Statement) => Answer | undefined | Promise<undefined>,
  /** The association as the database holds it, re-read after each write. */
  community: null as unknown,
}));

/** Files the state layer asked Storage to remove. */
const storage = vi.hoisted(() => ({ removed: [] as string[] }));

const reads = vi.hoisted(() => ({
  loadCommunity: vi.fn(),
  loadMyAssociations: vi.fn(),
}));

vi.mock("@/lib/supabase/env", async (original) => ({
  ...(await original<typeof import("@/lib/supabase/env")>()),
  hasSupabase: true,
}));

vi.mock("@/lib/supabase/client", () => {
  async function run(statement: Statement) {
    db.statements.push(statement);
    const said = (await db.answer(statement)) ?? {};
    return {
      data: said.data ?? null,
      error: said.error ?? null,
      // Like the real client: a count comes back only when it was asked for.
      count: statement.counted ? (said.count ?? 1) : null,
    };
  }
  function from(table: string) {
    const statement: Statement = { target: table, op: "select", counted: false, filters: [] };
    const builder: Record<string, unknown> = {
      then: (done: (value: unknown) => unknown, failed?: (reason: unknown) => unknown) =>
        Promise.resolve()
          .then(() => run(statement))
          .then(done, failed),
    };
    for (const op of ["insert", "update", "delete", "upsert"] as const) {
      builder[op] = (...args: unknown[]) => {
        statement.op = op;
        // delete takes its options first; the others take the row first.
        const options = (op === "delete" ? args[0] : args[1]) as { count?: string } | undefined;
        if (op !== "delete") statement.values = args[0];
        statement.counted = options?.count === "exact";
        return builder;
      };
    }
    for (const filter of ["eq", "neq", "in", "is"]) {
      builder[filter] = (...args: unknown[]) => {
        statement.filters.push([filter, ...args]);
        return builder;
      };
    }
    builder.select = () => builder;
    builder.single = () => builder;
    builder.order = () => builder;
    builder.range = () => builder;
    return builder;
  }
  const rpc = (name: string, args: unknown) =>
    Promise.resolve().then(() =>
      run({ target: `rpc:${name}`, op: "rpc", values: args, counted: false, filters: [] }),
    );
  const files = {
    from: () => ({
      remove: async (paths: string[]) => {
        storage.removed.push(...paths);
        return { data: null, error: null };
      },
    }),
  };
  return { supabaseBrowser: () => ({ from, rpc, storage: files }) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/data/remote", async (original) => ({
  ...(await original<typeof import("@/lib/data/remote")>()),
  loadCommunity: reads.loadCommunity,
  loadMyAssociations: reads.loadMyAssociations,
}));

// The suite's setup file has already loaded these against the real,
// unconfigured environment, so they are loaded afresh here, after the
// doubles above are in place.
type Store = typeof import("@/lib/data/remote-store");
type State = typeof import("@/lib/app-state");
let store: Store;
let app: State;
let fixture: Community;
let screens: {
  ToastProvider: typeof import("@/components/app/toast").ToastProvider;
  AmendScreen: typeof import("@/app/board/documents/governing/amend-screen").AmendScreen;
  RecordPayment: typeof import("@/components/app/record-payment").RecordPayment;
  BalancesScreen: typeof import("@/app/board/homeowners/opening-balances/balances-screen").BalancesScreen;
  CollectionPolicyCard: typeof import("@/components/app/collection-policy").CollectionPolicyCard;
  RemindersComposer: typeof import("@/components/app/reminders-composer").RemindersComposer;
  HomeownersScreen: typeof import("@/app/board/homeowners/homeowners-screen").HomeownersScreen;
};
let canRaiseNotice: typeof import("@/lib/violations").canRaiseNotice;

beforeAll(async () => {
  vi.resetModules();
  store = await import("@/lib/data/remote-store");
  app = await import("@/lib/app-state");
  ({ mehrMeadows: fixture } = await import("@/lib/data/communities"));
  screens = {
    ...(await import("@/components/app/toast")),
    ...(await import("@/app/board/documents/governing/amend-screen")),
    ...(await import("@/components/app/record-payment")),
    ...(await import("@/app/board/homeowners/opening-balances/balances-screen")),
    ...(await import("@/components/app/collection-policy")),
    ...(await import("@/components/app/reminders-composer")),
    ...(await import("@/app/board/homeowners/homeowners-screen")),
  };
  ({ canRaiseNotice } = await import("@/lib/violations"));
});

const ME = "pat";
const ASSOCIATION = "assoc-1";

const SUMMARY: RemoteCommunitySummary = {
  id: ASSOCIATION,
  name: "Maple Ridge",
  role: "president",
  capabilities: [],
  slug: "maple-ridge",
  isHome: true,
  place: "Bothell, WA",
};

/** The demo association, dressed as one the signed in President belongs to. */
function association(): Community {
  return {
    ...fixture,
    id: ASSOCIATION,
    accounts: fixture.accounts.map((a) => (a.role === "president" ? { ...a, id: ME } : a)),
  };
}

const server = () => db.community as Community;
const change = (patch: Partial<Community>) => {
  db.community = { ...server(), ...patch };
};

let errors: string[];
let fetched: { url: string; body: unknown }[];
/** What a route answers, per call. Nothing means 200 with an empty body. */
let route: (url: string, call: number) => { ok?: boolean; body?: unknown } | Promise<{ ok?: boolean; body?: unknown }> | undefined;

beforeEach(async () => {
  db.statements = [];
  db.answer = () => undefined;
  db.community = association();
  storage.removed = [];
  errors = [];
  fetched = [];
  route = () => undefined;
  reads.loadMyAssociations.mockResolvedValue([SUMMARY]);
  reads.loadCommunity.mockImplementation(async () => db.community);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      fetched.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
      const said = (await route(url, fetched.filter((f) => f.url === url).length)) ?? {};
      return { ok: said.ok ?? true, json: async () => said.body ?? {} };
    }),
  );
  await store.loadRemote(null);
  await store.loadRemote(ME);
  expect(store.remoteSnapshot()).toMatchObject({ status: "ready", activeId: ASSOCIATION });
  db.statements = [];
  const stop = store.subscribeRemoteErrors((message) => errors.push(message));
  return () => {
    stop();
    vi.unstubAllGlobals();
  };
});

function renderApp() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <app.AppStateProvider>{children}</app.AppStateProvider>
  );
  return renderHook(() => app.useAppState(), { wrapper });
}

/** A screen, inside the same providers the app gives it. */
function renderScreen(ui: ReactNode) {
  return render(
    <app.AppStateProvider>
      <screens.ToastProvider>{ui}</screens.ToastProvider>
    </app.AppStateProvider>,
  );
}

/** Waits until every write asked for so far has run and been read back. */
async function settled() {
  await act(async () => {
    await store.remoteWrite("Waiting", async () => undefined);
  });
}

/** The writes that ran, without the store's own reads. */
const writes = () => db.statements.filter((s) => s.op !== "select");
const targets = () => writes().map((s) => (s.op === "rpc" ? s.target : `${s.op} ${s.target}`));

describe("a write aimed at one row", () => {
  type Run = (state: ReturnType<State["useAppState"]>, c: Community) => unknown;
  const UUID = "0b9d6c1e-6f0a-4c56-9d53-3f1f0a8d2c11";
  const UUID_2 = UUID.replace(/11$/, "12");

  // A saved amenity or form has the id the database gave it, and a save of
  // the whole list only writes to rows the store still holds.
  beforeEach(async () => {
    const [first, second, ...rest] = server().amenities;
    const [form, ...forms] = server().forms;
    change({
      amenities: [{ ...first, id: UUID }, { ...second, id: UUID_2 }, ...rest],
      forms: [{ ...form, id: UUID, source: "uploaded" }, ...forms],
    });
    await act(async () => {
      await store.refreshRemote();
    });
    db.statements = [];
  });
  const cases: [label: string, statement: string, run: Run][] = [
    ["Saving settings", "update associations", (s) => s.updateSettings({ showFundsToResidents: false })],
    ["Removing the amenity", "delete amenities", (s, c) => s.removeAmenity(c.amenities[0].id)],
    [
      "Saving access",
      "update memberships",
      (s, c) => s.setCapability(c.accounts.find((a) => a.role !== "president")!.id, "vendors", "change"),
    ],
    [
      "Saving the role (by person)",
      "update memberships",
      (s, c) => s.setAccountRole(c.accounts.find((a) => a.role !== "president")!.id, "secretary"),
    ],
    ["Saving the role (by home)", "update memberships", (s, c) => s.setHomeRole(c.homes[3].id, "secretary")],
    ["Saving the kind of home", "update units", (s, c) => s.setHomeType([c.homes[0].id], "condos")],
    ["Saving what you saw", "update violation_reports", (s) => s.verifyReport("rep-1", "Pat", "Seen it")],
    ["Closing the report", "update violation_reports", (s) => s.dismissReport("rep-1", "Nothing there")],
    ["Closing the ballot", "update ballots", (s, c) => s.closeBallot(c.ballots[0].id)],
    ["Resolving the notice", "update violations", (s, c) => s.setViolationStage(c.violations[0].id, "cured")],
    ["Removing the announcement", "delete announcements", (s, c) => s.removeAnnouncement(c.announcements[0].id)],
    ["Saving the decision on a post", "update posts", (s, c) => s.moderatePost(c.posts[0].id, "rejected", "Off topic")],
    ["Pinning", "update posts", (s, c) => s.togglePinned(c.posts[0].id)],
    ["Removing the post", "update posts", (s, c) => s.removePost(c.posts[0].id)],
    ["Saving the work order", "update requests", (s, c) => s.setWorkOrder(c.requests[0].id, null)],
    ["Ticking it off", "update action_items", (s) => s.setActionItemDone("item-1", true)],
    ["Removing the item", "delete action_items", (s) => s.removeActionItem("item-1")],
    ["Declining", "update join_requests", (s) => s.declineJoinRequest("join-1")],
    ["Saving the decision on a request", "update requests", (s, c) => s.updateRequestStatus(c.requests[0].id, "approved")],
    ["Noting the W-9", "update vendors", (s, c) => s.markW9Requested(c.vendors[0].id)],
    ["Removing the vendor", "delete vendors", (s, c) => s.removeVendor(c.vendors[0].id)],
    ["Adding the owner", "update memberships", (s, c) => s.setHouseholdOwner(c.homes[0].id, { name: "Jane Doe", email: "" })],
    [
      "Saving amenities",
      "update amenities",
      (s, c) => s.setAmenities([{ ...c.amenities[0], id: UUID }]),
    ],
    ["Saving amenities (taking one away)", "delete amenities", (s) => s.setAmenities([])],
    [
      "Saving forms",
      "update forms",
      (s, c) => s.setForms([{ ...c.forms[0], id: UUID, source: "uploaded" }]),
    ],
    [
      "Saving forms (taking one away)",
      "delete forms",
      (s, c) => s.setForms(c.forms.filter((f) => f.id !== UUID)),
    ],
    [
      "Raising the notice",
      "update violation_reports",
      (s, c) => {
        const report = c.violationReports.find((r) => canRaiseNotice(r))!;
        return s.raiseNoticeFromReport(report.id, {
          rule: "Trash cans left out",
          ruleCitation: "Rules 4.2",
          homeId: c.homes[0].id,
          ownerName: c.homes[0].displayName,
        });
      },
    ],
    ["Changing who can see a document", "update documents", (s, c) => s.setDocumentVisibility(c.documents[0].id, "board")],
    ["Removing a document", "delete documents", (s, c) => s.removeDocument(c.documents[0].id)],
    ["Saving the association", "update associations", (s) => s.updateAssociation({ ein: "12-3456789" })],
    ["Removing the shared cost", "delete shared_costs", (s) => s.removeSharedCost("cost-1")],
    [
      "Saving the template",
      "update message_templates",
      (s, c) => s.saveTemplate({ ...c.templates[0], id: UUID }),
    ],
    ["Bringing a setup step back", "delete setup_dismissals", (s) => s.restoreSetupTask("insurance")],
  ];

  it.each(cases)("%s asks how many rows it changed", async (_label, statement, run) => {
    const { result } = renderApp();
    act(() => void run(result.current, server()));
    await settled();

    const [target] = [statement.split(" ")[1]];
    const aimed = writes().filter((s) => `${s.op} ${s.target}` === statement);
    expect(aimed, `no ${statement} ran; saw ${targets().join(", ")}`).not.toHaveLength(0);
    expect(aimed.every((s) => s.counted), `${target} was written without a count`).toBe(true);
    expect(errors).toEqual([]);
  });

  it("is reported as refused when the database changes nothing", async () => {
    // Row level security hides the row from a Treasurer without the settings
    // capability: the update matches nothing and comes back with no error.
    db.answer = (s) => (s.target === "units" ? { count: 0 } : undefined);
    const { result } = renderApp();
    act(() => void result.current.setHomeType([server().homes[0].id], "condos"));
    await settled();

    expect(errors).toEqual([
      "Saving the kind of home: nothing was changed. You may not have access to change this",
    ]);
  });

  it("does not say an owner was named when no seat took the name", async () => {
    // No insert stands behind this update. A home with no empty seat, or
    // one this officer may not write, matched nothing and was reported as
    // "Jane Doe is on 12".
    db.answer = (s) => (s.target === "memberships" ? { count: 0 } : undefined);
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setHouseholdOwner(server().homes[0].id, { name: "Jane Doe", email: "" });
    });

    expect(ok).toBe(false);
    expect(errors).toEqual([
      "Adding the owner: nothing was changed. You may not have access to change this",
    ]);
  });

  it("stops saving amenities at the first one the database would not change", async () => {
    db.answer = (s) => (s.target === "amenities" && s.op === "update" ? { count: 0 } : undefined);
    const { result } = renderApp();
    const [first, second] = server().amenities;
    act(() =>
      result.current.setAmenities([
        { ...first, id: UUID },
        { ...second, id: UUID_2 },
      ]),
    );
    await settled();

    expect(targets()).toEqual(["update amenities"]);
    expect(errors).toEqual([
      "Saving amenities: nothing was changed. You may not have access to change this",
    ]);
  });

  it("says so when a form the board took away was not deleted", async () => {
    db.answer = (s) => (s.target === "forms" && s.op === "delete" ? { count: 0 } : undefined);
    const { result } = renderApp();
    act(() => result.current.setForms(server().forms.filter((f) => f.id !== UUID)));
    await settled();

    const [gone] = writes().filter((s) => s.target === "forms" && s.op === "delete");
    expect(gone.filters[0][2]).toContain(UUID);
    expect(errors).toEqual([
      "Saving forms: nothing was changed. You may not have access to change this",
    ]);
  });

  it("says a document was not changed, and leaves its file, when the row was hidden", async () => {
    db.answer = (s) => (s.target === "documents" ? { count: 0 } : undefined);
    const filed = { ...server().documents[0], storagePath: "assoc-1/doc/file.pdf" };
    change({ documents: [filed, ...server().documents.slice(1)] });
    await act(async () => {
      await store.refreshRemote();
    });
    const { result } = renderApp();

    await expect(result.current.setDocumentVisibility(filed.id, "board")).rejects.toThrow(
      "Nothing was changed. You may not have access to change this",
    );
    // The delete matched nothing, so the row is still there. Taking the
    // bytes anyway left a document on the list that opened to nothing.
    await expect(result.current.removeDocument(filed.id)).rejects.toThrow(
      "Nothing was changed. You may not have access to change this",
    );
    expect(storage.removed).toEqual([]);
  });

  it("approves a payment that is one signature short of its two", async () => {
    const waiting = server().payouts.find(
      (p) => p.approvals.length < p.approvalsRequired && p.status === "needs-approval",
    )!;
    const { result } = renderApp();
    act(() => result.current.approvePayout(waiting.id));
    await settled();

    // The database adds the signature itself (approve_payout, 0094); the
    // browser no longer writes the list.
    expect(targets()).toEqual(["rpc:approve_payout"]);
    expect(writes().filter((s) => s.target === "payouts")).toHaveLength(0);
  });
});

describe("saving a whole list from a screen a moment behind", () => {
  // The screen keeps a row that was just taken away until the re-read
  // lands, and a save of the whole list is built from what the screen shows.
  const A = "0b9d6c1e-6f0a-4c56-9d53-3f1f0a8d2c21";
  const B = "0b9d6c1e-6f0a-4c56-9d53-3f1f0a8d2c22";
  const ids = (s: Statement) =>
    s.filters.flatMap(([, column, value]) => (column === "id" ? (Array.isArray(value) ? value : [value]) : []));

  /** A table that forgets a deleted row, and matches nothing aimed at one that is gone. */
  function keeps(table: "amenities" | "forms") {
    db.answer = (s) => {
      if (s.target !== table || (s.op !== "update" && s.op !== "delete")) return undefined;
      const rows = server()[table] as { id: string }[];
      const hit = rows.filter((row) => ids(s).includes(row.id));
      if (s.op === "delete") change({ [table]: rows.filter((row) => !hit.includes(row)) });
      return { count: hit.length };
    };
  }

  beforeEach(async () => {
    const [first, second] = server().amenities;
    const [form] = server().forms;
    change({
      amenities: [{ ...first, id: A }, { ...second, id: B }],
      forms: [
        { ...form, id: A, source: "uploaded" },
        { ...form, id: B, source: "uploaded", label: "Fence request" },
      ],
    });
    await act(async () => {
      await store.refreshRemote();
    });
    db.statements = [];
  });

  it("saves the edit to one amenity when another was taken away just before", async () => {
    keeps("amenities");
    const { result } = renderApp();
    const listed = server().amenities;
    act(() => {
      result.current.removeAmenity(A);
      // Still listing A: the removal has not been read back yet.
      result.current.setAmenities(listed.map((a) => (a.id === B ? { ...a, name: "Pool, heated" } : a)));
    });
    await settled();

    expect(errors).toEqual([]);
    const updates = writes().filter((s) => s.target === "amenities" && s.op === "update");
    expect(updates.map((s) => ids(s)[0])).toEqual([B]);
    expect(updates[0].values).toMatchObject({ name: "Pool, heated" });
    expect(server().amenities.map((a) => a.id)).toEqual([B]);
  });

  it("does not delete a second time what the save before it took away", async () => {
    keeps("amenities");
    const { result } = renderApp();
    const kept = server().amenities.filter((a) => a.id === B);
    act(() => {
      result.current.setAmenities(kept);
      result.current.setAmenities(kept.map((a) => ({ ...a, detail: "Open till ten" })));
    });
    await settled();

    expect(errors).toEqual([]);
    expect(writes().filter((s) => s.target === "amenities" && s.op === "delete")).toHaveLength(1);
    expect(writes().filter((s) => s.target === "amenities" && s.op === "update")).toHaveLength(2);
  });

  it("does the same for forms", async () => {
    keeps("forms");
    const { result } = renderApp();
    const listed = server().forms;
    act(() => {
      result.current.removeForm(A);
      result.current.setForms(listed.map((f) => (f.id === B ? { ...f, label: "Fence or wall" } : f)));
      result.current.setForms(listed.filter((f) => f.id === B));
    });
    await settled();

    expect(errors).toEqual([]);
    const updates = writes().filter((s) => s.target === "forms" && s.op === "update");
    expect(updates.map((s) => ids(s)[0])).toEqual([B, B]);
    expect(writes().filter((s) => s.target === "forms" && s.op === "delete")).toHaveLength(1);
  });
});

describe("raising a notice from a report", () => {
  const raise = (state: ReturnType<State["useAppState"]>) => {
    const c = server();
    const report = c.violationReports.find((r) => canRaiseNotice(r))!;
    state.raiseNoticeFromReport(report.id, {
      rule: "Trash cans left out",
      ruleCitation: "Rules 4.2",
      homeId: c.homes[0].id,
      ownerName: c.homes[0].displayName,
    });
    return report;
  };

  it("claims the report first, and only while no notice stands on it", async () => {
    const { result } = renderApp();
    let report!: ReturnType<typeof raise>;
    act(() => {
      report = raise(result.current);
    });
    await settled();

    expect(targets()).toEqual(["update violation_reports", "insert violations"]);
    const [claim, notice] = writes();
    expect(claim.filters).toEqual([
      ["eq", "id", report.id],
      ["is", "violation_id", null],
    ]);
    expect(claim.values).toEqual({ violation_id: (notice.values as { id: string }).id });
    expect(errors).toEqual([]);
  });

  it("writes no notice when the report could not be claimed, however often it is pressed", async () => {
    // The link used to come second. Hidden by row level security, it
    // matched nothing after the notice was already in, and every press
    // after that raised another notice on the same report.
    db.answer = (s) => (s.target === "violation_reports" ? { count: 0 } : undefined);
    const { result } = renderApp();
    act(() => void raise(result.current));
    await settled();
    act(() => void raise(result.current));
    await settled();

    expect(targets()).toEqual(["update violation_reports", "update violation_reports"]);
    expect(errors).toEqual([
      "Raising the notice: nothing was changed. You may not have access to change this",
      "Raising the notice: nothing was changed. You may not have access to change this",
    ]);
  });

  it("lets go of the report when the notice itself was refused", async () => {
    db.answer = (s) =>
      s.target === "violations" && s.op === "insert"
        ? { error: { message: "new row violates row-level security policy" } }
        : undefined;
    const { result } = renderApp();
    let report!: ReturnType<typeof raise>;
    act(() => {
      report = raise(result.current);
    });
    await settled();

    expect(targets()).toEqual(["update violation_reports", "insert violations", "update violation_reports"]);
    const release = writes()[2];
    expect(release.values).toEqual({ violation_id: null });
    expect(release.filters[0]).toEqual(["eq", "id", report.id]);
    expect(errors).toEqual(["Raising the notice: new row violates row-level security policy"]);
  });
});

describe("a write that may rightly match nothing", () => {
  it("a first opening balance has nothing to update or delete", async () => {
    const { result } = renderApp();
    const home = server().homes[0];
    await act(async () => {
      // The first opening balance for a home has no earlier line, and since
      // money lines are never updated or deleted (0106) it writes one insert.
      await result.current.setOpeningBalances("2026-07-01", [{ homeId: home.id, amountCents: 50_000 }]);
    });
    await settled();

    expect(writes().filter((s) => s.op === "update" || s.op === "delete")).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("counts only the second step of choosing a default payment method", async () => {
    const method = server().instruments[0];
    const { result } = renderApp();
    act(() => result.current.setDefaultInstrument(method.id));
    await settled();

    const updates = writes().filter((s) => s.target === "payment_instruments");
    // Clearing the others may touch none. Setting the chosen one has to land.
    expect(updates.map((s) => s.counted)).toEqual([false, true]);
  });
});

describe("skipping a setup step", () => {
  it("says so when the database refuses, instead of looking skipped until the next load", async () => {
    db.answer = (s) =>
      s.target === "setup_dismissals"
        ? { error: { message: "new row violates row-level security policy" } }
        : undefined;
    const { result } = renderApp();
    act(() => result.current.dismissSetupTask("insurance"));
    await settled();

    expect(targets()).toEqual(["upsert setup_dismissals"]);
    expect(errors).toEqual(["Skipping the step: new row violates row-level security policy"]);
  });
});

describe("approving a request to join", () => {
  const request = () => server().joinRequests.find((j) => j.status === "pending")!;

  it("adds the household, then marks the request, then sends the welcome", async () => {
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.approveJoinRequest(request().id, "Lot 900");
    });

    expect(ok).toBe(true);
    expect(targets()).toEqual(["rpc:add_household", "update join_requests"]);
    expect(fetched.map((f) => f.url)).toEqual(["/api/email/invite"]);
  });

  it("stops when the household could not be added", async () => {
    // The request used to be marked approved and the welcome sent for a home
    // that was never created.
    db.answer = (s) =>
      s.target === "rpc:add_household" ? { error: { message: "That home is already on the roster" } } : undefined;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.approveJoinRequest(request().id, "Lot 900");
    });

    expect(ok).toBe(false);
    expect(targets()).toEqual(["rpc:add_household"]);
    expect(fetched).toEqual([]);
    expect(errors).toEqual(["Adding the home: That home is already on the roster"]);
  });
});

describe("letting somebody in on a home already on the register", () => {
  const request = () => server().joinRequests.find((j) => j.status === "pending")!;
  const plainHome = () => server().homes.find((o) => o.unit === request().unit)!;

  it("seats them on the chosen home, then marks the request, then sends the welcome", async () => {
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.seatJoinRequest(request().id, plainHome().id, false);
    });

    expect(ok).toBe(true);
    expect(targets()).toEqual(["rpc:seat_join_request", "update join_requests"]);
    expect(writes()[0].values).toEqual({ p_request_id: request().id, p_unit_id: plainHome().id, p_as_second: false });
    // No home was made from what they typed.
    expect(targets()).not.toContain("rpc:add_household");
    expect(fetched.map((f) => f.url)).toEqual(["/api/email/invite"]);
  });

  it("as a second owner sends no welcome, which would reach the first owner too", async () => {
    const { result } = renderApp();
    await act(async () => {
      await result.current.seatJoinRequest(request().id, plainHome().id, true);
    });

    expect((writes()[0].values as { p_as_second: boolean }).p_as_second).toBe(true);
    expect(targets()).toEqual(["rpc:seat_join_request", "update join_requests"]);
    expect(fetched).toEqual([]);
  });

  it("leaves the request waiting when the database says the home has an owner", async () => {
    db.answer = (s) =>
      s.target === "rpc:seat_join_request"
        ? { error: { message: "That home already has an owner. Add them as a second owner, or record a sale" } }
        : undefined;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.seatJoinRequest(request().id, plainHome().id, false);
    });

    expect(ok).toBe(false);
    expect(targets()).toEqual(["rpc:seat_join_request"]);
    expect(fetched).toEqual([]);
    expect(errors).toEqual([
      "Letting them in: That home already has an owner. Add them as a second owner, or record a sale",
    ]);
  });

  it("adds a second owner and changes an email through their own functions", async () => {
    const { result } = renderApp();
    const target = server().homes[0];
    await act(async () => {
      await result.current.addSecondOwner(target.id, { name: " Lee Two ", email: " lee@example.com " });
      await result.current.changeOwnerEmail(target.id, " fixed@example.com ");
    });

    expect(targets()).toEqual(["rpc:add_second_owner", "rpc:change_owner_email"]);
    expect(writes()[0].values).toEqual({ p_unit_id: target.id, p_name: "Lee Two", p_email: "lee@example.com" });
    // The seat is found by the address it has now: a home can have two owners.
    expect(writes()[1].values).toEqual({ p_unit_id: target.id, p_old_email: target.email, p_new_email: "fixed@example.com" });
  });
});

describe("the Homeowners screen: asked to join", () => {
  const request = () => server().joinRequests.find((j) => j.status === "pending")!;
  const picker = () => screen.getByLabelText(`Home for ${request().name}`) as HTMLSelectElement;

  it("starts on the home they typed, and offers a second owner or a sale when it has an owner", async () => {
    const user = userEvent.setup();
    renderScreen(<screens.HomeownersScreen />);
    const home = server().homes.find((o) => o.unit === request().unit)!;

    expect(picker().value).toBe(home.id);
    expect(screen.queryByRole("button", { name: "Let them in" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^record a sale for/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add as a second owner" }));
    await settled();

    expect(targets()).toEqual(["rpc:seat_join_request", "update join_requests"]);
    expect(writes()[0].values).toMatchObject({ p_unit_id: home.id, p_as_second: true });
  });

  it("lets them in on a home with no owner listed", async () => {
    const user = userEvent.setup();
    const home = server().homes.find((o) => o.unit === request().unit)!;
    change({ homes: server().homes.map((o) => (o.id === home.id ? { ...o, placeholder: true, displayName: "No owner yet", email: "" } : o)) });
    await act(async () => {
      await store.refreshRemote();
    });
    renderScreen(<screens.HomeownersScreen />);

    await user.click(screen.getByRole("button", { name: "Let them in" }));
    await settled();

    expect(writes()[0]).toMatchObject({ target: "rpc:seat_join_request", values: { p_unit_id: home.id, p_as_second: false } });
  });

  it("selects nothing when what they typed matches no home, and creates nothing unless asked", async () => {
    const user = userEvent.setup();
    change({ joinRequests: server().joinRequests.map((j) => (j.status === "pending" ? { ...j, unit: "Plot 9000" } : j)) });
    await act(async () => {
      await store.refreshRemote();
    });
    renderScreen(<screens.HomeownersScreen />);

    expect(picker().value).toBe("");
    expect(screen.getByRole("button", { name: "Let them in" })).toBeDisabled();
    expect(writes()).toEqual([]);

    // The only way to make a home is the last choice, which names its label.
    await user.selectOptions(picker(), screen.getByRole("option", { name: "Add as a new home: Plot 9000" }));
    await user.click(screen.getByRole("button", { name: "Let them in" }));
    await settled();

    expect(targets()).toEqual(["rpc:add_household", "update join_requests"]);
  });
});

describe("the Homeowners screen: the household card and the join code", () => {
  // One on the first page of the roster, which sorts behind first, then by unit.
  const unsigned = () =>
    [...server().homes]
      .sort((a, b) => (a.daysPastDue !== b.daysPastDue ? b.daysPastDue - a.daysPastDue : Number(a.unit) - Number(b.unit)))
      .slice(0, 50)
      .find((o) => !o.placeholder && !server().accounts.some((a) => a.homeId === o.id))!;

  it("changes the email a not yet signed in owner will claim their seat with", async () => {
    const user = userEvent.setup();
    const home = unsigned();
    renderScreen(<screens.HomeownersScreen />);

    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.click(screen.getByRole("button", { name: `Change the email for ${home.displayName}` }));
    const box = screen.getByLabelText("New owner email");
    await user.clear(box);
    await user.type(box, "right@example.com");
    await user.click(screen.getByRole("button", { name: "Save email" }));
    await settled();

    expect(writes()[0]).toMatchObject({
      target: "rpc:change_owner_email",
      values: { p_unit_id: home.id, p_old_email: home.email, p_new_email: "right@example.com" },
    });
  });

  it("adds a second owner by name and email", async () => {
    const user = userEvent.setup();
    const home = unsigned();
    renderScreen(<screens.HomeownersScreen />);

    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.click(screen.getByRole("button", { name: `Add a second owner to ${home.unit}` }));
    await user.type(screen.getByLabelText("Second owner name"), "Lee Two");
    await user.type(screen.getByLabelText("Second owner email"), "lee@example.com");
    await user.click(screen.getByRole("button", { name: "Add second owner" }));
    await settled();

    expect(writes()[0]).toMatchObject({
      target: "rpc:add_second_owner",
      values: { p_unit_id: home.id, p_name: "Lee Two", p_email: "lee@example.com" },
    });
  });

  it("shows the join code with copy buttons, to a seat that may invite", async () => {
    const user = userEvent.setup();
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    });
    renderScreen(<screens.HomeownersScreen />);
    const code = server().association.joinCode!;

    expect(screen.getByText(code)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(written).toEqual([code, `${window.location.origin}/join?code=${code}`]);
  });

  it("shows neither the code nor the roster buttons to a seat that may only look", async () => {
    const lookOnly = { ...server().accounts.find((a) => a.id === ME)!.capabilities };
    for (const key of Object.keys(lookOnly) as (keyof typeof lookOnly)[]) lookOnly[key] = false;
    change({
      accounts: server().accounts.map((a) =>
        a.id === ME ? { ...a, role: "secretary" as const, capabilities: lookOnly, views: { ...lookOnly, finances: true } } : a,
      ),
    });
    await act(async () => {
      await store.refreshRemote();
    });
    const user = userEvent.setup();
    const home = unsigned();
    renderScreen(<screens.HomeownersScreen />);

    expect(screen.queryByRole("button", { name: "Copy code" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    expect(screen.queryByRole("button", { name: /^Change the email for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add a second owner to/ })).not.toBeInTheDocument();
  });
});

describe("founding an association", () => {
  it("says which part of setup was not saved, and still lands in the association", async () => {
    db.answer = (s) => {
      if (s.target === "rpc:create_association") return { data: "assoc-new" };
      if (s.target === "amenities") return { error: { message: "amenities is down" } };
      if (s.target === "bank_accounts") return { error: { message: "bank_accounts is down" } };
      return undefined;
    };
    reads.loadMyAssociations.mockResolvedValue([SUMMARY, { ...SUMMARY, id: "assoc-new", isHome: false }]);
    const { result } = renderApp();
    const draft = {
      name: "Oak Hills",
      city: "Bothell",
      state: "WA",
      stateName: "Washington",
      duesCents: 15_000,
      duesCadence: "monthly",
      dueDay: 1,
      founder: { name: "Pat Lee", email: "pat@example.com", unit: "1" },
      households: [],
      collects: [],
      sharedSpaces: [],
      customSpaces: ["Clubhouse"],
      bankAccount: { id: "bank-1", kind: "operating", institution: "First Bank", mask: "4471" },
    } as unknown as Parameters<ReturnType<State["useAppState"]>["createRemoteAssociation"]>[0];

    let id: string | undefined;
    await act(async () => {
      id = await result.current.createRemoteAssociation(draft);
    });

    expect(id).toBe("assoc-new");
    expect(store.remoteSnapshot().activeId).toBe("assoc-new");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("shared spaces were not saved (amenities is down)");
    expect(errors[1]).toContain("operating account was not created (bank_accounts is down)");
  });
});

describe("a home's own dues", () => {
  const plainHome = () => server().homes.find((o) => !o.placeholder && !o.homeType)!;

  it("writes through set_home_dues, which is the only way a finance holder may", async () => {
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setHomeDues([{ homeId: plainHome().id, cents: 28_500 }]);
    });
    expect(ok).toBe(true);
    expect(targets()).toEqual(["rpc:set_home_dues"]);
    expect(writes()[0].values).toEqual({ p_unit_id: plainHome().id, p_dues_cents: 28_500 });
  });

  it("sends null to clear it", async () => {
    const { result } = renderApp();
    await act(async () => {
      await result.current.setHomeDues([{ homeId: plainHome().id, cents: null }]);
    });
    expect(writes()[0].values).toEqual({ p_unit_id: plainHome().id, p_dues_cents: null });
  });

  it("answers false and says why when the database refused it", async () => {
    db.answer = (s) =>
      s.target === "rpc:set_home_dues" ? { error: { message: "You cannot change dues for that home" } } : undefined;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setHomeDues([{ homeId: plainHome().id, cents: 100 }]);
    });
    expect(ok).toBe(false);
    expect(errors.join(" ")).toMatch(/Saving dues: You cannot change dues for that home/);
  });

  it("refuses a negative amount before it is sent", async () => {
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setHomeDues([{ homeId: plainHome().id, cents: -1 }]);
    });
    expect(ok).toBe(false);
    expect(writes()).toHaveLength(0);
  });

  it("Change dues says it only once the write has landed", async () => {
    const user = userEvent.setup();
    const home = plainHome();
    renderScreen(<screens.HomeownersScreen />);
    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.click(screen.getByRole("button", { name: `Change the dues for ${home.displayName}` }));
    await user.clear(screen.getByLabelText("Dues for this home"));
    await user.type(screen.getByLabelText("Dues for this home"), "310");
    await user.click(screen.getByRole("button", { name: "Save dues" }));
    await settled();

    expect(writes().map((w) => w.target)).toEqual(["rpc:set_home_dues"]);
    expect(writes()[0].values).toEqual({ p_unit_id: home.id, p_dues_cents: 31_000 });
    expect(await screen.findByText(/pays \$310(\.00)? from the next bill/)).toBeInTheDocument();
  });

  it("Change dues stays open and says nothing was saved when the write is refused", async () => {
    const user = userEvent.setup();
    const home = plainHome();
    db.answer = (s) =>
      s.target === "rpc:set_home_dues" ? { error: { message: "You cannot change dues for that home" } } : undefined;
    renderScreen(<screens.HomeownersScreen />);
    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.click(screen.getByRole("button", { name: `Change the dues for ${home.displayName}` }));
    await user.clear(screen.getByLabelText("Dues for this home"));
    await user.type(screen.getByLabelText("Dues for this home"), "310");
    await user.click(screen.getByRole("button", { name: "Save dues" }));
    await settled();

    expect(errors.join(" ")).toMatch(/cannot change dues/);
    expect(screen.queryByText(/pays \$310(\.00)? from the next bill/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Dues for this home")).toBeInTheDocument();
  });

  it("Use the standard rate clears it and says what the home pays then", async () => {
    const user = userEvent.setup();
    const home = plainHome();
    change({ homes: server().homes.map((o) => (o.id === home.id ? { ...o, duesCents: 28_500 } : o)) });
    await act(async () => {
      await store.refreshRemote();
    });
    renderScreen(<screens.HomeownersScreen />);
    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.click(screen.getByRole("button", { name: `Change the dues for ${home.displayName}` }));
    expect(screen.getByText(/from its own amount/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use the standard rate" }));
    await settled();

    expect(writes()[0].values).toEqual({ p_unit_id: home.id, p_dues_cents: null });
    const standard = server().association.duesCents;
    expect(
      await screen.findByText(new RegExp(`pays \\$${standard / 100}(\\.00)? from the next bill`)),
    ).toBeInTheDocument();
  });
});

describe("founding an association with dues by home", () => {
  const draft = (households: unknown[]) =>
    ({
      name: "Harbor Court",
      city: "Bothell",
      state: "WA",
      stateName: "Washington",
      duesCents: 21_000,
      duesByHome: true,
      duesCadence: "monthly",
      dueDay: 1,
      founder: { name: "Pat Lee", email: "pat@example.com", unit: "101" },
      households,
      collects: [],
      sharedSpaces: [],
    }) as unknown as Parameters<ReturnType<State["useAppState"]>["createRemoteAssociation"]>[0];

  const rows = [
    { name: "", email: "", unit: "201", duesCents: 28_500 },
    { name: "", email: "", unit: "202", duesCents: 28_500 },
    { name: "", email: "", unit: "102" },
  ];

  /** The register as create_association left it, so labels find their ids. */
  function register(s: Statement) {
    if (s.target === "rpc:create_association") return { data: "assoc-new" };
    if (s.target === "units" && s.op === "select") {
      return {
        data: ["101", "102", "201", "202"].map((label) => ({ id: `unit-${label}`, label })),
      };
    }
    return undefined;
  }

  it("writes each home's own amount after the association exists, and no other home's", async () => {
    db.answer = register;
    reads.loadMyAssociations.mockResolvedValue([SUMMARY, { ...SUMMARY, id: "assoc-new", isHome: false }]);
    const { result } = renderApp();
    await act(async () => {
      await result.current.createRemoteAssociation(draft(rows));
    });
    const calls = writes().filter((w) => w.target === "rpc:set_home_dues");
    expect(calls.map((c) => c.values)).toEqual([
      { p_unit_id: "unit-201", p_dues_cents: 28_500 },
      { p_unit_id: "unit-202", p_dues_cents: 28_500 },
    ]);
    expect(targets()[0]).toBe("rpc:create_association");
    expect(errors).toEqual([]);
  });

  it("says which homes did not get theirs, and still lands in the association", async () => {
    db.answer = (s) =>
      s.target === "rpc:set_home_dues" && (s.values as { p_unit_id: string }).p_unit_id === "unit-202"
        ? { error: { message: "set_home_dues is down" } }
        : register(s);
    reads.loadMyAssociations.mockResolvedValue([SUMMARY, { ...SUMMARY, id: "assoc-new", isHome: false }]);
    const { result } = renderApp();
    let id: string | undefined;
    await act(async () => {
      id = await result.current.createRemoteAssociation(draft(rows));
    });
    expect(id).toBe("assoc-new");
    expect(store.remoteSnapshot().activeId).toBe("assoc-new");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("1 of 2 homes did not get their own dues amount");
    expect(errors[0]).toContain("Change dues");
  });

  it("writes nothing for homes when no home has its own amount", async () => {
    db.answer = register;
    reads.loadMyAssociations.mockResolvedValue([SUMMARY, { ...SUMMARY, id: "assoc-new", isHome: false }]);
    const { result } = renderApp();
    await act(async () => {
      await result.current.createRemoteAssociation(draft([{ name: "", email: "", unit: "102" }]));
    });
    expect(targets()).not.toContain("rpc:set_home_dues");
  });
});

describe("recording a sale", () => {
  const seller = () => server().homes.find((o) => o.balanceCents > 0 && !o.boardRole)!;
  const sale = { name: "Priya Nair", email: "priya@example.com", closingDate: "2026-08-20", settleBalance: true };

  it("records the sale before any money, so a refused sale writes nothing", async () => {
    db.answer = (s) =>
      s.target === "rpc:transfer_home"
        ? { error: { message: "The closing date is before the current owner's tenure began" } }
        : undefined;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.transferHome(seller().id, sale);
    });

    expect(ok).toBe(false);
    // No payment line and no bank income for a sale that never happened.
    expect(targets()).toEqual(["rpc:transfer_home"]);
    expect(errors).toEqual([
      "Recording the sale: The closing date is before the current owner's tenure began",
    ]);
  });

  it("then the payment at closing, then the deposit on the books", async () => {
    const home = seller();
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.transferHome(home.id, sale);
    });

    expect(ok).toBe(true);
    expect(targets()).toEqual(["rpc:transfer_home", "insert charges", "insert ledger_entries"]);
    expect(writes()[1].values).toMatchObject({ kind: "payment", amount_cents: -home.balanceCents });
    expect(writes()[2].values).toMatchObject({ category: "Assessments", amount_cents: home.balanceCents });
  });

  it("settles what the home owes when the write runs, not what it owed when the form opened", async () => {
    const home = seller();
    const { result } = renderApp();
    // A payment lands, and is read back, between the form opening and the
    // press: the first attempt is refused and the association is re-read.
    db.answer = (s) => (s.target === "rpc:transfer_home" ? { error: { message: "Check the date" } } : undefined);
    change({ homes: server().homes.map((o) => (o.id === home.id ? { ...o, balanceCents: 10_000 } : o)) });
    await act(async () => {
      await result.current.transferHome(home.id, sale);
    });

    db.statements = [];
    db.answer = () => undefined;
    await act(async () => {
      await result.current.transferHome(home.id, sale);
    });

    expect(writes()[1].values).toMatchObject({ kind: "payment", amount_cents: -10_000 });
  });

  it("says the sale is on record when only the payment at closing failed", async () => {
    db.answer = (s) => (s.target === "charges" ? { error: { message: "charges is down" } } : undefined);
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.transferHome(seller().id, sale);
    });

    expect(ok).toBe(false);
    expect(targets()).toEqual(["rpc:transfer_home", "insert charges"]);
    expect(errors[0]).toContain("the sale is recorded, but the balance paid at closing was not");
    expect(errors[0]).toContain("Do not record the sale again");
  });
});

describe("an officer recording the sale of their own home", () => {
  const sale = { name: "Priya Nair", email: "priya@example.com", closingDate: "2026-08-20", settleBalance: true };

  /** The signed in officer becomes the Treasurer living in a home that owes. */
  async function treasurerAtHome() {
    const home = server().homes.find((o) => o.balanceCents > 0 && !o.boardRole)!;
    change({
      accounts: server()
        .accounts.filter((a) => a.homeId !== home.id)
        .map((a) => (a.id === ME ? { ...a, role: "treasurer" as const, homeId: home.id } : a)),
    });
    await act(async () => {
      await store.refreshRemote();
    });
    return home;
  }

  it("writes the money while the seat still stands, then the sale", async () => {
    // The sale ends the officer's own seat, and with it the right to write
    // the payment. Sale first left the home sold and the balance refused.
    const home = await treasurerAtHome();
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.transferHome(home.id, sale);
    });

    expect(ok).toBe(true);
    expect(targets()).toEqual(["insert charges", "insert ledger_entries", "rpc:transfer_home"]);
    expect(writes()[0].values).toMatchObject({ kind: "payment", amount_cents: -home.balanceCents });
    expect(errors).toEqual([]);
  });

  it("writes no money for a closing date it can see the database will refuse", async () => {
    const home = await treasurerAtHome();
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.transferHome(home.id, { ...sale, closingDate: "1999-01-01" });
    });

    expect(ok).toBe(false);
    expect(targets()).toEqual([]);
    expect(errors).toEqual([
      "Recording the sale: the closing date is before this owner took ownership. Check the date",
    ]);
  });

  it("says the balance is paid and the sale is not, when the sale is refused after the money", async () => {
    const home = await treasurerAtHome();
    db.answer = (s) => (s.target === "rpc:transfer_home" ? { error: { message: "The new owner needs a name" } } : undefined);
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.transferHome(home.id, sale);
    });

    expect(ok).toBe(false);
    expect(errors[0]).toContain("the balance paid at closing is recorded, but the sale was not (The new owner needs a name)");
    expect(errors[0]).toContain("the balance will not be paid twice");
  });

  it("still sells first when the home is the President's, which the database refuses", async () => {
    // ME is the President here, as in every other test in this file.
    const mine = server().accounts.find((a) => a.id === ME)!;
    change({ homes: server().homes.map((o) => (o.id === mine.homeId ? { ...o, balanceCents: 30_000 } : o)) });
    await act(async () => {
      await store.refreshRemote();
    });
    db.answer = (s) =>
      s.target === "rpc:transfer_home"
        ? { error: { message: "This home is held by the President. Hand over the office before recording the sale." } }
        : undefined;
    const { result } = renderApp();
    await act(async () => {
      await result.current.transferHome(mine.homeId, sale);
    });

    expect(targets()).toEqual(["rpc:transfer_home"]);
  });
});

describe("two presses in quick succession", () => {
  /** The database keeps what each update wrote, so the re-read returns it. */
  function keepWrites() {
    db.answer = (s) => {
      if (s.op !== "update") return undefined;
      const values = s.values as Record<string, unknown>;
      const id = s.filters.find(([, column]) => column === "id")?.[2];
      if (s.target === "memberships") {
        const who = s.filters.find(([, column]) => column === "profile_id")?.[2];
        const as = (held: string[], like: object) =>
          Object.fromEntries(Object.keys(like).map((k) => [k, held.includes(k)]));
        change({
          accounts: server().accounts.map((a) =>
            a.id === who
              ? ({
                  ...a,
                  capabilities: as(values.capabilities as string[], a.capabilities),
                  views: as(values.views as string[], a.views),
                } as typeof a)
              : a,
          ),
        });
      }
      if (s.target === "threads") {
        change({
          threads: server().threads.map((t) =>
            t.id === id ? { ...t, messages: values.messages as typeof t.messages } : t,
          ),
        });
      }
      if (s.target === "requests") {
        change({
          requests: server().requests.map((r) =>
            r.id === id ? { ...r, thread: values.thread as typeof r.thread } : r,
          ),
        });
      }
      if (s.target === "payouts") {
        change({
          payouts: server().payouts.map((p) => (p.id === id ? ({ ...p, ...values } as typeof p) : p)),
        });
      }
      return undefined;
    };
  }

  it("keeps both grants on the permission grid", async () => {
    keepWrites();
    const seat = server().accounts.find(
      (a) => a.role !== "president" && !a.capabilities.vendors && !a.capabilities.documents,
    )!;
    const { result } = renderApp();
    // Both presses land before the first write has come back, so both are
    // made from the same render.
    act(() => {
      result.current.setCapability(seat.id, "vendors", "change");
      result.current.setCapability(seat.id, "documents", "change");
    });
    await settled();

    const updates = writes().filter((s) => s.target === "memberships");
    expect(updates).toHaveLength(2);
    const last = (updates[1].values as { capabilities: string[] }).capabilities;
    expect(last, "the second press dropped the first grant").toEqual(
      expect.arrayContaining(["vendors", "documents"]),
    );
  });

  it("keeps both replies to an owner on their request, and tells the owner after each is saved", async () => {
    keepWrites();
    const request = server().requests[0];
    const before = request.thread.length;
    const { result } = renderApp();
    let saved: unknown[] = [];
    await act(async () => {
      // Both presses are made from the same render, before either write is back.
      saved = await Promise.all([
        result.current.replyToRequest(request.id, "Can you send a photo?"),
        result.current.replyToRequest(request.id, "And the colour sample."),
      ]);
    });
    await settled();

    expect(saved.every((v) => v !== false)).toBe(true);
    const thread = server().requests.find((r) => r.id === request.id)!.thread;
    expect(thread.slice(before).map((e) => e.body), "the second reply erased the first").toEqual([
      "Can you send a photo?",
      "And the colour sample.",
    ]);
    expect(thread.slice(before).map((e) => e.kind)).toEqual(["note", "note"]);
    expect(new Set(thread.map((e) => e.id)).size, "two events shared an id").toBe(thread.length);
    // The existing "request updated" email, once per saved reply.
    const mails = fetched.filter((f) => f.url === "/api/email/notify").map((f) => f.body);
    expect(mails).toMatchObject([
      { kind: "request", id: request.id, body: "Can you send a photo?" },
      { kind: "request", id: request.id, body: "And the colour sample." },
    ]);
  });

  it("saves the board's reason with a denial, on the row and on the owner's thread", async () => {
    keepWrites();
    const request = server().requests[0];
    const { result } = renderApp();
    let ok = false;
    await act(async () => {
      ok = await result.current.updateRequestStatus(request.id, "denied", "Denied. The fence is over the height limit.");
    });
    await settled();

    expect(ok).toBe(true);
    const update = writes().find((s) => s.target === "requests")!;
    expect(update.values).toMatchObject({
      status: "denied",
      decided_note: "Denied. The fence is over the height limit.",
    });
    const thread = server().requests.find((r) => r.id === request.id)!.thread;
    expect(thread.at(-1)).toMatchObject({ kind: "status", body: "Denied. The fence is over the height limit." });
  });

  it("sends both replies on a thread, one after the other, for the database to append", async () => {
    const thread = server().threads[0];
    const { result } = renderApp();
    act(() => {
      void result.current.replyToThread(thread.id, "On it.");
      void result.current.replyToThread(thread.id, "Done, thanks.");
    });
    await settled();

    // Neither carries a copy of the thread, so neither can erase the other.
    expect(targets()).toEqual(["rpc:reply_as_board", "rpc:reply_as_board"]);
    expect(writes().map((s) => s.values)).toEqual([
      { p_thread_id: thread.id, p_body: "On it." },
      { p_thread_id: thread.id, p_body: "Done, thanks." },
    ]);
  });

  it("signs a payment once", async () => {
    keepWrites();
    const waiting = server().payouts.find(
      (p) => p.status === "needs-approval" && p.approvals.length < p.approvalsRequired,
    )!;
    const { result } = renderApp();
    act(() => {
      result.current.approvePayout(waiting.id);
      result.current.approvePayout(waiting.id);
    });
    await settled();

    // Both presses reach the database, which signs once; the second press
    // used to be stopped here by a name check that two different officers
    // called Pat would both fail.
    expect(targets().filter((t) => t === "rpc:approve_payout").length).toBeGreaterThanOrEqual(1);
    expect(writes().filter((s) => s.target === "payouts")).toHaveLength(0);
  });
});

describe("saving settings", () => {
  it("does not write when the settings could not be read first", async () => {
    // Merging the patch into nothing replaced every other setting with it.
    db.answer = (s) =>
      s.target === "associations" && s.op === "select" ? { error: { message: "timeout" } } : undefined;
    const { result } = renderApp();
    act(() => void result.current.updateSettings({ showFundsToResidents: false }));
    await settled();

    expect(targets()).toEqual([]);
    expect(errors).toEqual(["Saving settings: timeout"]);
  });

  it("merges into what is saved", async () => {
    db.answer = (s) =>
      s.target === "associations" && s.op === "select"
        ? { data: { settings: { forumEnabled: true, banner: { title: "Hello", detail: "" } } } }
        : undefined;
    const { result } = renderApp();
    act(() => void result.current.updateSettings({ showFundsToResidents: false }));
    await settled();

    expect(writes()[0].values).toEqual({
      settings: { forumEnabled: true, banner: { title: "Hello", detail: "" }, showFundsToResidents: false },
    });
  });

  it("keeps a banner title and a detail saved one straight after the other", async () => {
    // Each box sent the whole banner as its render saw it, so the detail,
    // saved a moment after the title, put the old title back.
    let kept: Record<string, unknown> = {
      banner: { enabled: true, title: "Old title", detail: "Old detail", updatedDate: "2026-08-01" },
    };
    db.answer = (s) => {
      if (s.target !== "associations") return undefined;
      if (s.op === "select") return { data: { settings: kept } };
      kept = (s.values as { settings: Record<string, unknown> }).settings;
      return undefined;
    };
    const { result } = renderApp();
    act(() => {
      void result.current.updateSettings({ banner: { title: "Pool closed" } });
      void result.current.updateSettings({ banner: { detail: "Until Friday" } });
    });
    await settled();

    expect(kept.banner).toEqual({
      enabled: true,
      title: "Pool closed",
      detail: "Until Friday",
      updatedDate: "2026-08-01",
    });
  });

  it("starts a banner from the one on screen when none is stored yet", async () => {
    db.answer = (s) =>
      s.target === "associations" && s.op === "select" ? { data: { settings: {} } } : undefined;
    const { result } = renderApp();
    act(() => void result.current.updateSettings({ banner: { title: "Pool closed" } }));
    await settled();

    const banner = (writes()[0].values as { settings: { banner: object } }).settings.banner;
    expect(banner).toEqual({ ...server().settings.banner, title: "Pool closed" });
  });

  it("answers false when the save was refused, so a screen does not say saved", async () => {
    db.answer = (s) => (s.target === "associations" && s.op === "update" ? { count: 0 } : undefined);
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.updateSettings({ showFundsToResidents: false });
    });
    expect(ok).toBe(false);
  });

  it("sends a cleared renewal date as no date", async () => {
    const { result } = renderApp();
    act(() => void result.current.updateAssociation({ insuranceExpiresOn: "" }));
    await settled();

    expect(writes()[0].values).toEqual({ insurance_expires_on: null });
    expect(errors).toEqual([]);
  });
});

describe("opening balances", () => {
  const OPENING = "Balance brought forward";

  it("writes only the homes it was given, and resolves when they are written", async () => {
    const [first, second] = server().homes;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setOpeningBalances("2026-07-01", [
        { homeId: first.id, amountCents: 50_000 },
        { homeId: second.id, amountCents: 0 },
      ]);
    });

    expect(ok).toBe(true);
    // By the time it resolves the line is in. Nothing is deleted: a home with
    // nothing on file and nothing to add writes nothing at all.
    expect(targets()).toEqual(["insert charges"]);
    expect(writes()[0].values).toMatchObject({
      unit_id: first.id,
      label: OPENING,
      amount_cents: 50_000,
      due_on: "2026-07-01",
    });
  });

  it("corrects a figure with a second line for the difference, never an update or a delete", async () => {
    const [first, second] = server().homes;
    db.answer = (s) =>
      s.op === "select" && s.target === "charges"
        ? {
            data: [
              { unit_id: first.id, amount_cents: 30_000, due_on: "2026-07-01" },
              { unit_id: second.id, amount_cents: 10_000, due_on: "2026-07-01" },
            ],
          }
        : undefined;
    const { result } = renderApp();
    await act(async () => {
      await result.current.setOpeningBalances("2026-07-01", [
        { homeId: first.id, amountCents: 50_000 },
        { homeId: second.id, amountCents: 4_000 },
      ]);
    });

    expect(targets()).toEqual(["insert charges", "insert charges"]);
    expect(writes()[0].values).toMatchObject({ unit_id: first.id, kind: "charge", amount_cents: 20_000, label: OPENING });
    expect(writes()[1].values).toMatchObject({ unit_id: second.id, kind: "credit", amount_cents: -6_000, label: OPENING });
  });

  it("will not move the date of a line that is already on the books", async () => {
    const [first] = server().homes;
    db.answer = (s) =>
      s.op === "select" && s.target === "charges"
        ? { data: [{ unit_id: first.id, amount_cents: 30_000, due_on: "2026-07-01" }] }
        : undefined;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setOpeningBalances("2026-08-01", [{ homeId: first.id, amountCents: 30_000 }]);
    });

    expect(ok).toBe(false);
    expect(targets()).toEqual([]);
    expect(errors[0]).toContain("keeps its date");
  });
});

describe("the transactions a board corrects", () => {
  const entry = () => server().ledger.find((e) => e.status === "needs-review")!;

  it("confirms through confirm_ledger_entry, not an update", async () => {
    const e = entry();
    const { result } = renderApp();
    act(() => result.current.confirmLedgerEntry(e.id, "Utilities"));
    await settled();

    expect(targets()).toEqual(["rpc:confirm_ledger_entry"]);
    expect(writes()[0].values).toEqual({ p_entry_id: e.id, p_category: "Utilities" });
    expect(errors).toEqual([]);
  });

  it("reverses through reverse_ledger_entry with the reason, and undoes by inserting a new line", async () => {
    const e = entry();
    const { result } = renderApp();
    let outcome: Awaited<ReturnType<typeof result.current.reverseLedgerEntry>> = false;
    await act(async () => {
      outcome = await result.current.reverseLedgerEntry(e.id, "  Entered twice ");
    });

    expect(targets()).toEqual(["rpc:reverse_ledger_entry"]);
    expect(writes()[0].values).toEqual({ p_entry_id: e.id, p_reason: "Entered twice" });
    expect(outcome).not.toBe(false);

    await act(async () => {
      if (outcome) outcome.undo();
      await settled();
    });
    expect(targets()).toEqual(["rpc:reverse_ledger_entry", "insert ledger_entries"]);
    expect(writes()[1].values).toMatchObject({
      description: e.description,
      amount_cents: e.amountCents,
      confirmed_at: null,
    });
    expect((writes()[1].values as { id?: string }).id).toBeUndefined();
  });

  it("sends nothing without a reason", async () => {
    const e = entry();
    const { result } = renderApp();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.reverseLedgerEntry(e.id, " ");
    });
    expect(outcome).toBe(false);
    expect(targets()).toEqual([]);
  });
});

/**
 * Things the demo shows that nothing behind a real association carries out.
 * Offering them there is a promise the product does not keep, so a real
 * association is not offered them.
 */
describe("what a real association is not offered yet", () => {
  it("cannot propose a change to a governing document, and is told it is coming", () => {
    renderScreen(<screens.AmendScreen />);

    expect(screen.getByRole("heading", { name: "Governing documents" })).toBeInTheDocument();
    expect(screen.getByText(/Proposing a change from here is coming\./)).toBeInTheDocument();
    for (const name of ["Amend", "Add", "Remove", "Start from this"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Send to owners|board agenda|Save as a draft/ })).not.toBeInTheDocument();
  });

  it("records a vendor payment as already made, with no route that nothing sends", async () => {
    const user = userEvent.setup();
    renderScreen(<screens.RecordPayment onClose={() => {}} initialAmount="1380" />);

    expect(screen.queryByText("Send this payment through Your HOAsis")).not.toBeInTheDocument();
    // A note has no column to live in, so the box is not shown to be lost.
    expect(screen.queryByLabelText("Note on this payment")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Record payment" }));
    await settled();

    // Paid, needing no approval, and on the books from the same press.
    expect(targets()).toEqual(["insert payouts", "insert ledger_entries"]);
    expect(writes()[0].values).toMatchObject({ status: "paid", approvals_required: 0, amount_cents: 138_000 });
    // Vendor 0 has a usual category; the form starts from it.
    expect(writes()[1].values).toMatchObject({
      amount_cents: -138_000,
      category: server().vendors[0].defaultCategory,
    });
  });

  it("asks what the payment was for, and books it under that", async () => {
    const user = userEvent.setup();
    change({ vendors: server().vendors.map((v, i) => (i === 0 ? { ...v, defaultCategory: "Vendors" as never } : v)) });
    await act(async () => {
      await store.refreshRemote();
    });
    renderScreen(<screens.RecordPayment onClose={() => {}} initialAmount="200" />);

    // The vendor's usual category is not one the form offers, so nothing is
    // chosen and the button waits.
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Category"), "Landscaping");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    await settled();

    expect(writes()[1].values).toMatchObject({ amount_cents: -20_000, category: "Landscaping" });
  });
});

describe("recording an owner's check or cash", () => {
  const UNIT = "0b9d6c1e-6f0a-4c56-9d53-3f1f0a8d2c21";

  it("calls record_manual_payment, whose signature record_payment does not share", async () => {
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.recordManualPayment({
        homeId: UNIT,
        amountCents: 6_000,
        method: "check",
        reference: " 1042 ",
        receivedOn: "2026-10-01",
      });
    });
    expect(ok).toBe(true);
    expect(targets()).toEqual(["rpc:record_manual_payment"]);
    expect(writes()[0].values).toEqual({
      p_unit_id: UNIT,
      p_amount_cents: 6_000,
      p_method: "check",
      p_reference: "1042",
      p_received_on: "2026-10-01",
    });
  });

  it("answers false when the database refused it, so no screen says recorded", async () => {
    db.answer = (s) =>
      s.target === "rpc:record_manual_payment" ? { error: { message: "You cannot record a payment for that home" } } : undefined;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.recordManualPayment({
        homeId: UNIT, amountCents: 100, method: "cash", reference: "", receivedOn: "2026-10-01",
      });
    });
    expect(ok).toBe(false);
    expect(errors.join(" ")).toMatch(/cannot record a payment/);
  });
});

describe("a credit on a statement", () => {
  it("goes through add_credit, which logs the activity row, with the reason trimmed and no ledger line", async () => {
    const home = server().homes[0];
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.addCredit({ homeId: home.id, amountCents: 2_500, reason: " Late fee waived " });
    });
    expect(ok).toBe(true);
    expect(targets()).toEqual(["rpc:add_credit"]);
    expect(writes()[0].values).toEqual({
      p_unit_id: home.id,
      p_amount_cents: 2_500,
      p_label: "Late fee waived",
    });
  });
});

describe("an opening bank balance", () => {
  const ACCOUNT = "0b9d6c1e-6f0a-4c56-9d53-3f1f0a8d2c31";

  it("writes one confirmed line when the account has none", async () => {
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setOpeningBankBalance(ACCOUNT, { amountCents: 8_600_000, asOf: "2026-09-01" });
    });
    expect(ok).toBe(true);
    expect(targets()).toEqual(["insert ledger_entries"]);
    expect(writes()[0].values).toMatchObject({
      bank_account_id: ACCOUNT,
      category: "Opening balance",
      description: "Opening balance",
      amount_cents: 8_600_000,
      occurred_on: "2026-09-01",
    });
    expect((writes()[0].values as { confirmed_at: string | null }).confirmed_at).toBeTruthy();
  });

  it("corrects an earlier figure with a line for the difference, and deletes nothing", async () => {
    db.answer = (s) =>
      s.op === "select" && s.target === "ledger_entries" ? { data: [{ amount_cents: 8_000_000 }] } : undefined;
    const { result } = renderApp();
    await act(async () => {
      await result.current.setOpeningBankBalance(ACCOUNT, { amountCents: 8_600_000, asOf: "2026-09-01" });
    });
    expect(targets()).toEqual(["insert ledger_entries"]);
    expect(writes()[0].values).toMatchObject({
      category: "Opening balance",
      description: "Opening balance (corrected)",
      amount_cents: 600_000,
    });
  });

  it("writes nothing when the figure is already what is on the books", async () => {
    db.answer = (s) =>
      s.op === "select" && s.target === "ledger_entries" ? { data: [{ amount_cents: 8_600_000 }] } : undefined;
    const { result } = renderApp();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setOpeningBankBalance(ACCOUNT, { amountCents: 8_600_000, asOf: "2026-09-01" });
    });
    expect(ok).toBe(true);
    expect(targets()).toEqual([]);
  });
});

describe("the opening balances screen, for a real association", () => {
  it("holds the button while the lines are being written", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const held = new Promise<undefined>((resolve) => {
      release = () => resolve(undefined);
    });
    db.answer = (s) => (s.target === "charges" && s.op === "insert" ? held : undefined);
    renderScreen(<screens.BalancesScreen />);
    const home = server().homes[0];

    await user.type(
      screen.getByLabelText(`Starting balance for ${home.displayName}, ${home.unit}`),
      "500",
    );
    await user.click(screen.getByRole("button", { name: "Save 1 balance" }));

    // A second press part way through used to start a second pass over the
    // same homes.
    const waiting = await screen.findByRole("button", { name: "Saving" });
    expect(waiting).toBeDisabled();
    await user.click(waiting);

    await act(async () => {
      release();
      await store.remoteWrite("Waiting", async () => undefined);
    });
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();
    expect(targets()).toEqual(["insert charges"]);
    expect(writes().every((s) => (s.filters[0]?.[2] ?? (s.values as { unit_id: string }).unit_id) === home.id)).toBe(true);
  });
});

describe("a board reply", () => {
  it("is appended by the database, and then emailed", async () => {
    const thread = server().threads.find((t) => t.homeId)!;
    const { result } = renderApp();
    act(() => void result.current.replyToThread(thread.id, "On it."));
    await settled();
    await waitFor(() => expect(fetched).toHaveLength(1));

    // No copy of the thread leaves the browser, so nothing an owner sent
    // since this tab last read it can be written over.
    expect(targets()).toEqual(["rpc:reply_as_board"]);
    expect(writes()[0].values).toEqual({ p_thread_id: thread.id, p_body: "On it." });
    expect(fetched[0]).toMatchObject({
      url: "/api/email/notify",
      body: { associationId: ASSOCIATION, unitIds: [thread.homeId], body: "On it." },
    });
  });

  it("says the email did not go when the route sent none, and sent when it did", async () => {
    const thread = server().threads.find((t) => t.homeId)!;
    const { result } = renderApp();
    route = () => ({ body: { sent: 0, failed: 1, already: 0, remaining: 0, errors: ["a@b.com: Invalid `to` field"] } });
    let email: unknown;
    await act(async () => {
      email = await result.current.replyToThread(thread.id, "On it.");
    });
    expect(email).toBe("failed");
    expect(errors, "the board hears it in the reply toast, not a second one").toEqual([]);

    route = () => ({ body: { sent: 1, failed: 0, already: 0, remaining: 0 } });
    await act(async () => {
      email = await result.current.replyToThread(thread.id, "Again.");
    });
    expect(email).toBe("sent");
  });

  it("says what the database said when it refuses, and emails nobody", async () => {
    db.answer = (s) =>
      s.target === "rpc:reply_as_board"
        ? { error: { message: "That conversation is not yours to answer" } }
        : undefined;
    const thread = server().threads.find((t) => t.homeId)!;
    const { result } = renderApp();
    act(() => void result.current.replyToThread(thread.id, "On it."));
    await settled();

    expect(errors).toEqual(["Sending the reply: That conversation is not yours to answer"]);
    expect(fetched).toEqual([]);
  });
});

describe("a notice about a home", () => {
  it("stores what needs fixing, so the owner and the letter read the same words", async () => {
    const home = server().homes[0];
    const { result } = renderApp();
    act(() => {
      result.current.addNotice({
        homeId: home.id,
        ownerName: home.displayName,
        unit: home.unit,
        rule: "Trash cans",
        fix: " Bring them in by Tuesday ",
      });
    });
    await settled();

    expect(targets()).toEqual(["insert violations"]);
    expect(writes()[0].values).toMatchObject({ rule: "Trash cans", fix: "Bring them in by Tuesday" });
  });
});

describe("filing a request", () => {
  const draft = (c: Community) => ({ ...c.requests[0], id: "req-new", reference: "REQ-2026-200" });

  it("answers with the number the database kept, not the one the form made up", async () => {
    // Somebody else already holds 200, so the row was stored as 201.
    db.answer = (s) => (s.target === "requests" ? { data: { reference: "REQ-2026-201" } } : undefined);
    const { result } = renderApp();
    let stored: string | null | void = null;
    await act(async () => {
      stored = await result.current.addRequest(draft(server()));
    });

    expect(stored).toBe("REQ-2026-201");
    expect(targets()).toEqual(["insert requests"]);
  });

  it("answers null when the request was not saved, so the form does not say submitted", async () => {
    db.answer = (s) =>
      s.target === "requests" ? { error: { message: "new row violates row-level security policy" } } : undefined;
    const { result } = renderApp();
    let stored: string | null | void = "unset";
    await act(async () => {
      stored = await result.current.addRequest(draft(server()));
    });

    expect(stored).toBeNull();
    expect(errors).toEqual(["Sending the request: new row violates row-level security policy"]);
  });
});

describe("emailing what the board wrote", () => {
  const post = { title: "Pool closed", body: "Until Friday.", category: "Notice" as const };

  it("asks again while homes remain, and says nothing when all of them were reached", async () => {
    // The server stops before its time limit and answers with who is left.
    const left = [60, 20, 0];
    route = (_url, call) => ({ body: { sent: 40, failed: left[call - 1], remaining: left[call - 1] } });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(fetched).toHaveLength(3));
    await settled();

    expect(fetched.every((f) => f.url === "/api/email/notify")).toBe(true);
    expect(errors).toEqual([]);
  });

  it("says how many were not sent", async () => {
    // Two bad addresses; nobody left unreached.
    route = () => ({ body: { sent: 38, failed: 2, remaining: 0 } });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(errors).toHaveLength(1));

    expect(fetched).toHaveLength(1);
    expect(errors).toEqual(["Emailing the announcement: 2 emails were not sent. The announcement is posted in Messages."]);
  });

  it("stops asking after twelve calls and says who was left", async () => {
    route = (_url, call) => ({ body: { sent: 1, failed: 500 - call, remaining: 500 - call } });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(errors).toHaveLength(1));

    expect(fetched).toHaveLength(12);
    expect(errors).toEqual(["Emailing the announcement: 488 emails were not sent. The announcement is posted in Messages."]);
  });

  it("does not keep asking a server that is not getting any further", async () => {
    // Asked again without carrying on, it would mail the first homes twice.
    route = () => ({ body: { sent: 60, failed: 500, remaining: 500 } });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(errors).toHaveLength(1));

    expect(fetched).toHaveLength(2);
    expect(errors).toEqual(["Emailing the announcement: 500 emails were not sent. The announcement is posted in Messages."]);
  });

  it("says so when everybody already had it, and nobody was emailed", async () => {
    // Posted again under the same title inside the hour. The server passes
    // everybody over, and the board used to be told nothing at all.
    route = () => ({ body: { sent: 0, failed: 0, already: 38, remaining: 0 } });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(errors).toHaveLength(1));

    expect(errors).toEqual([
      "Emailing the announcement: the same notice already went to 38 owners in the last hour, so it was not emailed again",
    ]);
  });

  it("counts who already had it once, however many calls passed them over", async () => {
    // The first call ran out of time with five to go; the second passed
    // over the same thirty before it got to them.
    const answers = [
      { sent: 0, failed: 5, already: 30, remaining: 5 },
      { sent: 0, failed: 5, already: 30, remaining: 0 },
    ];
    route = (_url, call) => ({ body: answers[call - 1] });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(errors).toHaveLength(2));

    expect(fetched).toHaveLength(2);
    expect(errors).toEqual([
      "Emailing the announcement: 5 emails were not sent. The announcement is posted in Messages.",
      "Emailing the announcement: the same notice already went to 30 owners in the last hour, so it was not emailed again",
    ]);
  });

  it("says nothing of the kind when the send reached somebody new", async () => {
    route = () => ({ body: { sent: 3, failed: 0, already: 35, remaining: 0 } });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(fetched).toHaveLength(1));
    await settled();

    expect(errors).toEqual([]);
  });

  it("says why when the server would not send", async () => {
    route = () => ({ ok: false, body: { error: "You cannot send that for this association" } });
    const { result } = renderApp();
    act(() => result.current.addAnnouncement(post));
    await settled();
    await waitFor(() => expect(errors).toHaveLength(1));

    expect(errors).toEqual([
      "Emailing the announcement: You cannot send that for this association. It is saved here, but the email did not go",
    ]);
  });
});

describe("a meeting after the notice", () => {
  const upcoming = () => server().meetings.find((m) => m.status === "scheduled" && m.date >= "2026-08-20") ?? server().meetings[0];
  const held = () => server().meetings.find((m) => m.status !== "cancelled" && m.date <= "2026-08-20") ?? server().meetings[0];

  it("moves, cancels and minutes through one function each", async () => {
    const { result } = renderApp();
    await act(async () => {
      await result.current.rescheduleMeeting(upcoming().id, { date: "2030-01-05", time: "7:00 PM" });
      await result.current.cancelMeeting(upcoming().id, " Storm warning ");
      await result.current.recordMinutes(held().id, "  Approved the budget.  ", [{ name: "Arya Mehr", unit: "7", channel: "in-person" }]);
    });
    await settled();
    expect(targets()).toEqual(["rpc:reschedule_meeting", "rpc:cancel_meeting", "rpc:record_minutes"]);
    const [move, cancel, minutes] = writes().map((s) => s.values);
    expect(move).toEqual({ p_meeting_id: upcoming().id, p_held_on: "2030-01-05", p_held_at: "7:00 PM", p_location: null });
    expect(cancel).toEqual({ p_meeting_id: upcoming().id, p_reason: "Storm warning" });
    expect(minutes).toMatchObject({ p_meeting_id: held().id, p_minutes: "Approved the budget.", p_attended: [{ name: "Arya Mehr", unit: "7", role: null, channel: "in-person" }] });
  });

  it("writes nothing for a past day, a blank reason or thin minutes", async () => {
    const { result } = renderApp();
    expect(() => result.current.rescheduleMeeting(upcoming().id, { date: "2026-08-19" })).toThrow("Pick a date that has not passed.");
    expect(() => result.current.cancelMeeting(upcoming().id, "")).toThrow("Say why the meeting is cancelled.");
    expect(() => result.current.recordMinutes(held().id, "short", [])).toThrow("Write the minutes first.");
    await settled();
    expect(writes()).toHaveLength(0);
  });
});

describe("sending a meeting's notice", () => {
  const meeting = () => server().meetings.find((m) => !m.noticeSentDate) ?? server().meetings[0];
  const dated = () => writes().filter((s) => s.target === "meetings");

  it("records the date only after the email has reported back", async () => {
    let release!: (answer: { body: unknown }) => void;
    route = () => new Promise((resolve) => (release = resolve));
    const { result } = renderApp();
    act(() => void result.current.sendMeetingNotice(meeting().id));
    await settled();
    await waitFor(() => expect(fetched).toHaveLength(1));

    // Posted to every home screen, and being emailed. Not yet on record.
    expect(targets()).toEqual(["insert announcements"]);
    expect(fetched[0].body).toMatchObject({ kind: "meeting", id: meeting().id });

    release({ body: { sent: 40, failed: 0, remaining: 0 } });
    await waitFor(() => expect(dated()).toHaveLength(1));
    await settled();
    expect(dated()[0].values).toHaveProperty("notice_sent_on");
    expect(dated()[0].counted).toBe(true);
  });

  it("records the date when the server refused, because the notice is posted here", async () => {
    // The route answered, so the notice counts as sent in the app (decided
    // 2026-10-04). The toast says the email did not go.
    route = () => ({ ok: false, body: { error: "Could not send" } });
    const { result } = renderApp();
    let said: string | false | undefined;
    await act(async () => {
      said = await result.current.sendMeetingNotice(meeting().id);
    });
    await settled();

    expect(dated()).toHaveLength(1);
    expect(dated()[0].values).toHaveProperty("notice_sent_on");
    expect(said).toBe("Notice posted in the app. Email did not go out: the email service could not send it.");
    expect(errors, "the toast tells it, not a second red toast").toEqual([]);
  });

  it("leaves the date unwritten when the route could not be reached at all", async () => {
    route = () => {
      throw new Error("offline");
    };
    const { result } = renderApp();
    let said: string | false | undefined;
    await act(async () => {
      said = await result.current.sendMeetingNotice(meeting().id);
    });
    await settled();

    expect(dated()).toEqual([]);
    expect(said).toBe("Notice posted in the app. Email did not go out: the mail service could not be reached.");
  });

  it("records it and says how many were emailed", async () => {
    route = () => ({ body: { sent: 38, failed: 0, already: 0, remaining: 0 } });
    const { result } = renderApp();
    let said: string | false | undefined;
    await act(async () => {
      said = await result.current.sendMeetingNotice(meeting().id);
    });
    await settled();

    expect(dated()).toHaveLength(1);
    expect(said).toBe("Notice posted. Emailed 38 owners.");
  });

  it("records it when every email failed, and says why in plain words", async () => {
    // A sending domain that is not verified yet fails every address. The
    // date was never written and Send notice stayed on the meeting for good.
    route = () => ({
      body: {
        sent: 0,
        failed: 40,
        already: 0,
        remaining: 0,
        errors: ["a@example.com: You can only send testing emails to your own email address (x@y.com)."],
      },
    });
    const { result } = renderApp();
    let said: string | false | undefined;
    await act(async () => {
      said = await result.current.sendMeetingNotice(meeting().id);
    });
    await settled();

    expect(dated()).toHaveLength(1);
    expect(dated()[0].values).toHaveProperty("notice_sent_on");
    expect(said).toBe(
      "Notice posted in the app. Email did not go out: email is not set up to send to owners yet (the sending domain is not verified).",
    );
    expect(errors).toEqual([]);
  });

  it("records it when a second press finds everybody already has it", async () => {
    route = () => ({ body: { sent: 0, failed: 0, already: 39, remaining: 0 } });
    const { result } = renderApp();
    let said: string | false | undefined;
    await act(async () => {
      said = await result.current.sendMeetingNotice(meeting().id);
    });
    await settled();

    expect(dated()).toHaveLength(1);
    expect(said).toBe("Notice posted. Every owner already had it by email in the last hour.");
  });

  it("answers false when the date itself could not be written", async () => {
    db.answer = (s) => (s.target === "meetings" ? { count: 0 } : undefined);
    route = () => ({ body: { sent: 40, failed: 0, remaining: 0 } });
    const { result } = renderApp();
    let recorded: string | false | undefined;
    await act(async () => {
      recorded = await result.current.sendMeetingNotice(meeting().id);
    });

    expect(recorded).toBe(false);
    expect(errors).toEqual([
      "Recording the notice: nothing was changed. You may not have access to change this",
    ]);
  });

  it("does not post the notice twice when it is pressed again after the route could not be reached", async () => {
    route = (_url, call) => {
      if (call === 1) throw new Error("offline");
      return { body: { sent: 40 } };
    };
    db.answer = (s) => {
      // The database keeps the announcement, so the re-read shows it.
      if (s.target === "announcements" && s.op === "insert") {
        const row = s.values as { id: string; title: string; body: string };
        change({
          announcements: [
            { id: row.id, title: row.title, body: row.body, category: "Governance", author: "Pat", postedDate: "2026-08-20" },
            ...server().announcements,
          ],
        });
      }
      return undefined;
    };
    const { result } = renderApp();
    act(() => void result.current.sendMeetingNotice(meeting().id));
    await settled();
    await waitFor(() => expect(fetched).toHaveLength(1));
    await settled();

    act(() => void result.current.sendMeetingNotice(meeting().id));
    await waitFor(() => expect(dated()).toHaveLength(1));
    await settled();

    expect(targets().filter((t) => t === "insert announcements")).toHaveLength(1);
    expect(fetched).toHaveLength(2);
  });

  it("ignores a second press while the first is still being emailed", async () => {
    let release!: (answer: { body: unknown }) => void;
    route = () => new Promise((resolve) => (release = resolve));
    const { result } = renderApp();
    act(() => void result.current.sendMeetingNotice(meeting().id));
    await settled();
    await waitFor(() => expect(fetched).toHaveLength(1));
    act(() => void result.current.sendMeetingNotice(meeting().id));
    await settled();

    expect(fetched).toHaveLength(1);
    expect(targets().filter((t) => t === "insert announcements")).toHaveLength(1);
    release({ body: { sent: 40 } });
    await waitFor(() => expect(dated()).toHaveLength(1));
    await settled();
  });
});

describe("what the assistant is told", () => {
  it("leaves out a ballot past its closing date and a meeting past its day", async () => {
    // Nothing flips either row: a ballot stays "open" until somebody
    // presses Close now, and a real association's meeting stays "scheduled".
    const ballot = server().ballots[0];
    const held = server().meetings[0];
    change({
      ballots: [
        { ...ballot, id: "past", title: "Past ballot", audience: "owners", status: "open", closesDate: "2020-01-01" },
        { ...ballot, id: "live", title: "Live ballot", audience: "owners", status: "open", closesDate: "2099-01-01" },
      ],
      meetings: [
        { ...held, id: "gone", title: "Last year's meeting", status: "scheduled", date: "2020-01-01" },
        { ...held, id: "next", title: "Next meeting", status: "scheduled", date: "2099-01-01" },
      ],
    });
    await act(async () => {
      await store.refreshRemote();
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <app.AppStateProvider>{children}</app.AppStateProvider>
    );
    const { result } = renderHook(() => app.useAssistantContext(), { wrapper });

    expect(result.current.ballots.map((b) => b.title)).toEqual(["Live ballot"]);
    expect(result.current.meetings.map((m) => m.title)).toEqual(["Next meeting"]);
  });
});

describe("screens that said saved before they knew", () => {
  it("the collections policy says saved only once the write is back", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const held = new Promise<undefined>((resolve) => {
      release = () => resolve(undefined);
    });
    db.answer = (s) => (s.target === "associations" && s.op === "update" ? held : undefined);
    renderScreen(<screens.CollectionPolicyCard />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save policy" }));

    expect(await screen.findByRole("button", { name: "Saving" })).toBeDisabled();
    expect(screen.queryByText("Collections policy saved")).not.toBeInTheDocument();

    await act(async () => {
      release();
      await store.remoteWrite("Waiting", async () => undefined);
    });
    expect(await screen.findByText("Collections policy saved")).toBeInTheDocument();
  });

  it("the collections policy does not say saved when the write was refused", async () => {
    const user = userEvent.setup();
    db.answer = (s) => (s.target === "associations" && s.op === "update" ? { count: 0 } : undefined);
    renderScreen(<screens.CollectionPolicyCard />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save policy" }));
    await settled();

    expect(errors).toEqual([
      "Saving settings: nothing was changed. You may not have access to change this",
    ]);
    expect(screen.queryByText("Collections policy saved")).not.toBeInTheDocument();
    // Still open, with what was typed.
    expect(screen.getByRole("button", { name: "Save policy" })).toBeEnabled();
  });

  it("the roster does not say a home was re-typed when the write was refused", async () => {
    const user = userEvent.setup();
    const home = server().homes.find((o) => !o.placeholder)!;
    change({ homes: server().homes.map((o) => (o.id === home.id ? { ...o, homeType: "single-family" as const } : o)) });
    await act(async () => {
      await store.refreshRemote();
    });
    db.answer = (s) => (s.target === "units" ? { count: 0 } : undefined);
    renderScreen(<screens.HomeownersScreen />);

    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.selectOptions(screen.getByLabelText(`Kind of home for ${home.unit}`), "condos");
    await settled();

    expect(errors).toEqual([
      "Saving the kind of home: nothing was changed. You may not have access to change this",
    ]);
    expect(screen.queryByText(/It is billed that way from the next bill/)).not.toBeInTheDocument();
  });

  it("the roster says it once the write has landed", async () => {
    const user = userEvent.setup();
    const home = server().homes.find((o) => !o.placeholder)!;
    change({ homes: server().homes.map((o) => (o.id === home.id ? { ...o, homeType: "single-family" as const } : o)) });
    await act(async () => {
      await store.refreshRemote();
    });
    renderScreen(<screens.HomeownersScreen />);

    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.selectOptions(screen.getByLabelText(`Kind of home for ${home.unit}`), "condos");
    await settled();

    expect(await screen.findByText(/is a condo\. It is billed that way from the next bill/)).toBeInTheDocument();
  });
});

describe("inviting everybody who has not signed up", () => {
  it("sends the whole roster, two hundred homes to a call, and says what came back", async () => {
    // One call of every home: the route read the first two hundred and the
    // rest were never invited.
    const user = userEvent.setup();
    const [home] = server().homes;
    change({
      homes: Array.from({ length: 201 }, (_, i) => ({
        ...home,
        id: `home-${i + 1}`,
        unit: String(i + 1),
        email: `owner${i + 1}@example.com`,
      })),
    });
    await act(async () => {
      await store.refreshRemote();
    });
    route = (_url, call) => ({
      body: call === 1 ? { sent: 190, failed: 0, already: 9, remaining: 0 } : { sent: 2, failed: 0, already: 0, remaining: 0 },
    });
    renderScreen(<screens.HomeownersScreen />);

    await user.click(
      screen.getByRole("button", { name: "Email invitations to the 201 households not signed up" }),
    );

    expect(
      await screen.findByText("192 invitations sent, 9 already invited in the last hour"),
    ).toBeInTheDocument();
    const sent = fetched.filter((f) => f.url === "/api/email/invite").map((f) => (f.body as { unitIds: string[] }).unitIds);
    expect(sent.map((ids) => ids.length)).toEqual([199, 2]);
    expect(new Set(sent.flat()).size).toBe(201);
  });
});

describe("sending reminders", () => {
  /** Homes at a rung with a letter, as the ladder reads them. */
  async function owed() {
    const { collectionsLadder, policyFor } = await import("@/lib/collections");
    return collectionsLadder(server(), policyFor(server().settings)).rows.filter((r) => r.actionDue);
  }

  const sendButton = (count: number) => new RegExp(`^Send ${count} letters?$`);

  /** The database keeps each letter, so the re-read shows it on its thread. */
  function keepLetters() {
    db.answer = (s) => {
      if (s.target === "threads" && s.op === "insert") {
        const row = s.values as { id: string; subject: string; unit_id: string; messages: never[] };
        const home = server().homes.find((o) => o.id === row.unit_id)!;
        change({
          threads: [
            {
              id: row.id,
              subject: row.subject,
              participants: [home.displayName, "Pat"],
              homeId: home.id,
              unit: home.unit,
              updatedDate: server().asOf,
              unread: false,
              tag: "Billing",
              toRole: "board",
              messages: row.messages,
            },
            ...server().threads,
          ],
        });
      }
      return undefined;
    };
  }

  it("writes only to the homes still owed this step's letter", async () => {
    const user = userEvent.setup();
    const before = await owed();
    expect(before.length).toBeGreaterThan(1);
    // One of them was written to today, from the roster.
    const already = before[0].home;
    change({
      threads: [
        {
          id: "sent-today",
          subject: "Your dues",
          participants: [already.displayName, "Pat"],
          homeId: already.id,
          unit: already.unit,
          updatedDate: server().asOf,
          unread: false,
          tag: "Billing",
          toRole: "board",
          messages: [
            { id: "m-1", at: server().asOf, from: "Pat", fromRole: "board", direction: "outbound", channel: "email", body: "Reminder." },
          ],
        },
        ...server().threads,
      ],
    });
    await act(async () => {
      await store.refreshRemote();
    });
    keepLetters();
    const closed = vi.fn();
    renderScreen(<screens.RemindersComposer onClose={closed} />);

    await user.click(screen.getByRole("button", { name: sendButton(before.length - 1) }));
    await waitFor(() => expect(closed).toHaveBeenCalled());

    const sentTo = writes()
      .filter((s) => s.target === "threads")
      .map((s) => (s.values as { unit_id: string }).unit_id);
    expect(sentTo).toHaveLength(before.length - 1);
    expect(sentTo).not.toContain(already.id);
    expect(
      screen.getByText(new RegExp(`^Sent ${before.length - 1} letters?, each filled in from its own record$`)),
    ).toBeInTheDocument();
  });

  it("stays open, saying it is sending, until the letters are written", async () => {
    const user = userEvent.setup();
    const before = await owed();
    let release!: () => void;
    const held = new Promise<undefined>((resolve) => {
      release = () => resolve(undefined);
    });
    let first = true;
    db.answer = (s) => {
      if (s.target === "threads" && s.op === "insert" && first) {
        first = false;
        return held;
      }
      return undefined;
    };
    const closed = vi.fn();
    renderScreen(<screens.RemindersComposer onClose={closed} />);

    await user.click(screen.getByRole("button", { name: sendButton(before.length) }));

    expect(await screen.findByRole("button", { name: "Sending" })).toBeDisabled();
    expect(screen.getByText(/Keep this page open until it finishes/)).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Sent \d+ letters/)).not.toBeInTheDocument();

    await act(async () => {
      release();
    });
    await waitFor(() => expect(closed).toHaveBeenCalled());
    expect(writes().filter((s) => s.target === "threads")).toHaveLength(before.length);
  });

  it("says how many landed when some did not, and stays open", async () => {
    const user = userEvent.setup();
    const before = await owed();
    let seen = 0;
    db.answer = (s) => {
      if (s.target === "threads" && s.op === "insert") {
        seen += 1;
        if (seen === 1) return { error: { message: "threads is down" } };
      }
      return undefined;
    };
    const closed = vi.fn();
    renderScreen(<screens.RemindersComposer onClose={closed} />);

    await user.click(screen.getByRole("button", { name: sendButton(before.length) }));

    expect(
      await screen.findByText(`Sent ${before.length - 1} of ${before.length} letters`),
    ).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
    expect(errors).toEqual(["Sending the letter: threads is down"]);
  });
});

describe("a person who holds two homes", () => {
  /** The President's seat, and a second seat of theirs on another home. */
  function twoSeats() {
    const first = server().accounts.find((a) => a.id === ME)!;
    const other = server().homes.find((o) => o.id !== first.homeId)!;
    const second = { ...first, homeId: other.id, unit: other.unit };
    change({ accounts: [...server().accounts, second] });
    return { first, second };
  }

  it("looks at the first home until they choose, then follows the choice", async () => {
    const { first, second } = twoSeats();
    await act(async () => {
      await store.refreshRemote();
    });
    const { result } = renderApp();

    expect(result.current.mySeats.map((s) => s.homeId)).toEqual([first.homeId, second.homeId]);
    expect(result.current.account?.homeId).toBe(first.homeId);

    act(() => result.current.chooseHome(second.homeId));
    expect(result.current.account?.homeId).toBe(second.homeId);
    expect(window.localStorage.getItem("hoasis-home")).toBe(JSON.stringify(second.homeId));

    // A home they do not hold is ignored rather than followed.
    act(() => result.current.chooseHome("somebody-elses"));
    expect(result.current.account?.homeId).toBe(second.homeId);

    // Autopay is written for the home on screen, not for every seat.
    await act(async () => {
      await result.current.setAutopay({ day: 3, capCents: 50000 } as never);
    });
    const autopay = writes().find((s) => s.target === "rpc:set_my_home_autopay");
    expect(autopay?.values).toMatchObject({ p_association_id: ASSOCIATION, p_unit_id: second.homeId });

    act(() => result.current.chooseHome(first.homeId));
    expect(result.current.account?.homeId).toBe(first.homeId);
  });

  it("is one seat for most people", () => {
    const { result } = renderApp();
    expect(result.current.mySeats).toHaveLength(1);
    expect(result.current.account?.id).toBe(ME);
  });
});
