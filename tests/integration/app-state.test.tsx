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

    expect(result.current.state.settings.displayName).toBe("Mehr Meadows");
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
        status: "published",
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

describe("forum moderation", () => {
  const post = (id: string, author: string) => ({
    id,
    author,
    unit: "50",
    category: "General" as const,
    status: "pending" as const,
    title: `Post ${id}`,
    body: "Body",
    at: "2026-08-21",
    likes: 0,
    replies: [],
  });

  it("holds a resident's post until a moderator sees it", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    act(() => result.current.state.addPost(post("fp-a", "Monish Naidu")));

    // The author still sees their own, so it does not look lost.
    expect(result.current.state.posts.find((p) => p.id === "fp-a")?.status).toBe("pending");
  });

  it("hides a pending post from other residents", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    act(() => result.current.state.addPost(post("fp-b", "Someone Else")));

    const otherCanSee = result.current.state.posts.some(
      (p) => p.id === "fp-b" && p.status === "published",
    );
    expect(otherCanSee).toBe(false);
  });

  it("publishes on approval and records who decided", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    act(() => result.current.state.addPost(post("fp-c", "Monish Naidu")));

    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.moderatePost("fp-c", "published"));

    const moderated = result.current.state.posts.find((p) => p.id === "fp-c");
    expect(moderated?.status).toBe("published");
    expect(moderated?.moderatedBy).toBe("Arya Mehr");
  });

  it("keeps a rejected post and its reason rather than deleting it", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.addPost(post("fp-d", "Someone")));
    act(() => result.current.state.moderatePost("fp-d", "rejected", "Off topic"));

    const rejected = result.current.state.posts.find((p) => p.id === "fp-d");
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.rejectionReason).toBe("Off topic");
  });

  it("pins and removes", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.togglePinned("fp-1"));
    expect(result.current.state.posts.find((p) => p.id === "fp-1")?.pinned).toBe(false);

    act(() => result.current.state.removePost("fp-1"));
    expect(result.current.state.posts.some((p) => p.id === "fp-1")).toBe(false);
  });
});

describe("admin actions change real records", () => {
  it("confirming a transaction clears it and empties the review queue", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const target = result.current.state.ledger.find((e) => e.status === "needs-review")!;

    act(() => result.current.state.confirmLedgerEntry(target.id));
    const after = result.current.state.ledger.find((e) => e.id === target.id)!;
    expect(after.status).toBe("cleared");
    expect(after.matchedBy).toBe("manual");
    expect(after.suggestedCategory).toBeUndefined();
  });

  it("removing a duplicate takes it out of the ledger entirely", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const duplicate = result.current.state.ledger.find((e) => e.duplicateOfId)!;

    act(() => result.current.state.dismissLedgerEntry(duplicate.id));
    expect(result.current.state.ledger.some((e) => e.id === duplicate.id)).toBe(false);
  });

  it("a second signature releases a payout, and nobody can sign twice", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const waiting = result.current.state.payouts.find(
      (p) => p.approvals.length === p.approvalsRequired - 1,
    )!;

    act(() => result.current.state.approvePayout(waiting.id));
    const released = result.current.state.payouts.find((p) => p.id === waiting.id)!;
    expect(released.approvals).toHaveLength(waiting.approvalsRequired);
    expect(released.status).toBe("scheduled");

    act(() => result.current.state.approvePayout(waiting.id));
    expect(
      result.current.state.payouts.find((p) => p.id === waiting.id)!.approvals,
    ).toHaveLength(waiting.approvalsRequired);
  });

  it("deciding a request records who decided and appends to the thread", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const open = result.current.state.requests.find((r) => r.status === "in-review")!;
    const before = open.thread.length;

    act(() => result.current.state.updateRequestStatus(open.id, "approved"));
    const decided = result.current.state.requests.find((r) => r.id === open.id)!;
    expect(decided.status).toBe("approved");
    expect(decided.decidedBy).toBe("Arya Mehr");
    expect(decided.thread).toHaveLength(before + 1);
  });

  it("a board vote moves exactly one tally, and changing it does not double count", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const ballot = result.current.state.ballots.find((b) => b.audience === "board")!;
    const totalBefore = ballot.options.reduce((sum, o) => sum + o.votes, 0);

    act(() => result.current.state.castVote(ballot.id, "opt-approve"));
    let updated = result.current.state.ballots.find((b) => b.id === ballot.id)!;
    expect(updated.options.reduce((s, o) => s + o.votes, 0)).toBe(totalBefore + 1);

    act(() => result.current.state.castVote(ballot.id, "opt-reject"));
    updated = result.current.state.ballots.find((b) => b.id === ballot.id)!;
    expect(updated.options.reduce((s, o) => s + o.votes, 0)).toBe(totalBefore + 1);
    expect(updated.myVoteOptionId).toBe("opt-reject");
  });

  it("replying to a thread marks it read and appends the message", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const unread = result.current.state.threads.find((t) => t.unread)!;

    act(() => result.current.state.replyToThread(unread.id, "On it, thanks."));
    const replied = result.current.state.threads.find((t) => t.id === unread.id)!;
    expect(replied.unread).toBe(false);
    expect(replied.messages.at(-1)?.body).toBe("On it, thanks.");
    expect(replied.messages.at(-1)?.from).toBe("Arya Mehr");
  });

  it("requesting a W-9 clears the vendor gap", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const missing = result.current.state.vendors.find((v) => !v.w9OnFile)!;

    act(() => result.current.state.markW9Requested(missing.id));
    expect(result.current.state.vendors.find((v) => v.id === missing.id)!.w9OnFile).toBe(true);
  });

  it("changing document visibility is what residents actually see", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    const doc = result.current.state.documents.find((d) => d.visibility === "public")!;

    act(() => result.current.state.setDocumentVisibility(doc.id, "board"));
    expect(result.current.state.documents.find((d) => d.id === doc.id)!.visibility).toBe("board");
  });
});

describe("payment instruments", () => {
  it("the first instrument an owner adds becomes their default", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn("acct-nina"));
    act(() =>
      result.current.state.addInstrument({
        ownerId: "own-015",
        kind: "ach",
        label: "BECU checking",
        mask: "1111",
        addedDate: "2026-08-21",
        token: "tok_test",
      }),
    );
    expect(result.current.state.instruments.find((i) => i.mask === "1111")?.isDefault).toBe(true);
  });

  it("keeps exactly one default per household", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    const second = result.current.state.instruments.find(
      (i) => i.ownerId === "own-042" && !i.isDefault,
    )!;

    act(() => result.current.state.setDefaultInstrument(second.id));
    const mine = result.current.state.instruments.filter((i) => i.ownerId === "own-042");
    expect(mine.filter((i) => i.isDefault)).toHaveLength(1);
    expect(mine.find((i) => i.isDefault)!.id).toBe(second.id);
  });

  it("removing the default promotes whatever is left", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    const current = result.current.state.instruments.find(
      (i) => i.ownerId === "own-042" && i.isDefault,
    )!;

    act(() => result.current.state.removeInstrument(current.id));
    const mine = result.current.state.instruments.filter((i) => i.ownerId === "own-042");
    expect(mine.filter((i) => i.isDefault)).toHaveLength(1);
  });

  it("does not touch another household's default", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(ARYA));
    act(() => result.current.state.setDefaultInstrument("pm-ach-arya"));
    const monish = result.current.state.instruments.filter((i) => i.ownerId === "own-042");
    expect(monish.filter((i) => i.isDefault)).toHaveLength(1);
  });
});

describe("every admin can use the resident side", () => {
  const ADMINS = [
    { id: "acct-arya", role: "president", unit: "7" },
    { id: "acct-dana", role: "treasurer", unit: "19" },
    { id: "acct-sofia", role: "secretary", unit: "31" },
    { id: "acct-ellis", role: "vice-president", unit: "71" },
  ] as const;

  it.each(ADMINS)("$role can switch to resident without signing out", (admin) => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(admin.id));
    expect(result.current.state.view).toBe("admin");

    act(() => result.current.state.setView("resident"));
    expect(result.current.state.view).toBe("resident");
    expect(result.current.state.account?.id).toBe(admin.id);
  });

  it.each(ADMINS)("$role sees their own unit on the resident side", (admin) => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(admin.id));
    act(() => result.current.state.setView("resident"));
    expect(result.current.owner?.unit).toBe(admin.unit);
  });

  it.each(ADMINS)("$role keeps their capabilities while in resident view", (admin) => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(admin.id));
    const before = result.current.state.can("requests");
    act(() => result.current.state.setView("resident"));
    expect(result.current.state.can("requests")).toBe(before);
  });

  it("switching back to admin returns to the same account", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn("acct-dana"));
    act(() => result.current.state.setView("resident"));
    act(() => result.current.state.setView("admin"));
    expect(result.current.state.account?.role).toBe("treasurer");
    expect(result.current.state.can("finances")).toBe(true);
  });

  it("a plain resident has no admin view to switch to", () => {
    const { result } = renderApp();
    act(() => result.current.state.signIn(MONISH));
    expect(result.current.state.account?.role).toBe("resident");
    expect(result.current.state.view).toBe("resident");
  });
});

describe("resident voting", () => {
  it("persists a vote, its receipt, and the tally", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const ballot = result.current.ballots.find((b) => b.status === "open")!;
    const option = ballot.options[0];
    const before = option.votes;

    let receipt = "";
    act(() => {
      receipt = result.current.castVote(ballot.id, option.id);
    });

    const after = result.current.ballots.find((b) => b.id === ballot.id)!;
    expect(after.myVoteOptionId).toBe(option.id);
    expect(after.myVoteReceipt).toBe(receipt);
    expect(receipt).toMatch(/^VR-\d{4}-\d{2}-\d{4}$/);
    expect(after.options.find((o) => o.id === option.id)!.votes).toBe(before + 1);
  });

  it("moves the vote rather than adding a second, and keeps the receipt", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const ballot = result.current.ballots.find((b) => b.status === "open" && b.options.length > 1)!;
    const [first, second] = ballot.options;
    const total = ballot.options.reduce((t, o) => t + o.votes, 0);

    let receipt = "";
    act(() => {
      receipt = result.current.castVote(ballot.id, first.id);
    });
    act(() => {
      result.current.castVote(ballot.id, second.id);
    });

    const after = result.current.ballots.find((b) => b.id === ballot.id)!;
    expect(after.myVoteOptionId).toBe(second.id);
    expect(after.myVoteReceipt).toBe(receipt);
    expect(after.options.reduce((t, o) => t + o.votes, 0)).toBe(total + 1);
  });
});

describe("the community handed to screens", () => {
  it("carries live slices, not the seed fixtures", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const ballot = result.current.ballots.find((b) => b.status === "open")!;

    act(() => {
      result.current.castVote(ballot.id, ballot.options[0].id);
    });

    // Screens and the pure selectors in metrics.ts both read off `community`,
    // so it has to reflect the change the store just took.
    expect(
      result.current.community.ballots.find((b) => b.id === ballot.id)!.myVoteOptionId,
    ).toBe(ballot.options[0].id);
  });

  it("reflects an added vendor", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const before = result.current.community.vendors.length;

    act(() => {
      result.current.addVendor({
        id: "ven-probe",
        name: "Probe Services",
        service: "Testing",
        achEnabled: true,
        w9OnFile: true,
        ytdPaidCents: 0,
        defaultCategory: "Repairs & maintenance",
      });
    });

    expect(result.current.community.vendors.length).toBe(before + 1);
  });
});

describe("undo on board decisions", () => {
  it("puts a confirmed transaction back", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const entry = result.current.ledger.find((e) => e.status === "needs-review")!;

    let undo = () => {};
    act(() => {
      undo = result.current.confirmLedgerEntry(entry.id);
    });
    expect(result.current.ledger.find((e) => e.id === entry.id)!.status).toBe("cleared");

    act(() => undo());
    expect(result.current.ledger.find((e) => e.id === entry.id)!.status).toBe("needs-review");
  });

  it("puts a published post back to pending", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const pending = result.current.posts.find((p) => p.status === "pending")!;

    let undo = () => {};
    act(() => {
      undo = result.current.moderatePost(pending.id, "published");
    });
    expect(result.current.posts.find((p) => p.id === pending.id)!.status).toBe("published");

    act(() => undo());
    expect(result.current.posts.find((p) => p.id === pending.id)!.status).toBe("pending");
  });
});
