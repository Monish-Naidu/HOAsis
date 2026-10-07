import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * A preview inside an hour of a real run passes over everybody that run
 * reached. The screen has to say so, or "0 households would receive this"
 * reads as an empty list.
 */

vi.mock("@/components/app/email-delivery", () => ({ EmailDelivery: () => null }));
vi.mock("@/lib/metrics", async (original) => ({
  ...(await original<typeof import("@/lib/metrics")>()),
  delinquency: () => ({ past: [], totalCents: 0 }),
}));
vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => ({
    isRemote: true,
    community: {
      id: "assoc-1",
      nextChargeDate: "2026-11-01",
      association: { duesCents: 28_500 },
      homes: [{ id: "o1", email: "ana@example.com" }],
    },
  }),
}));

const { ToastProvider } = await import("@/components/app/toast");
const { DuesMailer, outcomeLine, sendToast } = await import("@/components/app/dues-mailer");

describe("outcomeLine", () => {
  const none = { sent: 0, failed: 0, skipped: 0, errors: [] };

  it("says who already has the notice, apart from who was skipped", () => {
    expect(outcomeLine({ ...none, already: 12, dryRun: true })).toBe(
      "0 households would receive this, 12 already sent in the last hour",
    );
    expect(outcomeLine({ ...none, sent: 3, already: 12, skipped: 2, failed: 1, dryRun: false })).toBe(
      "3 emails sent, 12 already sent in the last hour, 2 skipped, 1 failed",
    );
  });

  it("says nothing about it when nobody was, or the answer has no such count", () => {
    expect(outcomeLine({ ...none, sent: 14, already: 0, dryRun: true })).toBe(
      "14 households would receive this",
    );
    expect(outcomeLine({ ...none, sent: 14, skipped: 1, dryRun: false })).toBe("14 emails sent, 1 skipped");
  });
});

describe("sendToast", () => {
  it("does not call a second press within the hour nobody to send to", () => {
    expect(sendToast({ sent: 0, failed: 0, already: 12 })).toEqual({
      message: "Nothing new to send. 12 already sent in the last hour.",
      tone: "info",
    });
    expect(sendToast({ sent: 0, failed: 0, already: 0 })).toEqual({
      message: "Nobody to send to",
      tone: "info",
    });
  });

  it("keeps the count beside a run that did send", () => {
    expect(sendToast({ sent: 3, failed: 0, already: 12 })).toEqual({
      message: "3 emails sent, 12 already sent in the last hour",
      tone: "ok",
    });
    expect(sendToast({ sent: 3, failed: 0 })).toEqual({ message: "3 emails sent", tone: "ok" });
    expect(sendToast({ sent: 0, failed: 2, already: 12 }).tone).toBe("warn");
  });
});

describe("the dues email card", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the already sent count under a preview", async () => {
    const fetched = vi.fn<typeof fetch>(
      async () =>
        ({
          ok: true,
          json: async () => ({ sent: 0, failed: 0, skipped: 0, already: 12, remaining: 0, errors: [] }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetched);
    render(
      <ToastProvider>
        <DuesMailer />
      </ToastProvider>,
    );

    await userEvent.setup().click(screen.getAllByRole("button", { name: "Preview" })[0]);

    expect(
      await screen.findByText("0 households would receive this, 12 already sent in the last hour"),
    ).toBeInTheDocument();
    expect(JSON.parse(String(fetched.mock.calls[0][1]?.body))).toMatchObject({ dryRun: true });
  });
});
