import { describe, expect, it } from "vitest";
import {
  groupRequests,
  isOpenRequest,
  openRequestCount,
  repliedOn,
  requestGroup,
  requestStatusLabel,
  statusAfterReply,
} from "@/lib/request-status";
import { vendorNameProblem, vendorService, VENDOR_NAME_MAX } from "@/lib/vendor-name";
import type { RequestStatus } from "@/lib/types";

const req = (kind: string, status: RequestStatus, extra: object = {}) => ({
  kind,
  status,
  thread: [] as { at: string; actorRole: string; kind: string }[],
  submittedDate: "2026-08-10",
  ...extra,
});

describe("a request that needs a decision", () => {
  it("goes Sent, Under review, then Approved or Denied", () => {
    expect(requestStatusLabel(req("architectural", "submitted"))).toBe("Sent");
    expect(requestStatusLabel(req("architectural", "in-review"))).toBe("Under review");
    expect(requestStatusLabel(req("architectural", "approved"))).toBe("Approved");
    expect(requestStatusLabel(req("architectural", "denied"))).toBe("Denied");
    expect(requestStatusLabel(req("architectural", "closed"))).toBe("Closed");
  });

  it("waits on a decision until it is decided", () => {
    expect(requestGroup(req("architectural", "submitted"))).toBe("decision");
    expect(requestGroup(req("architectural", "in-review"))).toBe("decision");
    expect(requestGroup(req("architectural", "approved"))).toBe("done");
    expect(requestGroup(req("architectural", "denied"))).toBe("done");
  });

  it("moves from Sent to Under review when the board replies", () => {
    expect(statusAfterReply(req("architectural", "submitted"))).toBe("in-review");
    expect(statusAfterReply(req("architectural", "approved"))).toBe("approved");
  });
});

describe("a maintenance request", () => {
  it("needs scheduling, is Scheduled, then is done", () => {
    expect(requestGroup(req("maintenance", "submitted"))).toBe("scheduling");
    expect(requestGroup(req("maintenance", "in-review"))).toBe("progress");
    expect(requestStatusLabel(req("maintenance", "in-review"))).toBe("Scheduled");
    expect(requestGroup(req("maintenance", "closed"))).toBe("done");
  });

  it("counts an open work order as in progress", () => {
    expect(requestGroup(req("maintenance", "submitted", { workOrder: { openedOn: "2026-08-12" } }))).toBe("progress");
    expect(
      requestGroup(req("maintenance", "submitted", { workOrder: { openedOn: "2026-08-12", completedOn: "2026-08-15" } })),
    ).toBe("scheduling");
  });

  it("stays Sent after a reply, and is shown as replied", () => {
    expect(statusAfterReply(req("maintenance", "submitted"))).toBe("submitted");
    const thread = [{ at: "2026-08-11", actorRole: "board", kind: "note" }];
    expect(repliedOn({ status: "submitted", thread })).toBe("2026-08-11");
    expect(repliedOn({ status: "in-review", thread })).toBeUndefined();
    expect(repliedOn({ status: "submitted", thread: [{ at: "2026-08-10", actorRole: "resident", kind: "note" }] })).toBeUndefined();
  });
});

describe("what is open", () => {
  it("counts requests the board still owes something on, and nothing else", () => {
    const rows = [
      req("architectural", "submitted"),
      req("maintenance", "in-review"),
      req("architectural", "approved"),
      req("maintenance", "closed"),
    ];
    expect(openRequestCount(rows)).toBe(2);
    expect(isOpenRequest(rows[2])).toBe(false);
  });

  it("keeps a recently closed request in Done and sends an old one to history", () => {
    // TODAY is pinned to 2026-08-20.
    const recent = req("maintenance", "closed", { thread: [{ at: "2026-08-15" }] });
    const old = req("maintenance", "closed", { thread: [{ at: "2026-05-01" }] });
    const g = groupRequests([recent, old, req("architectural", "approved")]);
    expect(g.done).toHaveLength(2);
    expect(g.older).toEqual([old]);
    expect(g.allClosed).toHaveLength(2);
  });
});

describe("a vendor's name", () => {
  const existing = [{ name: "Cascade Grounds Co." }];

  it("refuses a duplicate, ignoring case and spaces", () => {
    expect(vendorNameProblem("cascade  grounds co.", existing)).toBe(
      "A vendor called Cascade Grounds Co. already exists",
    );
    expect(vendorNameProblem("CascadeGroundsCo.", existing)).not.toBeNull();
    expect(vendorNameProblem("Rainier Roofing", existing)).toBeNull();
  });

  it("caps the name at 80 characters", () => {
    expect(vendorNameProblem("a".repeat(VENDOR_NAME_MAX), [])).toBeNull();
    expect(vendorNameProblem("a".repeat(VENDOR_NAME_MAX + 1), [])).toMatch(/80 characters/);
  });

  it("labels a vendor with no service by its category", () => {
    expect(vendorService({ service: "Services", defaultCategory: "Landscaping" })).toBe("Landscaping");
    expect(vendorService({ service: "Grounds and irrigation", defaultCategory: "Landscaping" })).toBe(
      "Grounds and irrigation",
    );
  });
});
