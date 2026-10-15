import { describe, expect, it } from "vitest";
import { mehrMeadows } from "@/lib/data/communities";
import { lateFeePosted, renderLetter } from "@/lib/letters";
import { LETTER_NAME } from "@/lib/collections";
import { homeLabel } from "@/lib/wording";
import type { ChargeLine } from "@/lib/types";

const home = { ...mehrMeadows.homes[0], unit: "12", displayName: "Gwen Hart", daysPastDue: 35 };
const withFee = (lines: ChargeLine[]) => ({
  ...mehrMeadows,
  homeCharges: { ...mehrMeadows.homeCharges, [home.id]: lines },
});
const template = {
  subject: "{{association}}: late dues on unit {{unit}}",
  body: "Unit {{unit}} carries a balance of {{balance}}. A late fee has been applied under the association's collection policy.\n\nPlease pay.",
};
const feeLine: ChargeLine = {
  id: "c1",
  date: "2026-08-01",
  label: "Late fee",
  kind: "charge",
  amountCents: 2500,
  balanceAfterCents: 2500,
  category: "late_fee",
};

describe("a dues letter", () => {
  it("names the home the way the product does, not as unit", () => {
    const letter = renderLetter(template, home, withFee([]));
    const label = homeLabel(mehrMeadows, "12");
    expect(letter.subject).toContain(`on ${label}`);
    expect(letter.body.startsWith(`${label} carries`)).toBe(true);
    // The word is not said twice: "unit Unit 12" is what the template alone gave.
    expect(letter.subject.toLowerCase()).not.toContain("unit unit");
  });

  it("says a late fee was applied only when one is on the statement", () => {
    expect(lateFeePosted(withFee([]), home)).toBe(false);
    expect(renderLetter(template, home, withFee([])).body).not.toContain("late fee");
    expect(renderLetter(template, home, withFee([])).body).toContain("Please pay.");
    expect(lateFeePosted(withFee([feeLine]), home)).toBe(true);
    expect(renderLetter(template, home, withFee([feeLine])).body).toContain(
      "A late fee has been applied",
    );
  });
});

describe("the name of a rung", () => {
  it("is one name for the list and the letter", () => {
    expect(LETTER_NAME.demand).toBe("Final notice");
    expect(LETTER_NAME.counsel).toBe(LETTER_NAME.demand);
  });
});
