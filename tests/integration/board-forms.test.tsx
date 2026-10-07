import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { BalancesScreen, openingFigures } = await import(
  "@/app/board/homeowners/opening-balances/balances-screen"
);
const { AmendScreen } = await import("@/app/board/documents/governing/amend-screen");
const { RecordPayment } = await import("@/components/app/record-payment");
const { AddCreditForm, ChangeDuesForm, RecordPaymentForm } = await import("@/app/board/homeowners/household-money");
const { DuesSettings } = await import("@/components/app/dues-settings");
const { HomeownersScreen } = await import("@/app/board/homeowners/homeowners-screen");
const { homeDues } = await import("@/lib/home-types");
const { OpeningBalances } = await import("@/app/board/money/opening-balances");
const { DraftField } = await import("@/app/board/settings/settings-screen");
const { CollectionsLadder } = await import("@/components/app/collections-ladder");
const { collectionsLadder, policyFor } = await import("@/lib/collections");

/**
 * Board forms that said more than they did, or did more than they said.
 *
 * Each of these is the demo side of a fix whose other half is in
 * app-state-remote.test.tsx: what the form puts in its boxes, what it sends
 * when the button is pressed, and what it tells the person afterwards.
 */

/** Reads the live community out of the provider, for asserting on. */
const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function wrap(ui: ReactNode) {
  return render(
    <AppStateProvider>
      <ToastProvider>
        <Probe />
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  );
}

const OPENING = "Balance brought forward";
const openingLine = (homeId: string) =>
  (seen.state.community.homeCharges[homeId] ?? []).find((l) => l.label === OPENING);
const box = (homeId: string) => {
  const home = seen.state.community.homes.find((o) => o.id === homeId)!;
  return screen.getByLabelText(`Starting balance for ${home.displayName}, ${home.unit}`) as HTMLInputElement;
};

describe("opening balances", () => {
  it("starts each box from the home's opening line, never from what it owes today", () => {
    const figures = openingFigures({
      homes: [
        { id: "billed", balanceCents: 75_000 },
        { id: "carried", balanceCents: 75_000 },
        { id: "credit", balanceCents: 0 },
      ] as never,
      homeCharges: {
        // Owes this month's dues and nothing from before the switch.
        billed: [{ id: "c1", date: "2026-08-01", label: "August assessment", kind: "charge", amountCents: 75_000, balanceAfterCents: 75_000 }],
        // Came over owing $500, and has been billed $250 since.
        carried: [
          { id: "c2", date: "2026-08-01", label: "August assessment", kind: "charge", amountCents: 25_000, balanceAfterCents: 75_000 },
          { id: "c3", date: "2026-07-01", label: OPENING, kind: "charge", amountCents: 50_000, balanceAfterCents: 50_000 },
        ],
        credit: [{ id: "c4", date: "2026-07-01", label: OPENING, kind: "credit", amountCents: -12_050, balanceAfterCents: -12_050 }],
      } as never,
    });

    expect(figures).toEqual({ billed: "", carried: "500.00", credit: "-120.50" });
  });

  it("shows a home that owes money an empty box, with what it owes today beside it", () => {
    wrap(<BalancesScreen />);
    const behind = seen.state.community.homes.find((o) => o.balanceCents > 0 && !openingLine(o.id))!;

    expect(box(behind.id).value).toBe("");
    // The figure is there to read, not to save back.
    const row = box(behind.id).closest("div")!;
    expect(within(row).getByText(/Owes \$[\d,.]+ today$/)).toBeInTheDocument();
  });

  it("has nothing to save until a box is changed", () => {
    wrap(<BalancesScreen />);
    expect(screen.getByRole("button", { name: "Save balances" })).toBeDisabled();
  });

  it("saves the one home that was changed and leaves every other statement alone", async () => {
    const user = userEvent.setup();
    wrap(<BalancesScreen />);
    const [target, ...others] = seen.state.community.homes;
    const before = Object.fromEntries(
      seen.state.community.homes.map((o) => [o.id, { balance: o.balanceCents, lines: seen.state.community.homeCharges[o.id]?.length ?? 0 }]),
    );

    await user.type(box(target.id), "1240.50");
    await user.click(screen.getByRole("button", { name: "Save 1 balance" }));

    expect(await screen.findByText(/^Starting balances saved for 1 home\./)).toBeInTheDocument();
    expect(openingLine(target.id)?.amountCents).toBe(124_050);
    // Pressing the button with every box prefilled from today's balance
    // gave each of these a brought-forward line of its own.
    for (const home of others) {
      const now = seen.state.community.homes.find((o) => o.id === home.id)!;
      expect(now.balanceCents, `${home.unit} had its balance rewritten`).toBe(before[home.id].balance);
      expect(
        seen.state.community.homeCharges[home.id]?.length ?? 0,
        `${home.unit} was given a line it never had`,
      ).toBe(before[home.id].lines);
    }
  });

  it("does not offer to save the same figure twice", async () => {
    const user = userEvent.setup();
    wrap(<BalancesScreen />);
    const target = seen.state.community.homes[0];

    await user.type(box(target.id), "300");
    await user.click(screen.getByRole("button", { name: "Save 1 balance" }));

    expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();
    // A correction is a change again, and replaces the line rather than adding one.
    await user.clear(box(target.id));
    await user.type(box(target.id), "250");
    await user.click(screen.getByRole("button", { name: "Save 1 balance" }));
    await screen.findByRole("button", { name: "Saved" });

    const lines = (seen.state.community.homeCharges[target.id] ?? []).filter((l) => l.label === OPENING);
    expect(lines).toHaveLength(1);
    expect(lines[0].amountCents).toBe(25_000);
  });
});

describe("correcting the date on opening balances", () => {
  const dateBox = () => screen.getByLabelText("Balances as of") as HTMLInputElement;
  const anySet = /^Save \d+ balances?$/;

  it("moves the date on a line already set, without the amount being typed again", async () => {
    const user = userEvent.setup();
    const { unmount } = wrap(<BalancesScreen />);
    const [target, untouched] = seen.state.community.homes.filter((o) => !openingLine(o.id));
    const typedOn = dateBox().value;

    await user.type(box(target.id), "410");
    await user.click(screen.getByRole("button", { name: "Save 1 balance" }));
    await screen.findByRole("button", { name: "Saved" });
    expect(openingLine(target.id)?.date).toBe(typedOn);

    // Dated the day it was typed, not the day of the switch. Only the date
    // is changed: this used to save nothing, so the amount had to be typed
    // out again to move it.
    fireEvent.change(dateBox(), { target: { value: "2026-07-01" } });
    await user.click(screen.getByRole("button", { name: anySet }));
    await screen.findByRole("button", { name: "Saved" });

    expect(openingLine(target.id)).toMatchObject({ date: "2026-07-01", amountCents: 41_000 });
    // A home with no opening line has nothing to re-date, and is not given one.
    expect(openingLine(untouched.id)).toBeUndefined();

    // Opened again, the screen shows the date the statements carry, and
    // nothing is waiting to be saved.
    unmount();
    wrap(<BalancesScreen />);
    expect(dateBox().value).toBe("2026-07-01");
    expect(screen.getByRole("button", { name: "Save balances" })).toBeDisabled();
  });

  it("does not offer to save with the date cleared", async () => {
    const user = userEvent.setup();
    wrap(<BalancesScreen />);
    const target = seen.state.community.homes[0];

    await user.type(box(target.id), "410");
    fireEvent.change(dateBox(), { target: { value: "" } });

    // The line is cleared before it is written, so an empty date would take
    // the old line away and then be refused.
    expect(screen.getByRole("button", { name: anySet })).toBeDisabled();
  });
});

describe("the banner, in the demo", () => {
  it("keeps the detail when only the title is saved", () => {
    wrap(<div />);
    act(() => void seen.state.updateSettings({ banner: { detail: "Until Friday" } }));
    act(() => void seen.state.updateSettings({ banner: { title: "Pool closed" } }));

    expect(seen.state.settings.banner).toMatchObject({ title: "Pool closed", detail: "Until Friday" });
    expect(seen.state.settings.banner).toHaveProperty("enabled");
  });
});

describe("the collections ladder", () => {
  it("shows the day a step's letter went out", () => {
    wrap(<CollectionsLadder />);
    const community = seen.state.community;
    const owed = collectionsLadder(community, policyFor(community.settings)).rows.find((r) => r.actionDue)!;
    const row = () => screen.getByText(owed.home.displayName).closest("div")!;
    expect(within(row()).queryByText(/· Sent /)).not.toBeInTheDocument();

    act(() => void seen.state.messageOwner(owed.home.id, "Your dues", "A reminder.", "Billing"));

    expect(within(row()).getByText(/ late · Sent \w+ \d+ · /)).toBeInTheDocument();
  });
});

describe("proposing a change to a governing document, in the demo", () => {
  it("does not say owners were sent anything", async () => {
    const user = userEvent.setup();
    wrap(<AmendScreen />);

    await user.click(screen.getByRole("button", { name: "Amend" }));
    await user.click(screen.getByRole("button", { name: /Send to owners and open voting|Put on the board agenda/ }));

    const said = screen.getByRole("status").textContent ?? "";
    expect(said).toMatch(/This demo (sends nothing to owners|does not save it)/);
    expect(said).not.toMatch(/Sent to owners|On the agenda\./);
  });
});

describe("recording a vendor payment, in the demo", () => {
  it("does not offer a route that sends money, and asks what the payment was for", () => {
    wrap(<RecordPayment onClose={() => {}} />);
    expect(screen.queryByText("Send this payment through Your HOAsis")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Note on this payment")).toBeInTheDocument();
  });
});

describe("a check or cash from an owner", () => {
  it("saves the amount, the way it was paid, the number and the date, and waits for the result", async () => {
    const user = userEvent.setup();
    const saved: unknown[] = [];
    render(
      <RecordPaymentForm
        unit="Unit 7"
        balanceCents={28_500}
        onSave={async (input) => {
          saved.push(input);
          return true;
        }}
        onCancel={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Save payment" });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Payment amount"), "60");
    await user.type(screen.getByLabelText("Payment reference"), "1042");
    expect(button).toBeEnabled();
    await user.click(button);
    expect(saved).toEqual([
      { amountCents: 6_000, method: "check", reference: "1042", receivedOn: "2026-08-20" },
    ]);
  });

  it("refuses a date in the future", () => {
    render(<RecordPaymentForm unit="Unit 7" balanceCents={28_500} onSave={async () => true} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Payment amount"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Date received"), { target: { value: "2026-08-21" } });
    expect(screen.getByRole("button", { name: "Save payment" })).toBeDisabled();
  });

  it("caps a payment at the balance plus $10,000 and says when it passes the balance", () => {
    render(<RecordPaymentForm unit="Unit 7" balanceCents={28_500} onSave={async () => true} onCancel={() => {}} />);
    const button = screen.getByRole("button", { name: "Save payment" });
    fireEvent.change(screen.getByLabelText("Payment amount"), { target: { value: "300" } });
    expect(screen.getByText("That is $15.00 more than the home owes. The extra stays as credit.")).toBeInTheDocument();
    expect(button).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Payment amount"), { target: { value: "999999999" } });
    expect(screen.getByRole("alert")).toHaveTextContent("The most you can record for this home is $10,285.00.");
    expect(button).toBeDisabled();
  });

  it("refuses a third decimal and exponent notation", () => {
    render(<RecordPaymentForm unit="Unit 7" balanceCents={28_500} onSave={async () => true} onCancel={() => {}} />);
    const button = screen.getByRole("button", { name: "Save payment" });
    for (const bad of ["285.555", "12e3"]) {
      fireEvent.change(screen.getByLabelText("Payment amount"), { target: { value: bad } });
      expect(button).toBeDisabled();
    }
  });

  it("adds a credit only with an amount and a reason", async () => {
    const user = userEvent.setup();
    const saved: unknown[] = [];
    render(
      <AddCreditForm
        unit="Unit 7"
        onSave={async (input) => {
          saved.push(input);
          return true;
        }}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText("Credit amount"), "25");
    expect(screen.getByRole("button", { name: "Save credit" })).toBeDisabled();
    await user.type(screen.getByLabelText("Credit reason"), "Late fee waived");
    await user.click(screen.getByRole("button", { name: "Save credit" }));
    expect(saved).toEqual([{ amountCents: 2_500, reason: "Late fee waived" }]);
  });
});

describe("opening bank balances on Finances", () => {
  it("offers one row per account without an opening line, and drops the row once it is saved", async () => {
    const user = userEvent.setup();
    wrap(<OpeningBalances />);
    // The President may change finances; nobody is signed in to begin with.
    act(() => seen.state.signIn("acct-arya"));
    const accounts = seen.state.community.bankAccounts;
    expect(accounts.length).toBeGreaterThan(0);
    const input = screen.getByLabelText(new RegExp(`^Starting balance for ${accounts[0].name}`));
    await user.type(input, "86000");
    await user.click(within(input.closest("form")!).getByRole("button", { name: "Save" }));

    const lines = seen.state.ledger.filter(
      (e) => e.accountId === accounts[0].id && e.category === "Opening balance",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].amountCents).toBe(86_000_00);
    expect(screen.queryByLabelText(new RegExp(`^Starting balance for ${accounts[0].name}`))).not.toBeInTheDocument();
  });
});

describe("a settings field that saves when it is left", () => {
  /** Stands in for the store: the saved value comes back as the prop. */
  function Harness({ onCommit, multiline }: { onCommit: (next: string) => void; multiline?: boolean }) {
    const [saved, setSaved] = useState("");
    return (
      <>
        <DraftField
          value={saved}
          multiline={multiline}
          aria-label="Insurance carrier"
          onCommit={(next) => {
            onCommit(next);
            setSaved(next);
          }}
        />
        <button onClick={() => setSaved("State Farm")}>somebody else saves</button>
      </>
    );
  }

  it("keeps every letter and saves once, not once per key", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const field = screen.getByLabelText("Insurance carrier") as HTMLInputElement;

    await user.type(field, "Farmers Insurance");
    expect(field.value).toBe("Farmers Insurance");
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Farmers Insurance");
  });

  it("keeps what was typed on screen while the save is still on its way", async () => {
    // A real association's value only moves once the write is read back.
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<DraftField value="" aria-label="Insurance carrier" onCommit={onCommit} />);
    const field = screen.getByLabelText("Insurance carrier") as HTMLInputElement;

    await user.type(field, "Farmers");
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith("Farmers");
    expect(field.value).toBe("Farmers");
  });

  it("saves on Enter in a single line, and does not save an unchanged field", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const field = screen.getByLabelText("Insurance carrier");

    await user.click(field);
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();

    await user.type(field, "Farmers{Enter}");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Farmers");
  });

  it("takes a value saved from elsewhere", async () => {
    const user = userEvent.setup();
    render(<Harness onCommit={vi.fn()} />);
    const field = screen.getByLabelText("Insurance carrier") as HTMLInputElement;

    await user.click(screen.getByText("somebody else saves"));
    expect(field.value).toBe("State Farm");
  });

  it("does not let a save landing wipe the words typed since", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const { rerender } = render(<DraftField value="" aria-label="Insurance carrier" onCommit={onCommit} />);
    const field = screen.getByLabelText("Insurance carrier") as HTMLInputElement;

    // Leaves the field, comes straight back and carries on typing; then the
    // first save is read back while the cursor is still in the box.
    await user.type(field, "Farmers");
    await user.tab();
    await user.type(field, " Insurance");
    rerender(<DraftField value="Farmers" aria-label="Insurance carrier" onCommit={onCommit} />);
    expect(field.value).toBe("Farmers Insurance");

    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith("Farmers Insurance");
  });

  it("lets Enter make a new line in the longer field, and saves on leaving", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness multiline onCommit={onCommit} />);
    const field = screen.getByLabelText("Insurance carrier");

    await user.type(field, "Pool closes{Enter}on Labor Day");
    expect(onCommit).not.toHaveBeenCalled();
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith("Pool closes\non Labor Day");
  });
});

describe("a home's own dues in the browser copy", () => {
  it("Change dues writes the amount onto the home and says it from the next bill", async () => {
    const user = userEvent.setup();
    wrap(<HomeownersScreen />);
    // The President may change finances; nobody is signed in to begin with.
    act(() => seen.state.signIn("acct-arya"));
    const home = seen.state.community.homes.find((o) => !o.placeholder)!;
    const standard = homeDues(seen.state.community.association, { homeType: home.homeType });

    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.click(screen.getByRole("button", { name: `Change the dues for ${home.displayName}` }));
    // What it pays now, and where that comes from, before anything is typed.
    expect(screen.getByText(/Pays .* a month now, from /)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Dues for this home"));
    await user.type(screen.getByLabelText("Dues for this home"), String(standard / 100 + 75));
    await user.click(screen.getByRole("button", { name: "Save dues" }));

    const after = seen.state.community.homes.find((o) => o.id === home.id)!;
    expect(after.duesCents).toBe(standard + 7_500);
    expect(homeDues(seen.state.community.association, after)).toBe(standard + 7_500);
    // The neighbour is untouched.
    const other = seen.state.community.homes.find((o) => o.id !== home.id)!;
    expect(other.duesCents).toBeUndefined();
    expect(await screen.findByText(/pays .* from the next bill\./)).toBeInTheDocument();
  });

  it("Use the standard rate clears it again", async () => {
    const user = userEvent.setup();
    wrap(<HomeownersScreen />);
    act(() => seen.state.signIn("acct-arya"));
    const home = seen.state.community.homes.find((o) => !o.placeholder)!;
    await act(async () => {
      await seen.state.setHomeDues([{ homeId: home.id, cents: 41_000 }]);
    });
    await user.click(screen.getByRole("button", { name: `Message ${home.displayName}` }));
    await user.click(screen.getByRole("button", { name: `Change the dues for ${home.displayName}` }));
    expect(screen.getByText(/from its own amount/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use the standard rate" }));
    expect(seen.state.community.homes.find((o) => o.id === home.id)!.duesCents).toBeUndefined();
  });

  it("the form offers the standard rate only to a home that has its own amount", () => {
    render(
      <ChangeDuesForm
        unit="12"
        period="month"
        nowCents={28_500}
        sourceLabel="the association's rate"
        hasOwn={false}
        standardCents={28_500}
        onSave={async () => true}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Use the standard rate" })).not.toBeInTheDocument();
    expect(screen.getByText(/Pays \$285\.00 a month now, from the association's rate/)).toBeInTheDocument();
  });

  it("the form stays open when the write says it was refused", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ChangeDuesForm
        unit="12"
        period="month"
        nowCents={28_500}
        sourceLabel="the association's rate"
        hasOwn={false}
        standardCents={28_500}
        onSave={async () => false}
        onCancel={onCancel}
      />,
    );
    await user.clear(screen.getByLabelText("Dues for this home"));
    await user.type(screen.getByLabelText("Dues for this home"), "310");
    await user.click(screen.getByRole("button", { name: "Save dues" }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("dues for a home and the association's rate refuse more than $100,000, a third decimal and 12e3", () => {
    const onSave = vi.fn(async () => true);
    render(
      <ChangeDuesForm
        unit="12"
        period="month"
        nowCents={28_500}
        sourceLabel="the association's rate"
        hasOwn={false}
        standardCents={28_500}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    const save = screen.getByRole("button", { name: "Save dues" });
    for (const [typed, message] of [
      ["10000000", "That looks too high. Dues are per home, per period."],
      ["285.555", "Enter dollars and cents, like 285.00"],
      ["12e3", "Enter dollars and cents, like 285.00"],
    ]) {
      fireEvent.change(screen.getByLabelText("Dues for this home"), { target: { value: typed } });
      expect(save).toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
    }
    fireEvent.change(screen.getByLabelText("Dues for this home"), { target: { value: "100000" } });
    expect(save).toBeEnabled();
  });

  it("the association rate field refuses what the home form refuses", () => {
    wrap(<DuesSettings />);
    const field = screen.getByLabelText(/^Each home, per month/);
    const save = screen.getByRole("button", { name: "Save dues" });
    for (const typed of ["99999999", "285.555", "12e3"]) {
      fireEvent.change(field, { target: { value: typed } });
      expect(save).toBeDisabled();
    }
    fireEvent.change(field, { target: { value: "290" } });
    expect(save).toBeEnabled();
  });

  it("the dues settings card says how many homes pay their own amount, with a link", async () => {
    wrap(<DuesSettings />);
    expect(screen.queryByText(/pay their own amount|pays its own amount/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Each home, per month/)).toBeInTheDocument();

    const [a, b, c] = seen.state.community.homes;
    await act(async () => {
      await seen.state.setHomeDues([
        { homeId: a.id, cents: 31_000 },
        { homeId: b.id, cents: 33_000 },
        { homeId: c.id, cents: 35_000 },
      ]);
    });
    expect(screen.getByText(/3 homes pay their own amount/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See them on Homeowners" })).toHaveAttribute("href", "/board/homeowners");
    // The standard rate is still its own field, no longer "each home".
    expect(screen.getByLabelText(/^Standard rate, per month/)).toBeInTheDocument();
  });
});
