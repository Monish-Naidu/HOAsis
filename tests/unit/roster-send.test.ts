import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pacer } from "@/lib/email/pace";

/**
 * The dues run and the board notices over a whole roster, with no mail
 * provider and no database. What is tested is the loop: every send takes a
 * turn from the pacer, the loop stops with an answer when the pacer says
 * time is up, and a send made again passes over whoever already has it. The
 * fake email_log remembers what was sent, so a second call sees the first.
 */

process.env.RESEND_API_KEY = "re_test_unit";
// Announcements carry a signed unsubscribe link.
process.env.EMAIL_TOKEN_SECRET = "unit-test-secret";

const send = vi.fn<(message: { to: string; subject: string }) => Promise<{ data: { id: string }; error: null }>>(
  async () => ({ data: { id: "email-1" }, error: null }),
);
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

vi.mock("@/lib/email/sign-in-link", () => ({
  signInUrl: async () => "https://yourhoasis.com/auth/callback?token_hash=x",
}));

type Person = { email: string; full_name: string; profile_id: string | null; unit_id: string; unit_label: string; balance_cents: number };
let recipients: Person[] = [];
/** What email_log already holds for the last hour. */
let logged: { to_email: string; subject: string; unit_id: string | null }[] = [];
const inserted: { to_email: string; subject: string; unit_id: string | null; error: string | null }[] = [];
let announcement: { title: string; body: string } | null = null;
/** Why email_log refuses a write, when it does. `throws` is the network giving out instead. */
let logFails: { message: string; throws?: boolean } | null = null;

function table(name: string) {
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "eq", "is", "gte", "order"]) chain[step] = () => chain;
  // The repeat guard reads email_log a page at a time.
  chain.range = async (from: number, to: number) => ({ data: logged.slice(from, to + 1), error: null });
  chain.single = async () => ({ data: name === "associations" ? { name: "Maple Court HOA", join_code: "MAPLE1" } : null });
  chain.maybeSingle = async () => ({ data: name === "announcements" ? announcement : null });
  chain.insert = async (row: (typeof inserted)[number]) => {
    if (logFails?.throws) throw new Error(logFails.message);
    if (logFails) return { error: { message: logFails.message } };
    inserted.push(row);
    // A send that went is what the next call's repeat guard reads back.
    if (!row.error) logged.push({ to_email: row.to_email, subject: row.subject, unit_id: row.unit_id });
    return { error: null };
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: () => ({
    rpc: async () => ({ data: recipients, error: null }),
    from: (name: string) => table(name),
  }),
}));

const { sendDuesEmails } = await import("@/lib/email/send");
const { sendNotification } = await import("@/lib/email/notify");

/** A pacer that counts its turns and runs out after `limit` of them. */
function pacerFor(limit = Infinity) {
  let turns = 0;
  const order: string[] = [];
  const pacer: Pacer = {
    turn: async () => {
      turns++;
      order.push("turn");
    },
    outOfTime: () => turns >= limit,
  };
  return { pacer, order, turns: () => turns };
}

function owners(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => ({
    email: `owner${i + 1}@example.com`,
    full_name: `Owner ${i + 1}`,
    profile_id: `profile-${i + 1}`,
    unit_id: `unit-${i + 1}`,
    unit_label: String(i + 1),
    balance_cents: 28500,
  }));
}

const run = {
  associationId: "assoc-1",
  associationName: "Maple Court HOA",
  category: "assessment" as const,
  dueDate: "2026-11-01",
  origin: "https://yourhoasis.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  recipients = owners(5);
  logged = [];
  inserted.length = 0;
  logFails = null;
  announcement = { title: "Pool closes Friday", body: "For resurfacing." };
});

describe("a dues run over a roster", () => {
  it("takes a turn from the pacer before every send", async () => {
    const { pacer, order } = pacerFor();
    send.mockImplementation(async () => {
      order.push("send");
      return { data: { id: "email-1" }, error: null };
    });
    const result = await sendDuesEmails({ ...run, pacer });
    expect(result).toMatchObject({ sent: 5, failed: 0, remaining: 0 });
    expect(order).toEqual(Array.from({ length: 5 }, () => ["turn", "send"]).flat());
  });

  it("stops with an answer when time is up, and says who was not reached", async () => {
    const { pacer } = pacerFor(3);
    const result = await sendDuesEmails({ ...run, pacer });
    expect(send).toHaveBeenCalledTimes(3);
    expect(result.sent).toBe(3);
    expect(result.remaining).toBe(2);
    // Counted as not sent, so the screen that only shows `failed` shows them.
    expect(result.failed).toBe(2);
    expect(result.errors[0]).toMatch(/^Stopped at the time limit\. 2 people were not reached\. Send again/);
  });

  it("passes over whoever already has the notice when it is sent again", async () => {
    // The first three went out before the stop. Same amount, same date.
    const subject = "$285.00 due November 1, 2026 · Maple Court HOA";
    logged = recipients.slice(0, 3).map((p) => ({ to_email: p.email, subject, unit_id: p.unit_id }));
    const { pacer } = pacerFor();
    const result = await sendDuesEmails({ ...run, pacer });
    expect(send.mock.calls.map(([message]) => message.to)).toEqual(["owner4@example.com", "owner5@example.com"]);
    // Counted on their own. Folded into `skipped`, they read as homes with
    // no address.
    expect(result).toMatchObject({ sent: 2, skipped: 0, already: 3, failed: 0 });
  });

  it("says in a preview who already has it, apart from who has no address", async () => {
    const subject = "$285.00 due November 1, 2026 · Maple Court HOA";
    recipients = [...owners(4), { ...owners(5)[4], email: "" }];
    logged = recipients.slice(0, 3).map((p) => ({ to_email: p.email, subject, unit_id: p.unit_id }));
    const { pacer } = pacerFor();
    const preview = await sendDuesEmails({ ...run, pacer, dryRun: true });
    expect(preview).toMatchObject({ sent: 1, skipped: 1, already: 3, failed: 0, remaining: 0 });
    expect(send).not.toHaveBeenCalled();
    // And the real run gives the same four numbers.
    const real = await sendDuesEmails({ ...run, pacer });
    expect(real).toMatchObject({ sent: 1, skipped: 1, already: 3, failed: 0, remaining: 0 });
  });

  it("still writes to somebody whose balance changed since the last notice", async () => {
    logged = [{ to_email: "owner1@example.com", subject: "$250.00 due November 1, 2026 · Maple Court HOA", unit_id: "unit-1" }];
    const { pacer } = pacerFor();
    const result = await sendDuesEmails({ ...run, pacer });
    expect(result.sent).toBe(5);
    expect(result.already).toBe(0);
  });

  it("does not count people it would never have written to as not reached", async () => {
    recipients = [...owners(2), { ...owners(3)[2], email: "" }];
    const { pacer } = pacerFor(2);
    const result = await sendDuesEmails({ ...run, pacer });
    expect(result).toMatchObject({ sent: 2, remaining: 0, failed: 0 });
    expect(result.errors).toEqual([]);
  });

  it("does not count whoever already has it as not reached", async () => {
    // The last three got it in an earlier run. Time runs out after two more.
    const subject = "$285.00 due November 1, 2026 · Maple Court HOA";
    logged = recipients.slice(2).map((p) => ({ to_email: p.email, subject, unit_id: p.unit_id }));
    const result = await sendDuesEmails({ ...run, pacer: pacerFor(2).pacer });
    expect(result).toMatchObject({ sent: 2, remaining: 0, failed: 0 });
    expect(result.errors).toEqual([]);
  });

  it("counts as not reached only the people still waiting when it stops", async () => {
    // The fourth has it already. One send fits, so three are left to reach.
    const subject = "$285.00 due November 1, 2026 · Maple Court HOA";
    logged = [{ to_email: "owner4@example.com", subject, unit_id: "unit-4" }];
    const result = await sendDuesEmails({ ...run, pacer: pacerFor(1).pacer });
    expect(result).toMatchObject({ sent: 1, remaining: 3, failed: 3 });
    expect(result.errors[0]).toMatch(/^Stopped at the time limit\. 3 people were not reached\./);
  });

  describe("when the record of a send cannot be written", () => {
    it("stops after the first, so a run made again cannot mail the roster a second time", async () => {
      logFails = { message: "permission denied for table email_log" };
      const result = await sendDuesEmails({ ...run, pacer: pacerFor().pacer });
      // One went before anything was known to be wrong. Nobody after it.
      expect(send).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ sent: 1, failed: 4, remaining: 0, unrecorded: "permission denied for table email_log" });
      expect(result.errors[0]).toBe(
        "Stopped. The record of this send could not be saved. 4 people were not reached. Sending again could write to people who already have it.",
      );
    });

    it("stops the same way when the write throws, and counts a send that went as sent", async () => {
      logFails = { message: "fetch failed", throws: true };
      const result = await sendDuesEmails({ ...run, pacer: pacerFor().pacer });
      expect(send).toHaveBeenCalledTimes(1);
      // The mail did go. It used to be counted as failed and logged again.
      expect(result).toMatchObject({ sent: 1, failed: 4, remaining: 0, unrecorded: "fetch failed" });
    });

    it("says nothing of it when every record is written", async () => {
      const result = await sendDuesEmails({ ...run, pacer: pacerFor().pacer });
      expect(result.unrecorded).toBeUndefined();
    });
  });

  it("previews without sending, pacing or stopping", async () => {
    const { pacer, turns } = pacerFor(0);
    const result = await sendDuesEmails({ ...run, pacer, dryRun: true });
    expect(result.sent).toBe(5);
    expect(send).not.toHaveBeenCalled();
    expect(turns()).toBe(0);
  });
});

describe("a board notice over a roster", () => {
  const notice = { associationId: "assoc-1", kind: "announcement" as const, id: "ann-1", origin: "https://yourhoasis.com" };

  it("takes a turn from the pacer before every send", async () => {
    const { pacer, turns } = pacerFor();
    const result = await sendNotification({ ...notice, pacer });
    expect(result).toMatchObject({ sent: 5, failed: 0, remaining: 0 });
    expect(turns()).toBe(5);
  });

  it("stops with a count when time is up, and logs only what it sent", async () => {
    const { pacer } = pacerFor(2);
    const result = await sendNotification({ ...notice, pacer });
    expect(send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ sent: 2, already: 0, remaining: 3, failed: 3 });
    expect(result.errors[0]).toMatch(/^Stopped at the time limit\. 3 people were not reached\. Send again/);
    expect(inserted).toHaveLength(2);
  });

  it("carries on from where it stopped when it is asked again, and writes to nobody twice", async () => {
    // Two sends fit in a call. Five people take three calls, the way the
    // browser makes them: the same request again while anybody remains.
    const answers = [];
    for (let call = 0; call < 5; call++) {
      const answer = await sendNotification({ ...notice, pacer: pacerFor(2).pacer });
      answers.push(answer);
      if (answer.remaining === 0) break;
    }
    expect(answers.map((a) => [a.sent, a.already, a.remaining])).toEqual([
      [2, 0, 3],
      [2, 2, 1],
      [1, 4, 0],
    ]);
    expect(send.mock.calls.map(([message]) => message.to)).toEqual(recipients.map((p) => p.email));
    // The last call has nothing left to report.
    expect(answers[2]).toMatchObject({ failed: 0, errors: [] });
  });

  it("does not count whoever already has it as not reached", async () => {
    // The last three got it in an earlier call. Time runs out after two more.
    const subject = "Pool closes Friday · Maple Court HOA";
    logged = recipients.slice(2).map((p) => ({ to_email: p.email, subject, unit_id: p.unit_id }));
    const result = await sendNotification({ ...notice, pacer: pacerFor(2).pacer });
    expect(result).toMatchObject({ sent: 2, remaining: 0, failed: 0 });
    expect(result.errors).toEqual([]);
  });

  describe("when the record of a send cannot be written", () => {
    it("stops and leaves nobody remaining, so the browser does not ask again and mail the same people", async () => {
      logFails = { message: "permission denied for table email_log" };
      // The browser's loop: the same request again while anybody remains.
      const answers = [];
      for (let call = 0; call < 5; call++) {
        const answer = await sendNotification({ ...notice, pacer: pacerFor(2).pacer });
        answers.push(answer);
        if (answer.remaining === 0) break;
      }
      expect(answers).toHaveLength(1);
      // One went before anything was known to be wrong. Nobody twice.
      expect(send.mock.calls.map(([message]) => message.to)).toEqual(["owner1@example.com"]);
      expect(answers[0]).toMatchObject({ sent: 1, failed: 4, remaining: 0, unrecorded: "permission denied for table email_log" });
      expect(answers[0].errors[0]).toBe(
        "Stopped. The record of this send could not be saved. 4 people were not reached. Sending again could write to people who already have it.",
      );
    });

    it("stops the same way when the write throws", async () => {
      logFails = { message: "fetch failed", throws: true };
      const result = await sendNotification({ ...notice, pacer: pacerFor().pacer });
      expect(send).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ sent: 1, failed: 4, remaining: 0, unrecorded: "fetch failed" });
    });

    it("does not count whoever already has it among the people not reached", async () => {
      const subject = "Pool closes Friday · Maple Court HOA";
      logged = recipients.slice(3).map((p) => ({ to_email: p.email, subject, unit_id: p.unit_id }));
      logFails = { message: "permission denied for table email_log" };
      const result = await sendNotification({ ...notice, pacer: pacerFor().pacer });
      expect(result).toMatchObject({ sent: 1, failed: 2, remaining: 0 });
      expect(result.errors[0]).toMatch(/2 people were not reached\./);
    });

    it("still writes to everybody in one home, and says the record was not kept", async () => {
      // One home is never asked for again by the browser, and a send cut
      // short there could not be finished without writing to the first twice.
      recipients = [...owners(1), { ...owners(1)[0], email: "co-owner@example.com", profile_id: "profile-co" }];
      logFails = { message: "permission denied for table email_log" };
      const result = await sendNotification({
        associationId: "assoc-1",
        kind: "message",
        unitIds: ["unit-1"],
        subject: "Your fence request",
        body: "Thanks, the committee meets Tuesday.",
        origin: "https://yourhoasis.com",
        pacer: pacerFor().pacer,
      });
      expect(result).toMatchObject({ sent: 2, failed: 0, remaining: 0, unrecorded: "permission denied for table email_log" });
      expect(result.errors).toEqual(["The record of this send could not be saved."]);
    });

    it("says nothing of it when every record is written", async () => {
      const result = await sendNotification({ ...notice, pacer: pacerFor().pacer });
      expect(result.unrecorded).toBeUndefined();
    });
  });

  it("still sends a second announcement under another title within the hour", async () => {
    await sendNotification({ ...notice, pacer: pacerFor().pacer });
    announcement = { title: "Pool reopens Monday", body: "Resurfacing is done." };
    const second = await sendNotification({ ...notice, id: "ann-2", pacer: pacerFor().pacer });
    expect(second).toMatchObject({ sent: 5, already: 0 });
  });

  describe("to one home", () => {
    const reply = {
      associationId: "assoc-1",
      kind: "message" as const,
      unitIds: ["unit-1"],
      subject: "Your fence request",
      body: "Thanks, the committee meets Tuesday.",
      origin: "https://yourhoasis.com",
    };

    it("always goes, even under the subject of a message sent minutes ago", async () => {
      // A second reply in a thread carries the thread's subject on purpose.
      const first = await sendNotification({ ...reply, pacer: pacerFor().pacer });
      const second = await sendNotification({ ...reply, body: "One more thing: bring the survey.", pacer: pacerFor().pacer });
      expect(first).toMatchObject({ sent: 1, already: 0 });
      expect(second).toMatchObject({ sent: 1, already: 0 });
      expect(send.mock.calls.map(([message]) => message.to)).toEqual(["owner1@example.com", "owner1@example.com"]);
    });

    it("is never stopped at the time limit, because calling again could not tell a repeat", async () => {
      // Two owners of one home, and a pacer that is out of time after one.
      recipients = [...owners(1), { ...owners(1)[0], email: "co-owner@example.com", profile_id: "profile-co" }];
      const result = await sendNotification({ ...reply, pacer: pacerFor(1).pacer });
      expect(result).toMatchObject({ sent: 2, remaining: 0, failed: 0 });
    });
  });

  it("passes over a home that already has a message sent to several homes", async () => {
    const several = {
      associationId: "assoc-1",
      kind: "message" as const,
      unitIds: ["unit-1", "unit-2", "unit-3"],
      subject: "Street sweeping Thursday",
      body: "Move cars by 8.",
      origin: "https://yourhoasis.com",
    };
    logged = [{ to_email: "owner1@example.com", subject: "Street sweeping Thursday · Maple Court HOA", unit_id: "unit-1" }];
    const result = await sendNotification({ ...several, pacer: pacerFor().pacer });
    expect(result).toMatchObject({ sent: 2, already: 1, skipped: 0 });
    expect(send.mock.calls.map(([message]) => message.to)).toEqual(["owner2@example.com", "owner3@example.com"]);
  });
});
