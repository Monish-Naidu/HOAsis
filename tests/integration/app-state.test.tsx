import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  AppStateProvider,
  bucketRequests,
  useAppState,
  useCurrentOwner,
  useMyRequests,
} from "@/lib/app-state";
import type { HomeRequest } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

/** Renders the two hooks a screen would use, against one shared provider. */
function renderApp() {
  return renderHook(
    () => ({ state: useAppState(), owner: useCurrentOwner(), myRequests: useMyRequests() }),
    { wrapper },
  );
}

const ARYA = "acct-arya";
const MONISH = "acct-monish";
const ELLIS = "acct-ellis";

describe("session", () => {
  it("starts signed out", () => {
    const { result } = renderApp();
    expect(result.current.state.account).toBeNull();
    expect(result.current.owner).toBeNull();
  });

  it("lands an admin in the admin view and a resident in the resident view", () => {
    const { result } = renderApp();

    act(() => result.current.state.signIn(ARYA));
    expect(result.current.state.account?.role).toBe("president");
    expect(result.current.state.view).toBe("admin");

    act(() => result.current.state.signIn(MONISH));
    expect(result.current.state.view).toBe("resident");
  });

  it("switches view without dropping the session, which is the whole point", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.setView("resident"));

    expect(result.current.state.view).toBe("resident");
    expect(result.current.state.account?.id).toBe(ARYA);
  });

  it("resolves the signed in account to its own household", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    expect(result.current.owner?.unit).toBe("7");

    act(() => result.current.state.signIn(MONISH));
    expect(result.current.owner?.unit).toBe("42");
  });

  it("survives a remount, so a reload keeps you signed in", () => {
    const first = renderApp();
    act(() => first.result.current.state.signIn(ARYA));
    first.unmount();

    const second = renderApp();
    expect(second.result.current.state.account?.id).toBe(ARYA);
  });

  it("sign out clears the stored session", () => {
    const { result, unmount } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.signOut());
    unmount();

    expect(renderApp().result.current.state.account).toBeNull();
  });
});

describe("capabilities", () => {
  it("gives the President everything, including the ungrantable one", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    expect(result.current.state.can("finances")).toBe(true);
    expect(result.current.state.can("permissions")).toBe(true);
  });

  it("withholds from an admin what the President has not granted", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ELLIS));
    expect(result.current.state.can("voting")).toBe(true);
    expect(result.current.state.can("finances")).toBe(false);
    expect(result.current.state.can("permissions")).toBe(false);
  });

  it("gives a plain resident no admin capability at all", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    expect(result.current.state.can("requests")).toBe(false);
  });

  it("lets the President grant and revoke", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.setCapability(ELLIS, "finances", true));

    act(() => result.current.state.signIn(ELLIS));
    expect(result.current.state.can("finances")).toBe(true);

    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.setCapability(ELLIS, "finances", false));
    act(() => result.current.state.signIn(ELLIS));
    expect(result.current.state.can("finances")).toBe(false);
  });

  it("refuses to strip the President, who would otherwise lock everyone out", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.setCapability(ARYA, "settings", false));
    expect(result.current.state.can("settings")).toBe(true);
  });
});

describe("admin settings reach the resident side", () => {
  it("renaming the community is visible to everyone", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.updateSettings({ displayName: "Cedar Court" }));

    act(() => result.current.state.signIn(MONISH));
    expect(result.current.state.settings.displayName).toBe("Cedar Court");
  });

  it("hiding funds is honoured for residents", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    expect(result.current.state.settings.showFundsToResidents).toBe(true);

    act(() => result.current.state.updateSettings({ showFundsToResidents: false }));
    act(() => result.current.state.signIn(MONISH));
    expect(result.current.state.settings.showFundsToResidents).toBe(false);
  });

  it("an amenity the admin adds becomes reservable for residents", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() =>
      result.current.state.setAmenities([
        ...result.current.state.amenities,
        {
          id: "am-new",
          name: "Pickleball court",
          reservable: true,
          detail: "Added by the board",
          status: "open",
        },
      ]),
    );

    act(() => result.current.state.signIn(MONISH));
    const reservable = result.current.state.amenities.filter((a) => a.reservable);
    expect(reservable.map((a) => a.name)).toContain("Pickleball court");
  });

  it("an architectural form the admin uploads appears in the resident dropdown", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() =>
      result.current.state.setForms([
        ...result.current.state.forms,
        {
          id: "form-new",
          label: "Mailbox replacement",
          description: "Uploaded by the board",
          fileName: "mailbox.pdf",
          size: "12 KB",
          source: "uploaded",
          updatedDate: "2026-08-21",
        },
      ]),
    );

    act(() => result.current.state.signIn(MONISH));
    expect(result.current.state.forms.map((f) => f.label)).toContain("Mailbox replacement");
  });

  it("settings survive a remount", () => {
    const first = renderApp();
    act(() => first.result.current.state.signIn(ARYA));
    act(() => first.result.current.state.updateSettings({ homeLayout: "banner" }));
    first.unmount();

    expect(renderApp().result.current.state.settings.homeLayout).toBe("banner");
  });

  it("reset puts the seeded data back without signing you out", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.updateSettings({ displayName: "Temporary" }));
    act(() => result.current.state.resetDemo());

    expect(result.current.state.settings.displayName).toBe("Mehr Gardens");
    expect(result.current.state.account?.id).toBe(ARYA);
  });
});

describe("requests", () => {
  function draft(ownerId: string, overrides: Partial<HomeRequest> = {}): HomeRequest {
    return {
      id: `req-test-${overrides.reference ?? ownerId}`,
      reference: "REQ-TEST-1",
      kind: "maintenance",
      title: "Gate latch is broken",
      summary: "It does not catch.",
      ownerId,
      ownerName: "Test Owner",
      unit: "7",
      status: "submitted",
      submittedDate: "2026-08-21",
      attachments: [],
      thread: [],
      ...overrides,
    };
  }

  it("shows a submitted request to the person who filed it", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.addRequest(draft("own-007")));
    expect(result.current.myRequests.map((r) => r.reference)).toContain("REQ-TEST-1");
  });

  it("does not show it to a different household", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.addRequest(draft("own-007")));

    act(() => result.current.state.signIn(MONISH));
    expect(result.current.myRequests.map((r) => r.reference)).not.toContain("REQ-TEST-1");
  });

  it("reaches the board queue as well as the resident list", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const before = bucketRequests(result.current.state.requests).open.length;
    act(() => result.current.state.addRequest(draft("own-007")));
    expect(bucketRequests(result.current.state.requests).open.length).toBe(before + 1);
  });

  it("persists across a reload", () => {
    const first = renderApp();
    act(() => first.result.current.state.signIn(ARYA));
    act(() => first.result.current.state.addRequest(draft("own-007")));
    first.unmount();

    const second = renderApp();
    act(() => second.result.current.state.signIn(ARYA));
    expect(second.result.current.myRequests.map((r) => r.reference)).toContain("REQ-TEST-1");
  });

  it("leaves the queue when decided but never leaves the record", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() =>
      result.current.state.addRequest(
        draft("own-007", { reference: "REQ-TEST-2", status: "approved" }),
      ),
    );

    const buckets = bucketRequests(result.current.myRequests);
    expect(buckets.open.map((r) => r.reference)).not.toContain("REQ-TEST-2");
    expect(buckets.decided.map((r) => r.reference)).toContain("REQ-TEST-2");
    expect(result.current.myRequests.map((r) => r.reference)).toContain("REQ-TEST-2");
  });

  it("sorts every request into exactly one bucket", () => {
    const { result } = renderApp();
    const all = result.current.state.requests;
    const { open, decided, history } = bucketRequests(all);
    expect(open.length + decided.length + history.length).toBe(all.length);
  });
});

describe("forum", () => {
  it("adds a post and records a like", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    const before = result.current.state.posts.length;

    act(() =>
      result.current.state.addPost({
        id: "fp-test",
        author: "Monish Naidu",
        unit: "42",
        category: "General",
        title: "Test post",
        body: "Body",
        at: "2026-08-21",
        likes: 0,
        replies: [],
      }),
    );
    expect(result.current.state.posts).toHaveLength(before + 1);
    expect(result.current.state.posts[0].title).toBe("Test post");

    act(() => result.current.state.likePost("fp-test"));
    expect(result.current.state.posts[0].likes).toBe(1);
  });
});
