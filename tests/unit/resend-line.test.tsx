import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const resend = vi.fn();
vi.mock("@/app/join/resend", () => ({ resendConfirmation: resend }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const { ResendLine } = await import("@/app/join/join-panel");

beforeEach(() => resend.mockReset());

describe("Send it again", () => {
  it("says Sent again when the email went", async () => {
    resend.mockResolvedValue({ ok: true });
    render(<ResendLine email="pat@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: "Send it again" }));

    expect(resend).toHaveBeenCalledWith("pat@example.com");
    expect(await screen.findByText("Sent again")).toBeInTheDocument();
  });

  it("says why when the limiter refused", async () => {
    resend.mockResolvedValue({ ok: false, message: "Too many attempts. Wait a minute and try again." });
    render(<ResendLine email="pat@example.com" />);

    await userEvent.click(screen.getByRole("button", { name: "Send it again" }));

    expect(await screen.findByText("Too many attempts. Wait a minute and try again.")).toBeInTheDocument();
    expect(screen.queryByText("Sent again")).not.toBeInTheDocument();
  });
});
