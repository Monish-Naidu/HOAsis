import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { HomeRequest } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board/requests",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { default: BoardRequests } = await import("@/app/board/requests/page");
const { RequestDetail } = await import("@/app/board/requests/request-detail");

/**
 * The board opening a request: what it reads, what it can answer, and who is
 * offered the buttons. The database half of the reply and the denial is in
 * app-state-remote.test.tsx.
 */

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

const LONG = `${"The fence along the east lot line needs to come down for the drainage work. ".repeat(4)}Second paragraph.`;

function request(over: Partial<HomeRequest> = {}): HomeRequest {
  const home = seen.state.community.homes[0];
  return {
    id: "req-open-1",
    reference: "REQ-2026-901",
    homeId: home.id,
    ownerName: home.displayName,
    unit: home.unit,
    kind: "architectural",
    title: "Replace the east fence",
    summary: LONG,
    status: "submitted",
    submittedDate: "2026-08-10",
    dueDate: "2026-08-31",
    dueReason: "Bylaws give the board 30 days",
    attachments: [{ name: "fence-plan.pdf", size: "212 KB" }],
    thread: [
      { id: "t1", at: "2026-08-10", actor: home.displayName, actorRole: "resident", body: "Sent for review.", kind: "note" },
      { id: "t2", at: "2026-08-11", actor: "Arya Patel", actorRole: "board", body: "Received, thank you.", kind: "note" },
    ],
    submission: {
      formId: "f1",
      formLabel: "Home change form",
      answers: [
        { fieldId: "a", label: "Material", value: "Cedar" },
        { fieldId: "b", label: "Height in feet", value: "6" },
        { fieldId: "c", label: "Left blank", value: "" },
      ],
      signature: { typedName: "Pat Owner", signedAt: "2026-08-10T10:00:00Z" } as never,
    },
    ...over,
  };
}

function open(id: string) {
  return screen.getByTestId(`request-detail-${id}`);
}

describe("a request opened by the board", () => {
  it("shows everything the owner sent, in full", () => {
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
    });
    const detail = within(open("req-open-1"));
    // The whole description, not two lines of it.
    expect(detail.getByText(LONG)).toBeInTheDocument();
    // The answers of the form it came from, with the blank one left out.
    expect(detail.getByText("Material")).toBeInTheDocument();
    expect(detail.getByText("Cedar")).toBeInTheDocument();
    expect(detail.getByText("Height in feet")).toBeInTheDocument();
    expect(detail.queryByText("Left blank")).not.toBeInTheDocument();
    expect(detail.getByText(/Signed by Pat Owner/)).toBeInTheDocument();
    // Names of the files, the dates and the deadline line.
    expect(detail.getByText("fence-plan.pdf")).toBeInTheDocument();
    expect(detail.getByText(/Sent August 10, 2026/)).toBeInTheDocument();
    expect(detail.getByText(/answer by August 31, 2026 \(Bylaws give the board 30 days\)/)).toBeInTheDocument();
  });

  it("shows the conversation oldest first", () => {
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
    });
    const detail = within(open("req-open-1"));
    const first = detail.getByText("Sent for review.");
    const second = detail.getByText("Received, thank you.");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("appends a reply and keeps two quick ones", async () => {
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
    });
    await act(async () => {
      await Promise.all([
        seen.state.replyToRequest("req-open-1", "Which colour?"),
        seen.state.replyToRequest("req-open-1", "And the height."),
      ]);
    });
    const thread = seen.state.requests.find((r) => r.id === "req-open-1")!.thread;
    expect(thread.slice(2).map((e) => e.body)).toEqual(["Which colour?", "And the height."]);
    expect(new Set(thread.map((e) => e.id)).size).toBe(thread.length);
    expect(thread.at(-1)).toMatchObject({ kind: "note", actorRole: "board" });
    // No decision came with it, but the review has started.
    expect(seen.state.requests.find((r) => r.id === "req-open-1")!.status).toBe("in-review");
  });

  it("sends the box's words through Reply to the owner and clears it once saved", async () => {
    const user = userEvent.setup();
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
    });
    const box = within(open("req-open-1")).getByLabelText("Reply to the owner");
    await user.type(box, "Please send the colour.");
    await user.click(within(open("req-open-1")).getByRole("button", { name: "Send" }));
    expect(seen.state.requests.find((r) => r.id === "req-open-1")!.thread.at(-1)?.body).toBe("Please send the colour.");
    expect(box).toHaveValue("");
  });

  it("keeps the words in the box when the reply is not saved", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn(async () => false);
    wrap(<RequestDetail request={request()} canChange onReply={onReply} />);
    const box = screen.getByLabelText("Reply to the owner");
    await user.type(box, "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onReply).toHaveBeenCalledWith("req-open-1", "Hello");
    expect(box).toHaveValue("Hello");
  });

  it("refuses to deny without a reason, then saves the one it is given", async () => {
    const user = userEvent.setup();
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
    });
    const row = document.getElementById("req-req-open-1")!;
    await user.click(within(row).getByRole("button", { name: "Deny" }));
    await user.click(within(row).getByRole("button", { name: "Deny it" }));
    expect(within(row).getByRole("alert")).toHaveTextContent("Give the owner a reason");
    expect(seen.state.requests.find((r) => r.id === "req-open-1")!.status).toBe("submitted");

    await user.type(within(row).getByLabelText(/Why is it denied/), "Over the height limit");
    await user.click(within(row).getByRole("button", { name: "Deny it" }));
    const saved = seen.state.requests.find((r) => r.id === "req-open-1")!;
    expect(saved.status).toBe("denied");
    expect(saved.thread.at(-1)).toMatchObject({ kind: "status", body: "Denied. Over the height limit" });
  });

  it("approves in one press", async () => {
    const user = userEvent.setup();
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
    });
    const row = document.getElementById("req-req-open-1")!;
    await user.click(within(row).getByRole("button", { name: "Approve" }));
    expect(seen.state.requests.find((r) => r.id === "req-open-1")!.status).toBe("approved");
  });

  it("shows a seat that may only look the request and the conversation, and no action", () => {
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
      seen.state.setCapability("acct-dana", "requests", "view");
    });
    act(() => seen.state.signIn("acct-dana"));
    expect(seen.state.can("requests")).toBe(false);
    const row = document.getElementById("req-req-open-1")!;
    expect(within(open("req-open-1")).getByText(LONG)).toBeInTheDocument();
    expect(within(row).getByText("Received, thank you.")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Deny" })).not.toBeInTheDocument();
    expect(within(row).queryByLabelText("Reply to the owner")).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("keeps a maintenance request unscheduled after a reply and says it was replied to", async () => {
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request({ id: "req-fix-1", reference: "REQ-2026-902", kind: "maintenance", title: "Streetlight out", summary: "Dark since Monday.", thread: [] }));
    });
    await act(async () => {
      await seen.state.replyToRequest("req-fix-1", "We have asked the electrician.");
    });
    expect(seen.state.requests.find((r) => r.id === "req-fix-1")!.status).toBe("submitted");
    const row = document.getElementById("req-req-fix-1")!;
    expect(within(row).getByText("Not scheduled")).toBeInTheDocument();
    expect(within(row).getByText(/^Replied /)).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /work order/i })).not.toBeInTheDocument();
  });

  it("groups by what the board does next", () => {
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request());
      seen.state.addRequest(request({ id: "req-fix-2", reference: "REQ-2026-903", kind: "maintenance", title: "Gate sticks", thread: [] }));
    });
    expect(screen.getAllByText("Needs a decision").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs scheduling").length).toBeGreaterThan(0);
  });

  it("schedules a maintenance request with an optional date, then marks it fixed with a note to the owner", async () => {
    const user = userEvent.setup();
    wrap(<BoardRequests />);
    act(() => {
      seen.state.signIn("acct-arya");
      seen.state.addRequest(request({ id: "req-fix-3", reference: "REQ-2026-904", kind: "maintenance", title: "Gate sticks", thread: [] }));
    });
    const row = () => document.getElementById("req-req-fix-3")!;
    await user.click(within(row()).getByRole("button", { name: "Schedule it" }));
    await user.click(within(row()).getAllByRole("button", { name: "Schedule it" }).at(-1)!);
    let saved = seen.state.requests.find((r) => r.id === "req-fix-3")!;
    expect(saved.status).toBe("in-review");
    expect(saved.thread.at(-1)?.body).toBe("Scheduled.");
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);

    await user.click(within(row()).getByRole("button", { name: "Mark fixed" }));
    // Nothing closes until it is confirmed.
    expect(seen.state.requests.find((r) => r.id === "req-fix-3")!.status).toBe("in-review");
    await user.type(within(row()).getByLabelText(/Note to the owner/), "New latch fitted.");
    await user.click(within(row()).getByRole("button", { name: "Mark fixed and tell the owner" }));
    saved = seen.state.requests.find((r) => r.id === "req-fix-3")!;
    expect(saved.status).toBe("closed");
    expect(saved.thread.at(-1)?.body).toMatch(/^Fixed on .*\. New latch fitted\.$/);
  });
});
