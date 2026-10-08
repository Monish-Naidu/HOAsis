import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppStateProvider, useAppState } from "@/lib/app-state";
import { fineProblem } from "@/lib/app-state/use-enforcement";
import { addDays, todayIsoDate } from "@/lib/utils";

const wrapper = ({ children }: { children: ReactNode }) => <AppStateProvider>{children}</AppStateProvider>;

const ARYA = "acct-arya";

function boardAtHearing() {
  const hook = renderHook(() => useAppState(), { wrapper });
  act(() => hook.result.current.signIn(ARYA));
  const home = hook.result.current.community.homes[0];
  let id = "";
  act(() => {
    id = hook.result.current.addNotice({
      homeId: home.id,
      ownerName: home.displayName,
      unit: home.unit,
      rule: "Trash bins at the curb",
    }).id;
  });
  act(() => hook.result.current.setViolationStage(id, "first-notice"));
  act(() => hook.result.current.setViolationStage(id, "hearing"));
  const find = () => hook.result.current.community.violations.find((v) => v.id === id)!;
  return { hook, home, id, find };
}

describe("fineProblem", () => {
  const hearing = { stage: "hearing", fineCents: 0 } as const;
  it("accepts $1 to $10,000 at the hearing stage", () => {
    expect(fineProblem(hearing, 100)).toBeNull();
    expect(fineProblem(hearing, 1_000_000)).toBeNull();
  });
  it("refuses zero, negative, fractions of a cent and too much", () => {
    expect(fineProblem(hearing, 0)).not.toBeNull();
    expect(fineProblem(hearing, 99)).not.toBeNull();
    expect(fineProblem(hearing, -500)).not.toBeNull();
    expect(fineProblem(hearing, 100.5)).not.toBeNull();
    expect(fineProblem(hearing, 1_000_001)).not.toBeNull();
  });
  it("refuses any other stage and a second fine", () => {
    expect(fineProblem({ stage: "first-notice", fineCents: 0 }, 5000)).not.toBeNull();
    expect(fineProblem({ stage: "fined", fineCents: 5000 }, 5000)).not.toBeNull();
    expect(fineProblem({ stage: "hearing", fineCents: 5000 }, 5000)).not.toBeNull();
  });
});

describe("fineViolation in the demo", () => {
  it("moves the notice to fined, dates it 30 days out and puts the charge on the statement", async () => {
    const { hook, home, id, find } = boardAtHearing();
    const before = hook.result.current.community.homes.find((o) => o.id === home.id)!.balanceCents;
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.fineViolation(id, 15000, "Second offence");
    });
    expect(ok).toBe(true);
    expect(find().stage).toBe("fined");
    expect(find().fineCents).toBe(15000);
    expect(find().nextActionDate).toBe(addDays(todayIsoDate(), 30));
    const lines = hook.result.current.community.homeCharges[home.id];
    expect(lines[0]).toMatchObject({ amountCents: 15000, kind: "charge", date: addDays(todayIsoDate(), 30) });
    expect(hook.result.current.community.homes.find((o) => o.id === home.id)!.balanceCents).toBe(before + 15000);
  });

  it("fines once: the same amount twice charges once", async () => {
    const { hook, home, id } = boardAtHearing();
    await act(async () => {
      await hook.result.current.fineViolation(id, 15000, "");
    });
    const count = hook.result.current.community.homeCharges[home.id].length;
    let again = true;
    await act(async () => {
      again = await hook.result.current.fineViolation(id, 15000, "");
    });
    expect(again).toBe(false);
    expect(hook.result.current.community.homeCharges[home.id]).toHaveLength(count);
  });

  it("refuses a notice that has not had its hearing, and a bad amount", async () => {
    const { hook, id, find } = boardAtHearing();
    act(() => hook.result.current.setViolationStage(id, "cured"));
    let ok = true;
    await act(async () => {
      ok = await hook.result.current.fineViolation(id, 5000, "");
    });
    expect(ok).toBe(false);
    expect(find().fineCents).toBe(0);

    const fresh = boardAtHearing();
    await act(async () => {
      ok = await fresh.hook.result.current.fineViolation(fresh.id, 0, "");
    });
    expect(ok).toBe(false);
    expect(fresh.find().stage).toBe("hearing");
  });
});

describe("addViolationPhoto in the demo", () => {
  const photo = (type = "image/jpeg") => new File(["x"], "bins.jpg", { type });

  it("adds a photo with its brief and vantage and no image", async () => {
    const { hook, id, find } = boardAtHearing();
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.addViolationPhoto(id, photo(), "  Bins at the curb ", "common-area");
    });
    expect(ok).toBe(true);
    expect(find().photos).toHaveLength(1);
    expect(find().photos[0]).toMatchObject({
      brief: "Bins at the curb",
      vantage: "common-area",
      takenOn: todayIsoDate(),
    });
    expect(find().photos[0].src).toBeUndefined();
  });

  it("refuses a missing brief and a file that is not a photo", async () => {
    const { hook, id, find } = boardAtHearing();
    let ok = true;
    await act(async () => {
      ok = await hook.result.current.addViolationPhoto(id, photo(), "  ", "street");
    });
    expect(ok).toBe(false);
    await act(async () => {
      ok = await hook.result.current.addViolationPhoto(id, photo("text/plain"), "Bins", "street");
    });
    expect(ok).toBe(false);
    expect(find().photos).toHaveLength(0);
  });
});
