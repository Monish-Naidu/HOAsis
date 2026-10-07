/**
 * One stand-in for the Supabase client, so a test says what each table or
 * function answers and what was asked of it, instead of rebuilding the query
 * builder inline every time. Use it inside a vi.mock factory:
 *
 *   const fake = createFakeSupabase();
 *   vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => fake.client }));
 *
 * The factory only runs when the mocked module is first imported, so the
 * `fake` it closes over has to exist by then: import the route dynamically
 * after the const, or build the fake with vi.hoisted when imports are static.
 *
 * Answers are looked up by key when a query ends (an await, .single() or
 * .maybeSingle()), most specific first:
 *   "payments.update"  a table and the first method called on it
 *   "payments"         the table
 *   "rpc:record_refund" / "rpc"   a database function
 *   "auth.getUser", "auth.admin.listUsers"   an auth call
 * Nothing set answers { data: null, error: null }.
 */

export type FakeError = { message: string; code?: string };
export type FakeResult = { data?: unknown; error?: FakeError | null; count?: number | null };
/** A function answer sees the finished call, so it can read args or keep state; it may throw. */
export type FakeAnswer = FakeResult | ((call: FakeCall) => FakeResult | Promise<FakeResult>);

/** The method chain of a query, each step as [method, ...args], so a filter is one toContainEqual. */
export type FakeStep = [method: string, ...args: unknown[]];

export class FakeCall {
  /** "payments" for from(), "rpc:name" for rpc(), "auth.verifyOtp" for auth. */
  readonly target: string;
  /** The arguments the call itself was made with: [table], [name, params] or the auth arguments. */
  readonly args: unknown[];
  readonly chain: FakeStep[] = [];

  constructor(target: string, args: unknown[]) {
    this.target = target;
    this.args = args;
  }

  /** The arguments of the first call to a chain method, or undefined if it was never called. */
  argsOf(method: string): unknown[] | undefined {
    return this.chain.find((step) => step[0] === method)?.slice(1);
  }

  has(method: string): boolean {
    return this.chain.some((step) => step[0] === method);
  }
}

const WRITES = ["insert", "update", "upsert", "delete"];
const NOTHING: FakeResult = { data: null, error: null };

export function createFakeSupabase(defaults: Record<string, FakeAnswer> = {}) {
  const calls: FakeCall[] = [];
  let sticky = new Map<string, FakeAnswer>(Object.entries(defaults));
  let queued = new Map<string, FakeAnswer[]>();

  async function settle(call: FakeCall, keys: string[], single: boolean): Promise<FakeResult> {
    let answer: FakeAnswer | undefined;
    for (const key of keys) {
      const next = queued.get(key)?.shift();
      if (next !== undefined) {
        answer = next;
        break;
      }
    }
    if (answer === undefined) for (const key of keys) if (sticky.has(key)) { answer = sticky.get(key); break; }
    const result = typeof answer === "function" ? await answer(call) : (answer ?? NOTHING);
    const { data = null, error = null, count } = result;
    // A single-row read of a list answers its first row, as PostgREST would.
    return { data: single && Array.isArray(data) ? (data[0] ?? null) : data, error, ...(count === undefined ? {} : { count }) };
  }

  /** Any method chains and is recorded; a bare await or the two single-row enders settle it. */
  function builder(call: FakeCall, keysFor: () => string[]): unknown {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop === "symbol") return undefined;
          if (prop === "then") {
            return (ok?: (v: FakeResult) => unknown, bad?: (e: unknown) => unknown) =>
              settle(call, keysFor(), false).then(ok, bad);
          }
          return (...args: unknown[]) => {
            call.chain.push([prop, ...args]);
            return prop === "single" || prop === "maybeSingle" ? settle(call, keysFor(), true) : proxy;
          };
        },
      },
    );
    return proxy;
  }

  /** auth.verifyOtp(...) and auth.admin.listUsers(...) answer from "auth.verifyOtp" and "auth.admin.listUsers". */
  function authAt(path: string): unknown {
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (typeof prop === "symbol" || prop === "then") return undefined;
          if (path === "auth" && prop === "admin") return authAt("auth.admin");
          return async (...args: unknown[]) => {
            const call = new FakeCall(`${path}.${prop}`, args);
            calls.push(call);
            return settle(call, [call.target], false);
          };
        },
      },
    );
  }

  const client = {
    from(table: string) {
      const call = new FakeCall(table, [table]);
      calls.push(call);
      const first = () => call.chain[0]?.[0];
      return builder(call, () => (first() ? [`${table}.${first()}`, table] : [table]));
    },
    rpc(name: string, params?: unknown) {
      const call = new FakeCall(`rpc:${name}`, [name, params]);
      calls.push(call);
      return builder(call, () => [call.target, "rpc"]);
    },
    auth: authAt("auth"),
  };

  return {
    client,
    /** Every call in order: from(), rpc() and auth, with the chain each query grew. */
    calls,
    /** The calls made to one target, e.g. callsTo("payments") or callsTo("rpc:record_payment"). */
    callsTo: (target: string) => calls.filter((call) => call.target === target),
    /** The queries that wrote, as the one place a test asks "was anything changed". */
    writes: () => calls.filter((call) => call.chain.some((step) => WRITES.includes(step[0]))),
    /** Answer a key every time it is asked, until replaced. */
    on(key: string, answer: FakeAnswer) {
      sticky.set(key, answer);
    },
    /** Answer a key for the next ask only, in order; after them the `on` answer, if any, applies again. */
    once(key: string, ...answers: FakeAnswer[]) {
      queued.set(key, [...(queued.get(key) ?? []), ...answers]);
    },
    /** Forget every call and answer, back to the defaults the fake was made with. */
    reset() {
      calls.length = 0;
      queued = new Map();
      sticky = new Map(Object.entries(defaults));
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
