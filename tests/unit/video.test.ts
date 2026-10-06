import { describe, expect, it } from "vitest";
import { meetingJoin, roomHash, roomSlug, videoJoinUrl, videoRoomName } from "@/lib/meetings/video";

describe("roomSlug", () => {
  it("keeps only lowercase letters, digits and single dashes", () => {
    expect(roomSlug("Mehr Meadows HOA")).toBe("mehr-meadows-hoa");
    expect(roomSlug("--Hello__World!!")).toBe("hello-world");
    expect(roomSlug("2a3f-9c1e")).toBe("2a3f-9c1e");
  });
});

describe("roomHash", () => {
  it("is deterministic, six characters, base36", () => {
    expect(roomHash("abc")).toBe(roomHash("abc"));
    expect(roomHash("abc")).toMatch(/^[a-z0-9]{6}$/);
    expect(roomHash("abc")).not.toBe(roomHash("abd"));
  });
});

describe("videoRoomName", () => {
  it("derives a stable name from the association and meeting ids", () => {
    const a = videoRoomName({ id: "mtg-special-aug20" }, "assoc-mehr-meadows");
    const b = videoRoomName({ id: "mtg-special-aug20" }, "assoc-mehr-meadows");
    expect(a).toBe(b);
    expect(a).toMatch(/^hoasis-assoc-mehr-meadows-mtg-special-aug20-[a-z0-9]{6}$/);
  });

  it("is safe for a URL path", () => {
    const name = videoRoomName({ id: "Mtg 12/Q4 (2026)" }, "Sunset Ridge HOA");
    expect(name).toMatch(/^[a-z0-9-]+$/);
    expect(name).not.toMatch(/--|^-|-$/);
  });

  it("differs across associations sharing a meeting id", () => {
    expect(videoRoomName({ id: "mtg-1" }, "assoc-a")).not.toBe(videoRoomName({ id: "mtg-1" }, "assoc-b"));
  });

  it("is not the visible ids alone: same ids, different hash than a plain join", () => {
    const name = videoRoomName({ id: "mtg-1" }, "assoc-a");
    expect(name.slice(-6)).not.toBe(roomHash("assoc-a/mtg-1"));
  });

  it("caps long uuids so the room stays typeable", () => {
    const name = videoRoomName(
      { id: "0d5f0e9a-3b2c-4d7e-9f1a-2b3c4d5e6f70" },
      "b8c1e2d3-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
    );
    expect(name.length).toBeLessThanOrEqual(7 + 24 + 1 + 24 + 7);
  });

  it("uses a pinned room when the meeting has one", () => {
    expect(videoRoomName({ id: "mtg-1", videoRoom: "Board Room 2026" }, "assoc-a")).toBe("board-room-2026");
    expect(videoRoomName({ id: "mtg-1", videoRoom: "  " }, "assoc-a")).toMatch(/^hoasis-/);
  });
});

describe("videoJoinUrl", () => {
  it("points at the public Jitsi server", () => {
    expect(videoJoinUrl({ id: "mtg-1" }, "assoc-a")).toBe(
      `https://meet.jit.si/${videoRoomName({ id: "mtg-1" }, "assoc-a")}`,
    );
  });
});

describe("meetingJoin", () => {
  const meeting = { id: "mtg-1" };

  it("uses the automatic room when the board typed nothing", () => {
    expect(meetingJoin(meeting, "assoc-a")).toEqual({
      videoUrl: videoJoinUrl(meeting, "assoc-a"),
      dialIn: "",
      passcode: "",
    });
  });

  it("treats a typed link as the video link, and keeps the passcode with it", () => {
    expect(meetingJoin({ ...meeting, dialIn: " https://zoom.us/j/123 ", passcode: "4321" }, "assoc-a")).toEqual({
      videoUrl: "https://zoom.us/j/123",
      dialIn: "",
      passcode: "4321",
    });
  });

  it("keeps a phone number as the dial in, beside the automatic room", () => {
    expect(meetingJoin({ ...meeting, dialIn: "(425) 555-0110", passcode: "99" }, "assoc-a")).toEqual({
      videoUrl: videoJoinUrl(meeting, "assoc-a"),
      dialIn: "(425) 555-0110",
      passcode: "99",
    });
  });
});
