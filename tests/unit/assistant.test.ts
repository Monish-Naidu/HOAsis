import { describe, expect, it } from "vitest";
import { answerQuestion, type AssistantScope } from "@/lib/assistant";
import { assistantContext } from "@/lib/data";

function scope(overrides: Partial<AssistantScope> = {}): AssistantScope {
  return { ...assistantContext(), fundsVisible: true, ...overrides };
}

describe("assistant", () => {
  it("answers a late payment question from the account, not from a guess", () => {
    const ctx = scope();
    ctx.owner = { ...ctx.owner, balanceCents: 85_500, daysPastDue: 62, standing: "late" };
    const answer = answerQuestion("do I have a late payment?", ctx);
    expect(answer.text).toContain("62 days past due");
    expect(answer.text).toContain("$855.00");
    expect(answer.action?.href).toBe("/resident/pay");
  });

  it("says no plainly when the account is current", () => {
    const ctx = scope();
    ctx.owner = { ...ctx.owner, balanceCents: 0, daysPastDue: 0, standing: "current" };
    expect(answerQuestion("am I late", ctx).text).toContain("No late payment");
  });

  it("prefers an exact phrase over a keyword that appears elsewhere", () => {
    // "payment" also appears in the payment history intent. The phrase wins.
    const answer = answerQuestion("late payment", scope());
    expect(answer.text.toLowerCase()).toContain("late payment");
  });

  it("finds upcoming meetings", () => {
    const answer = answerQuestion("are there any meetings coming up?", scope());
    expect(answer.text.length).toBeGreaterThan(0);
    expect(answer.action?.href).toBe("/resident/vote");
  });

  it("routes a drafting request to the form rather than inventing prose", () => {
    const answer = answerQuestion("help me write a request", scope());
    expect(answer.action?.href).toBe("/resident/requests/new");
  });

  it("reports association funds when the board publishes them", () => {
    const answer = answerQuestion("how much money does the hoa have", scope());
    expect(answer.action?.href).toBe("/resident/finances");
    expect(answer.facts?.some((f) => f.label === "Reserves")).toBe(true);
  });

  it("refuses to leak balances when the board has funds switched off", () => {
    const answer = answerQuestion("how much money does the hoa have", scope({ fundsVisible: false }));
    expect(answer.text).toContain("not published");
    expect(answer.facts).toBeUndefined();
    expect(answer.text).not.toMatch(/\$[\d,]/);
  });

  it("admits when it does not understand instead of guessing", () => {
    const answer = answerQuestion("what is the airspeed of a swallow", scope());
    expect(answer.text).toContain("could not match");
    expect(answer.action).toBeUndefined();
  });

  it("never states a figure that is not in the snapshot", () => {
    const ctx = scope();
    ctx.owner = { ...ctx.owner, balanceCents: 12_345 };
    const answer = answerQuestion("what is my balance", ctx);
    const amounts = answer.text.match(/\$[\d,]+\.\d{2}/g) ?? [];
    for (const amount of amounts) expect(amount).toBe("$123.45");
  });
});
