import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { todayIsoDate } from "@/lib/utils";

/**
 * What the two request forms say after the write answers.
 *
 * A real association's request is numbered by the database, so the form's own
 * number is a guess and is never shown or linked to. And a write that failed
 * must not land on "Request submitted": the owner would wait on a request the
 * board never received.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/resident/requests/new",
  useSearchParams: () => new URLSearchParams(),
}));

// What the state layer answers a new request with. Today nothing; soon a
// promise of the stored reference, or of null when the write failed.
let answer: () => unknown = () => undefined;
let isRemote = true;
const addRequest = vi.fn(() => answer());

const owner = { id: "unit-4", displayName: "Pat Okafor", unit: "4", members: ["Pat Okafor"] };
const forms = [
  {
    id: "fence",
    label: "Fence application",
    description: "For a new or replaced fence.",
    fileName: "fence-application.pdf",
    size: "120 KB",
    updatedDate: "2026-01-10",
    decisionDays: 30,
    fields: [{ id: "what", label: "What are you building", kind: "short", required: true }],
  },
  {
    id: "paint",
    label: "Paint colours",
    description: "Exterior paint.",
    fileName: "paint-colours.pdf",
    size: "80 KB",
    updatedDate: "2026-01-10",
  },
];

vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => ({
    amenities: [],
    forms,
    addRequest,
    isRemote,
    requests: [],
    community: { association: { name: "Willow Creek Estates" }, forms, amenityBookings: [] },
  }),
  useCurrentOwner: () => owner,
}));

const { ToastProvider } = await import("@/components/app/toast");
const { NewRequestForm } = await import("@/app/resident/requests/new/form");
const { FillForm } = await import("@/app/resident/documents/forms/[formId]/fill-form");

const wrap = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
// The number either form makes up when the owner has no requests yet.
const guess = () => `REQ-${todayIsoDate().slice(0, 4)}-200`;

beforeEach(() => {
  answer = () => undefined;
  isRemote = true;
  addRequest.mockClear();
  // The signature pad asks for a canvas, which this browser stand-in lacks.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

describe("the new request form", () => {
  async function send() {
    const user = userEvent.setup();
    wrap(<NewRequestForm />);
    await user.click(screen.getByRole("button", { name: /Maintenance/ }));
    await user.type(screen.getByPlaceholderText("Short summary"), "Gate will not close");
    await user.click(screen.getByRole("button", { name: "Send request" }));
  }

  it("says it did not send when the write answers null, and stays on the form", async () => {
    answer = () => Promise.resolve(null);
    await send();

    expect(addRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent("That did not send");
    expect(screen.queryByText("Request submitted")).not.toBeInTheDocument();
    // Still filled in, and the button is live again for a second try.
    expect(screen.getByPlaceholderText("Short summary")).toHaveValue("Gate will not close");
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it("clears the failure once a second try lands", async () => {
    const answers: unknown[] = [null, "REQ-2026-201"];
    answer = () => Promise.resolve(answers.shift());
    await send();
    await screen.findByRole("alert");
    await userEvent.setup().click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Request submitted")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the number the database stored, never the form's guess", async () => {
    answer = () => Promise.resolve("REQ-2026-201");
    await send();

    expect(await screen.findByText("Request submitted")).toBeInTheDocument();
    expect(screen.getByText("Reference REQ-2026-201")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(guess()))).not.toBeInTheDocument();
  });
});

describe("a form filled in on the page", () => {
  async function sign() {
    const user = userEvent.setup();
    wrap(<FillForm formId="fence" />);
    await user.type(screen.getByRole("textbox", { name: /What are you building/ }), "Cedar fence");
    await user.type(screen.getByPlaceholderText("Rhea Calloway"), "Pat Okafor");
    await user.click(screen.getByRole("button", { name: "Sign and submit" }));
  }

  it("sends a real association to its requests, with no guessed number anywhere", async () => {
    await sign();

    expect(await screen.findByText("Sent to the committee")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track it" })).toHaveAttribute("href", "/resident/requests");
    // Not on the card and not in the toast.
    expect(screen.queryByText(new RegExp(guess()))).not.toBeInTheDocument();
    expect(screen.getByText(/Its number is in your requests/)).toBeInTheDocument();
  });

  it("shows the stored number once the write answers with it", async () => {
    answer = () => Promise.resolve("REQ-2026-201");
    await sign();

    expect(await screen.findByText("Sent to the committee")).toBeInTheDocument();
    expect(screen.getByText("REQ-2026-201")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track it" })).toHaveAttribute("href", "/resident/requests");
  });

  it("says it did not send when the write answers null", async () => {
    answer = () => Promise.resolve(null);
    await sign();

    expect(await screen.findByRole("alert")).toHaveTextContent("That did not send");
    expect(screen.queryByText("Sent to the committee")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign and submit" })).toBeEnabled();
  });

  it("keeps the demo's own number and its link to the request", async () => {
    isRemote = false;
    await sign();

    expect(await screen.findByText("Sent to the committee")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track it" })).toHaveAttribute(
      "href",
      `/resident/requests/${guess()}`,
    );
    expect(screen.getAllByText(new RegExp(guess())).length).toBeGreaterThan(0);
  });

  it("offers no file for a printed form, since there is none behind it", () => {
    wrap(<FillForm formId="paint" />);

    expect(screen.getByText(/Ask the board for a copy/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /paint-colours\.pdf/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Download it/)).not.toBeInTheDocument();
  });
});
