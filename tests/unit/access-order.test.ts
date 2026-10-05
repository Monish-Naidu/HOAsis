import { describe, expect, it } from "vitest";
import { NEXT_ACCESS } from "@/lib/access";

describe("the permissions grid order", () => {
  it("steps a can-change cell down to can-see first, and loops back to change", () => {
    expect(NEXT_ACCESS.change).toBe("view");
    expect(NEXT_ACCESS.view).toBe("none");
    expect(NEXT_ACCESS.none).toBe("change");
  });
});
