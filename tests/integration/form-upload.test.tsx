import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));

const { AppStateProvider, useAppState } = await import("@/lib/app-state");
const { ToastProvider } = await import("@/components/app/toast");
const { RemoteErrorToasts } = await import("@/components/app/remote-error-toasts");
const { FormUploadForm } = await import("@/app/board/settings/settings-screen");

/**
 * The demo side of the form upload fix: the bytes are kept with the form,
 * a seat that may only look cannot add one, and a failed save leaves the
 * form's inputs in place for one more try.
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

function wrap(ui: ReactNode, as: string) {
  const rendered = render(
    <AppStateProvider>
      <ToastProvider>
        <RemoteErrorToasts />
        <Probe />
        {ui}
      </ToastProvider>
    </AppStateProvider>,
  );
  act(() => seen.state.signIn(as));
  return rendered;
}

const BYTES = "%PDF-1.4 demo form bytes, known and nonempty\n";
const upload = () => new File([BYTES], "pool-rules.pdf", { type: "application/pdf" });

/** The bytes a data URL carries, decoded. */
function bytesOf(dataUrl: string): string {
  return Buffer.from(dataUrl.split(",")[1], "base64").toString("utf8");
}

describe("a form upload in the demo", () => {
  it("keeps the file's bytes with the form, and opens them back exactly", async () => {
    wrap(<div />, "acct-arya");
    const before = seen.state.community.forms.length;

    let ok: boolean | undefined;
    await act(async () => {
      ok = await seen.state.uploadForm("Pool rules", upload());
    });

    expect(ok).toBe(true);
    const forms = seen.state.community.forms;
    expect(forms.length).toBe(before + 1);
    const added = forms.find((f) => f.label === "Pool rules")!;
    expect(added.source).toBe("uploaded");
    expect(added.fileName).toBe("pool-rules.pdf");
    expect(added.fileUrl).toMatch(/^data:application\/pdf/);
    // Byte identical, not a placeholder and not a re-rendered copy.
    expect(bytesOf(added.fileUrl!)).toBe(BYTES);
  });

  it("removes the form and its bytes together", async () => {
    wrap(<div />, "acct-arya");
    let ok: boolean | undefined;
    await act(async () => {
      ok = await seen.state.uploadForm("Fence request", upload());
    });
    expect(ok).toBe(true);
    const added = seen.state.community.forms.find((f) => f.label === "Fence request")!;

    act(() => void seen.state.removeForm(added.id));

    expect(seen.state.community.forms.find((f) => f.id === added.id)).toBeUndefined();
  });

  it("refuses a seat that may only look, and says so", async () => {
    wrap(<div />, "acct-monish");
    const before = seen.state.community.forms.length;

    let ok: boolean | undefined;
    await act(async () => {
      ok = await seen.state.uploadForm("Not allowed", upload());
    });

    expect(ok).toBe(false);
    expect(seen.state.community.forms.length).toBe(before);
    expect(screen.getByRole("alert").textContent).toContain("You can look here, not change it");
  });
});

describe("the upload form on screen", () => {
  it("clears its boxes once the form is saved, and lists the form", async () => {
    const user = userEvent.setup();
    wrap(<FormUploadForm />, "acct-arya");

    await user.type(screen.getByLabelText("New form label"), "Solar packet");
    await user.upload(screen.getByLabelText("New form file"), upload());
    await user.click(screen.getByRole("button", { name: "Upload" }));

    await screen.findByText(/Added Solar packet\./);
    expect((screen.getByLabelText("New form label") as HTMLInputElement).value).toBe("");
    const added = seen.state.community.forms.find((f) => f.label === "Solar packet")!;
    expect(bytesOf(added.fileUrl!)).toBe(BYTES);
  });

  it("a failed save keeps the label and the file and says to try again", async () => {
    const user = userEvent.setup();
    // The President is the only seat that may change settings, so the
    // resident's save is refused: the deterministic failure, no mock needed.
    wrap(<FormUploadForm />, "acct-monish");
    const before = seen.state.community.forms.length;

    await user.type(screen.getByLabelText("New form label"), "Gate schedule");
    await user.upload(screen.getByLabelText("New form file"), upload());
    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("The form was not saved. Try again.")).toBeInTheDocument();
    expect((screen.getByLabelText("New form label") as HTMLInputElement).value).toBe(
      "Gate schedule",
    );
    expect((screen.getByLabelText("New form file") as HTMLInputElement).files?.[0]?.name).toBe(
      "pool-rules.pdf",
    );
    expect(seen.state.community.forms.length).toBe(before);
  });

  it("an invalid file is refused before any save, with the reason visible", async () => {
    const user = userEvent.setup();
    wrap(<FormUploadForm />, "acct-arya");
    const before = seen.state.community.forms.length;

    // An empty PDF passes the accept list and fails the check, so the reason
    // shows before anything is saved.
    await user.type(screen.getByLabelText("New form label"), "Minutes");
    await user.upload(
      screen.getByLabelText("New form file"),
      new File([], "empty.pdf", { type: "application/pdf" }),
    );

    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("The file is empty");
    expect(seen.state.community.forms.length).toBe(before);
  });
});
