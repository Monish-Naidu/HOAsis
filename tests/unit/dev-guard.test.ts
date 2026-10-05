import { describe, expect, it, vi } from "vitest";
import {
  environmentBlocks,
  liveDataBlocks,
  projectRef,
  testToolsBlocked,
} from "@/app/api/dev/guard";

/**
 * The locks on the routes that delete everything. Each one is tested shut,
 * because the failure that matters is a lock that was assumed and not there:
 * /api/dev/associations had only the flag. Environment and database are both
 * handed in, so nothing here reads a real one.
 */

const OPEN = {
  NODE_ENV: "development",
  ALLOW_TEST_RESET: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  TEST_RESET_PROJECT_REF: "abcdefghijklmnop",
};

/** An admin client that answers the one question the guard asks. */
function adminWith(answer: { data: { name: string }[] | null; error: { message: string } | null }) {
  const limit = vi.fn(async () => answer);
  const or = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ or }));
  const from = vi.fn(() => ({ select }));
  return { admin: { from } as never, from, or };
}

const nothingLive = { data: [], error: null };

describe("projectRef", () => {
  it("reads the project out of a Supabase URL", () => {
    expect(projectRef("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
    expect(projectRef("https://ABCD.supabase.co/rest/v1")).toBe("abcd");
  });

  it("names a local stack by its host, and nothing by nothing", () => {
    expect(projectRef("http://127.0.0.1:54321")).toBe("127.0.0.1");
    expect(projectRef(undefined)).toBeNull();
    expect(projectRef("not a url")).toBeNull();
  });
});

describe("environmentBlocks", () => {
  it("opens only when every lock does", () => {
    expect(environmentBlocks(OPEN)).toBeNull();
  });

  it("never opens in production, whatever else is set", () => {
    expect(environmentBlocks({ ...OPEN, NODE_ENV: "production" })).toMatch(/production/);
    expect(environmentBlocks({ ...OPEN, VERCEL_ENV: "production" })).toMatch(/production/);
  });

  it("stays shut without the flag", () => {
    expect(environmentBlocks({ ...OPEN, ALLOW_TEST_RESET: undefined })).toMatch(/switched off/);
    expect(environmentBlocks({ ...OPEN, ALLOW_TEST_RESET: "1" })).toMatch(/switched off/);
  });

  it("stays shut when the flag is on but no project has been named", () => {
    // The state this machine was in: the flag true, and .env.local pointing
    // at the only project there is.
    expect(environmentBlocks({ ...OPEN, TEST_RESET_PROJECT_REF: undefined })).toMatch(/TEST_RESET_PROJECT_REF/);
    expect(environmentBlocks({ ...OPEN, TEST_RESET_PROJECT_REF: "  " })).toMatch(/TEST_RESET_PROJECT_REF/);
  });

  it("stays shut when the named project is not the one connected", () => {
    expect(environmentBlocks({ ...OPEN, TEST_RESET_PROJECT_REF: "someotherproject" })).toMatch(/does not name/);
    expect(environmentBlocks({ ...OPEN, NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co" })).toMatch(/does not name/);
    expect(environmentBlocks({ ...OPEN, NEXT_PUBLIC_SUPABASE_URL: undefined })).toMatch(/does not name/);
  });
});

describe("liveDataBlocks", () => {
  it("passes a project with nothing live in it", async () => {
    const { admin, from, or } = adminWith(nothingLive);
    expect(await liveDataBlocks(admin)).toBeNull();
    expect(from).toHaveBeenCalledWith("associations");
    expect(or).toHaveBeenCalledWith("billing_subscription_id.not.is.null,stripe_charges_enabled.eq.true");
  });

  it("refuses next to an association with a subscription or payments on, and names it", async () => {
    const { admin } = adminWith({ data: [{ name: "Maple Court HOA" }], error: null });
    expect(await liveDataBlocks(admin)).toMatch(/Maple Court HOA/);
  });

  it("refuses when the check itself could not be made", async () => {
    const { admin } = adminWith({ data: null, error: { message: "fetch failed" } });
    expect(await liveDataBlocks(admin)).toMatch(/Could not check/);
  });
});

describe("testToolsBlocked", () => {
  it("does not even reach for the database when the environment says no", async () => {
    const admin = vi.fn();
    expect(await testToolsBlocked(admin as never, { ...OPEN, NODE_ENV: "production" })).toMatch(/production/);
    expect(await testToolsBlocked(admin as never, { ...OPEN, ALLOW_TEST_RESET: "false" })).toMatch(/switched off/);
    expect(admin).not.toHaveBeenCalled();
  });

  it("asks the data once the environment agrees", async () => {
    const live = adminWith({ data: [{ name: "Maple Court HOA" }], error: null });
    expect(await testToolsBlocked(() => live.admin, OPEN)).toMatch(/Maple Court HOA/);
    const clear = adminWith(nothingLive);
    expect(await testToolsBlocked(() => clear.admin, OPEN)).toBeNull();
  });
});

/**
 * The routes themselves, since the defect was a route that never asked.
 * The admin client is a stand-in; what matters is that nothing is deleted
 * and nothing is listed while any lock is shut.
 */
const deleteEq = vi.fn(async () => ({ error: null }));
const del = vi.fn(() => ({ eq: deleteEq }));
const liveAnswer = { current: nothingLive as { data: { name: string }[] | null; error: { message: string } | null } };
const routeFrom = vi.fn(() => ({
  delete: del,
  select: () => ({
    or: () => ({ limit: async () => liveAnswer.current }),
    order: async () => ({ data: [] }),
  }),
}));
const listUsers = vi.fn(async () => ({ data: { users: [] } }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({ from: routeFrom, auth: { admin: { listUsers } } }),
}));

const associations = await import("@/app/api/dev/associations/route");
const reset = await import("@/app/api/dev/reset/route");
const { NextRequest } = await import("next/server");

function open() {
  for (const [name, value] of Object.entries(OPEN)) vi.stubEnv(name, value);
  vi.stubEnv("VERCEL_ENV", "");
}

const deleteOne = () =>
  associations.DELETE(new NextRequest("http://localhost/api/dev/associations?id=assoc-1", { method: "DELETE" }));
const deleteAll = () =>
  reset.POST(
    new NextRequest("http://localhost/api/dev/reset", {
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE EVERYTHING" }),
    }),
  );

describe("the dev routes", () => {
  it("delete nothing in production, even with the flag and the project named", async () => {
    open();
    vi.stubEnv("NODE_ENV", "production");
    liveAnswer.current = nothingLive;
    expect((await deleteOne()).status).toBe(403);
    expect((await deleteAll()).status).toBe(403);
    expect(del).not.toHaveBeenCalled();
    // The list answers 200 with the reason, which the test tools page shows.
    const listed = await associations.GET();
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ enabled: false, reason: expect.stringMatching(/production/) });
    expect(routeFrom).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("delete nothing on a project nobody named as safe to empty", async () => {
    open();
    vi.stubEnv("TEST_RESET_PROJECT_REF", "");
    liveAnswer.current = nothingLive;
    expect((await deleteOne()).status).toBe(403);
    expect((await deleteAll()).status).toBe(403);
    expect(del).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("delete nothing next to an association that looks live", async () => {
    open();
    liveAnswer.current = { data: [{ name: "Maple Court HOA" }], error: null };
    const refused = await deleteOne();
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: expect.stringMatching(/Maple Court HOA/) });
    expect((await deleteAll()).status).toBe(403);
    expect(del).not.toHaveBeenCalled();
    expect(listUsers).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("still work when every lock is open", async () => {
    open();
    liveAnswer.current = nothingLive;
    const done = await deleteOne();
    expect(done.status).toBe(200);
    expect(deleteEq).toHaveBeenCalledWith("id", "assoc-1");
    vi.unstubAllEnvs();
  });
});
