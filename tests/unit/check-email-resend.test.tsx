import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyDraft } from "@/lib/data";

/**
 * The two wizard states that wait on a confirmation email: the account step
 * after the account is made, and the panel after setup finishes. Both carry
 * the same "send it again" the join page has (ResendLine), so a lost email
 * never strands a founder.
 */

const { resend } = vi.hoisted(() => ({
  resend: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/components/app/resend-confirmation", () => ({ resendConfirmation: resend }));

const { AccountStep, CheckEmailPanel } = await import("@/app/start/account-step");

const draft = {
  ...emptyDraft(),
  name: "Willow Creek Estates",
  founder: { name: "Pat Founder", email: "pat@example.com", unit: "1" },
};

beforeEach(() => resend.mockClear());

describe("the account step while the email is unconfirmed", () => {
  it("says the account is ready and offers to send the link again", async () => {
    const user = userEvent.setup();
    render(
      <AccountStep
        draft={draft}
        patch={() => undefined}
        status="awaiting"
        onExplore={() => undefined}
        onCreated={() => undefined}
        onContinue={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your account is ready" })).toBeInTheDocument();
    expect(screen.getByText(/pat@example.com/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send it again" }));
    expect(resend).toHaveBeenCalledWith("pat@example.com");
    expect(await screen.findByText("Sent again")).toBeInTheDocument();
  });

  it("does not offer a resend before any account exists", () => {
    render(
      <AccountStep
        draft={draft}
        patch={() => undefined}
        status="none"
        onExplore={() => undefined}
        onCreated={() => undefined}
        onContinue={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Start with an account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send it again" })).not.toBeInTheDocument();
  });
});

describe("the panel that holds a finished setup", () => {
  it("says where the link went and offers to send it again", async () => {
    const user = userEvent.setup();
    render(<CheckEmailPanel draft={draft} email="pat@example.com" />);

    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send it again" }));
    expect(resend).toHaveBeenCalledWith("pat@example.com");
  });
});
