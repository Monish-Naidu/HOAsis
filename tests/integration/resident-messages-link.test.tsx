import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";

const query = "subject=REQ-2026-901%3A%20Paint%20the%20house&about=Architectural";
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/resident/messages",
  useSearchParams: () => new URLSearchParams(query),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { MessagesScreen } = await import("@/app/resident/messages/messages-screen");

/**
 * A question about a request opens Messages with the request's subject and
 * topic filled in, and a reload of that link must not open a second form for
 * a conversation that already exists.
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

async function signedIn(ui: ReactNode) {
  await act(async () => {
    mount(null);
  });
  await act(async () => {
    seen.state.signIn("acct-monish");
  });
  await act(async () => {
    mount(ui);
  });
}

describe("Message the board, from a request", () => {
  it("opens the form with the request's topic and says why Send is off", async () => {
    await signedIn(<MessagesScreen />);
    expect(screen.getByLabelText("What it is about")).toHaveValue("Architectural");
    expect(screen.getByLabelText("Subject")).toHaveValue("REQ-2026-901: Paint the house");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByText("Write your message to send.")).toBeVisible();
  });

  it("clears the link from the address once the message is sent, so a reload is safe", async () => {
    const user = userEvent.setup();
    replace.mockClear();
    await signedIn(<MessagesScreen />);
    await user.type(screen.getByLabelText("Message"), "Can you confirm the paint color?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Conversations")).toBeVisible();
    expect(replace).toHaveBeenCalledWith("/resident/messages");
  });

  it("does not reopen the form for a conversation that is already there", async () => {
    await act(async () => {
      mount(null);
    });
    await act(async () => {
      seen.state.signIn("acct-monish");
    });
    await act(async () => {
      await seen.state.messageBoard(
        "own-042",
        "REQ-2026-901: Paint the house",
        "Can you confirm the paint color?",
        "Architectural",
        "board",
      );
    });
    await act(async () => {
      mount(<MessagesScreen />);
    });
    expect(screen.queryByLabelText("What it is about")).not.toBeInTheDocument();
    expect(screen.getByText("REQ-2026-901: Paint the house")).toBeVisible();
  });
});
