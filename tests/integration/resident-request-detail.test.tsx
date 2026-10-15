import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/resident/requests/REQ-2026-901",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { default: RequestDetail } = await import("@/app/resident/requests/[reference]/page");
const { REQUEST_SEEN_PROMISE } = await import("@/lib/resident-wording");

/**
 * An owner's own request, as the page shows it: dates the way every other
 * screen writes them, the response time the form promised, no line that was
 * only true before sending, and a way to add a note.
 */

const seen = { state: null as unknown as ReturnType<typeof useAppState> };
function Probe() {
  const state = useAppState();
  useEffect(() => {
    seen.state = state;
  });
  return null;
}

function mount(ui: ReactNode) {
  return render(
    <AppStateProvider>
      <ToastProvider>
        <Probe />
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  );
}

async function openWith(thread: { body: string; actorRole: "system" | "resident" | "board" }[]) {
  await act(async () => {
    mount(null);
  });
  await act(async () => {
    seen.state.signIn("acct-monish");
  });
  const form = seen.state.forms.find((f) => f.decisionDays && f.fields?.length);
  const home = seen.state.community.homes.find((h) => h.id === "own-042")!;
  await act(async () => {
    seen.state.addRequest({
      id: "req-901",
      reference: "REQ-2026-901",
      kind: "architectural",
      title: "Paint the house",
      summary: "Planned start date: 2027-03-01",
      homeId: home.id,
      ownerName: home.displayName,
      unit: home.unit,
      status: "submitted",
      submittedDate: "2026-08-20",
      dueDate: "2026-10-10",
      dueReason: "ARC must respond within 30 days",
      attachments: [],
      thread: thread.map((e, i) => ({
        id: `rt-901-${i}`,
        at: "2026-08-20",
        actor: e.actorRole === "system" ? "Your HOAsis" : "Monish Naidu",
        actorRole: e.actorRole,
        body: e.body,
        kind: e.actorRole === "system" ? ("status" as const) : ("note" as const),
      })),
      submission: {
        formId: form!.id,
        formLabel: form!.label,
        answers: [{ fieldId: "f-start", label: "Planned start date", value: "2027-03-01" }],
        signature: { typedName: "Monish Naidu", signedAt: "2026-08-20", statement: "Signed." },
      },
    });
  });
}

async function detail() {
  await act(async () => {
    mount(<RequestDetail params={Promise.resolve({ reference: "REQ-2026-901" })} />);
  });
}

describe("a request already sent", () => {
  it("writes dates in words and the clock at the form's own length", async () => {
    await openWith([
      { body: "Submitted.", actorRole: "resident" },
      {
        body: "Routed to the committee. 30-day response clock expires 2026-10-10.",
        actorRole: "system",
      },
    ]);
    await detail();
    expect(screen.queryByText(/2027-03-01|2026-10-10/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/March 1, 2027/).length).toBeGreaterThan(0);
    expect(screen.getByText(/45-day response clock expires October 10, 2026/)).toBeVisible();
    expect(screen.getByText(/must respond within 45 days/)).toBeVisible();
  });

  it("drops the promise made before sending from the activity", async () => {
    await openWith([
      { body: "Submitted.", actorRole: "resident" },
      { body: REQUEST_SEEN_PROMISE, actorRole: "system" },
    ]);
    await detail();
    expect(screen.queryByText(REQUEST_SEEN_PROMISE)).not.toBeInTheDocument();
  });

  it("lets the owner add a note, which lands on the thread", async () => {
    const user = userEvent.setup();
    await openWith([{ body: "Submitted.", actorRole: "resident" }]);
    await detail();
    const send = screen.getByRole("button", { name: "Send note" });
    expect(send).toBeDisabled();
    expect(screen.getByText("Write a note to send it.")).toBeVisible();

    await user.type(
      screen.getByLabelText(/Add a note for the board/),
      "The gate stays on the north side.",
    );
    await user.click(send);
    expect(await screen.findByText("The gate stays on the north side.")).toBeVisible();
    // The box empties once the note is on the thread.
    expect(screen.getByLabelText(/Add a note for the board/)).toHaveValue("");
  });

  it("opens Messages on the request's topic", async () => {
    await openWith([{ body: "Submitted.", actorRole: "resident" }]);
    await detail();
    const link = screen.getByRole("link", { name: /Message the board/ });
    expect(link.getAttribute("href")).toContain("about=Architectural");
    expect(link.getAttribute("href")).toContain(
      encodeURIComponent("REQ-2026-901: Paint the house"),
    );
  });
});
