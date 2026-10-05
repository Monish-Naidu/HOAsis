import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

/**
 * Screens that said a thing was done before they knew.
 *
 * A save for a signed in association answers later, and can answer no. Each
 * of these toasted its success on the same line as the call, so a seat the
 * database refused was told "saved" and "nothing was changed" together. The
 * state here is a stand-in whose writes answer when the test says.
 */

type Fake = Record<string, unknown>;
const state = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/lib/app-state", async (original) => ({
  ...(await original<typeof import("@/lib/app-state")>()),
  useAppState: () => state.current,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/board",
  useSearchParams: () => new URLSearchParams(),
}));
// The rest of the Meetings page reads far more of the association than this needs.
vi.mock("@/components/app/meeting-room", () => ({ MeetingRoom: () => null }));
vi.mock("@/components/app/schedule-meeting", () => ({ ScheduleMeeting: () => null }));
vi.mock("@/components/app/action-items", () => ({ ActionItems: () => null }));

const { ToastProvider } = await import("@/components/app/toast");
const { ReserveStudyCard } = await import("@/components/app/reserve-study-card");
const { useCoverPhotoUpload } = await import("@/components/app/community-hero");
const { DangerZone } = await import("@/components/app/danger-zone");
const { default: BoardMeetings } = await import("@/app/board/meetings/page");

const inToasts = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

/** A write the test answers when it chooses. */
function held() {
  let answer!: (ok: boolean) => void;
  const promise = new Promise<boolean>((resolve) => (answer = resolve));
  return { promise, answer };
}

beforeEach(() => {
  state.current = {};
});

describe("the reserve study card", () => {
  const filed = { reserveStudy: { documentId: "doc-1", name: "Study 2024.pdf", studyDate: "2024-05-01" } };
  const given = (fake: Fake) => {
    state.current = { community: { settings: {}, documents: [] }, ...fake };
  };

  it("says unlinked only once the save is back", async () => {
    const save = held();
    const updateSettings = vi.fn(() => save.promise);
    given({ community: { settings: filed, documents: [] }, updateSettings });
    render(<ReserveStudyCard />, { wrapper: inToasts });

    await userEvent.click(screen.getByRole("button", { name: "Not the study" }));
    expect(updateSettings).toHaveBeenCalledWith({ reserveStudy: undefined });
    expect(screen.queryByText(/Unlinked/)).not.toBeInTheDocument();

    await act(async () => save.answer(true));
    expect(screen.getByText("Unlinked. The file is still under Documents.")).toBeInTheDocument();
  });

  it("does not say unlinked when the save was refused", async () => {
    given({ community: { settings: filed, documents: [] }, updateSettings: vi.fn(async () => false) });
    render(<ReserveStudyCard />, { wrapper: inToasts });

    await userEvent.click(screen.getByRole("button", { name: "Not the study" }));
    await act(async () => {});
    expect(screen.queryByText(/Unlinked/)).not.toBeInTheDocument();
  });

  it("says the study is on file only when the link to it was saved", async () => {
    const study = new File(["%PDF"], "Study 2024.pdf", { type: "application/pdf" });
    const uploadDocuments = vi.fn(async () => ({
      filed: [{ id: "doc-9", name: "Study 2024.pdf" }],
      rejected: [],
    }));
    const upload = async (updateSettings: () => Promise<boolean>) => {
      given({ uploadDocuments, updateSettings });
      const view = render(<ReserveStudyCard />, { wrapper: inToasts });
      fireEvent.change(screen.getByLabelText("Date on the study"), { target: { value: "2024-05-01" } });
      await userEvent.upload(screen.getByLabelText("Upload the study"), study);
      await act(async () => {});
      return view;
    };

    const refused = await upload(vi.fn(async () => false));
    expect(screen.queryByText(/is on file/)).not.toBeInTheDocument();
    refused.unmount();

    const saved = vi.fn(async () => true);
    await upload(saved);
    expect(saved).toHaveBeenCalledWith({
      reserveStudy: { documentId: "doc-9", name: "Study 2024.pdf", studyDate: "2024-05-01" },
    });
    expect(screen.getByText("Study 2024.pdf is on file. It is under Documents too.")).toBeInTheDocument();
  });
});

describe("the cover photo", () => {
  const photo = new File(["png"], "front-gate.png", { type: "image/png" });
  const choose = async (updateSettings: () => boolean | Promise<boolean>) => {
    state.current = { community: { id: "demo" }, isRemote: false, updateSettings };
    const { result } = renderHook(() => useCoverPhotoUpload(), { wrapper: inToasts });
    await act(async () => {
      await result.current.choose(photo);
    });
  };

  it("says updated when the save took", async () => {
    const updateSettings = vi.fn(() => true);
    await choose(updateSettings);
    expect(updateSettings).toHaveBeenCalledWith({ photoUrl: expect.stringMatching(/^data:image\/png/) });
    expect(screen.getByText("Cover photo updated")).toBeInTheDocument();
  });

  it("does not say updated when it did not", async () => {
    await choose(vi.fn(async () => false));
    expect(screen.queryByText("Cover photo updated")).not.toBeInTheDocument();
  });
});

describe("the meetings page", () => {
  const meeting = {
    id: "mtg-1",
    title: "Annual meeting",
    date: "2099-01-12",
    time: "7:00 PM",
    location: "Clubhouse",
    status: "scheduled",
    agenda: [],
    attendees: [],
    ballotIds: [],
  };
  const open = (sendMeetingNotice: () => boolean | Promise<boolean>) => {
    state.current = {
      community: { meetings: [meeting], association: { id: "assoc-1" } },
      sendMeetingNotice,
    };
    render(<BoardMeetings />, { wrapper: inToasts });
  };

  it("holds Send notice while the notice is going out, and says posted when it is back", async () => {
    const send = held();
    const sendMeetingNotice = vi.fn(() => send.promise);
    open(sendMeetingNotice);

    await userEvent.click(screen.getByRole("button", { name: "Send notice" }));
    const button = screen.getByRole("button", { name: "Sending" });
    expect(button).toBeDisabled();
    expect(screen.queryByText(/posted to every home/)).not.toBeInTheDocument();
    // A press while it is held starts nothing.
    await userEvent.click(button);
    expect(sendMeetingNotice).toHaveBeenCalledTimes(1);

    await act(async () => send.answer(true));
    expect(screen.getByText("Notice of Annual meeting posted to every home")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send notice" })).toBeEnabled();
  });

  it("does not say posted when the notice did not go on record", async () => {
    open(vi.fn(async () => false));

    await userEvent.click(screen.getByRole("button", { name: "Send notice" }));
    await act(async () => {});
    expect(screen.queryByText(/posted to every home/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send notice" })).toBeEnabled();
  });

  it("says posted straight away in the demo, where it is", async () => {
    open(vi.fn(() => true));

    await userEvent.click(screen.getByRole("button", { name: "Send notice" }));
    expect(await screen.findByText("Notice of Annual meeting posted to every home")).toBeInTheDocument();
  });
});

describe("deleting an association", () => {
  const open = (association: Fake) => {
    state.current = {
      isRemote: true,
      account: { id: "pat", role: "president" },
      community: {
        id: "assoc-1",
        accounts: [],
        settings: { displayName: "Maple Ridge" },
        association,
      },
      resetDemo: vi.fn(),
    };
    render(<DangerZone />, { wrapper: inToasts });
  };

  it("says to cancel billing first when a subscription is on file", () => {
    // The database refuses the delete until then, and only a toast said why.
    open({ subscriptionStatus: "active", billing: { subscriptionId: "sub_123" } });
    expect(
      screen.getByText(/Cancel the subscription first: it cannot be deleted while billing is on file\./),
    ).toBeInTheDocument();
  });

  it("says nothing of it during the free period, with nothing to cancel", () => {
    open({ subscriptionStatus: "trialing" });
    expect(screen.getByText("Removes it for everybody. Recoverable for thirty days, then gone.")).toBeInTheDocument();
    expect(screen.queryByText(/Cancel the subscription first/)).not.toBeInTheDocument();
  });
});
