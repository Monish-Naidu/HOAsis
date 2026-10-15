import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { palette, theme } from "@/lib/tokens";

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const dark = theme.dark;
const surfaces = {
  bg: dark.bg,
  surface: dark.surface,
  surface2: dark.surface2,
  surface3: palette.navy[800],
};

describe("contrast helper", () => {
  it("knows the extremes", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("dark theme text reaches 4.5:1 against its own ground", () => {
  const pairs: [string, string, string][] = [];
  for (const [name, ground] of Object.entries(surfaces)) {
    pairs.push([`fg on ${name}`, dark.fg, ground]);
    pairs.push([`fgMuted on ${name}`, dark.fgMuted, ground]);
    pairs.push([`fgSubtle on ${name}`, dark.fgSubtle, ground]);
    pairs.push([`accent on ${name}`, dark.accent, ground]);
    // The link blue, the lit tab label.
    pairs.push([`primaryText on ${name}`, dark.primaryText, ground]);
  }
  pairs.push(["primaryText on primarySoft", dark.primaryText, dark.primarySoft]);
  pairs.push(["fgSubtle on primarySoft", dark.fgSubtle, dark.primarySoft]);
  // The initials on the avatar, and the label of a primary button, at every
  // stop of the gradient and on hover.
  pairs.push(["primaryFg on primary", dark.primaryFg, dark.primary]);
  pairs.push(["primaryFg on primaryHover", dark.primaryFg, dark.primaryHover]);
  for (const stop of dark.brandGradient) {
    pairs.push([`primaryFg on gradient ${stop}`, dark.primaryFg, stop]);
  }
  // The counts on the tab bar and the bell sit on a solid status fill.
  pairs.push(["statusFg on danger", dark.statusFg, dark.danger]);
  pairs.push(["statusFg on warn", dark.statusFg, dark.warn]);
  pairs.push(["statusFg on fgMuted", dark.statusFg, dark.fgMuted]);
  for (const t of ["ok", "warn", "danger"] as const) {
    pairs.push([
      `${t} on ${t}-soft`,
      dark[t],
      { ok: "#122d24", warn: "#33270f", danger: "#351b19" }[t],
    ]);
    pairs.push([`${t} on surface`, dark[t], dark.surface]);
  }
  for (const [name, tint] of Object.entries(dark.tint)) {
    pairs.push([`tint ${name} fg on soft`, tint.fg, tint.soft]);
    // The glyph of a soft tile is the hue itself.
    pairs.push([`tint ${name} base on soft`, tint.base, tint.soft]);
  }

  it.each(pairs)("%s", (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("light theme keeps its look", () => {
  it("keeps the fills and the blue text as they were", () => {
    expect(theme.light.primary).toBe("#2b6be3");
    expect(theme.light.primaryText).toBe(theme.light.primary);
    expect(theme.light.brandGradient).toEqual(["#3f82f2", "#2b6be3", "#1f56c9"]);
    expect(theme.light.statusFg).toBe("#ffffff");
  });

  it("still reads white on its status fills", () => {
    for (const fill of [theme.light.danger, theme.light.warn, theme.light.fgMuted]) {
      expect(contrast(theme.light.statusFg, fill)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("globals.css mirrors tokens.ts", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const block = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    return css.slice(start, css.indexOf("\n}", start));
  };
  const read = (scope: string, name: string) =>
    new RegExp(`--${name}:\\s*([^;]+);`).exec(block(scope))?.[1].trim();

  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ] as const)("%s", (scope, key) => {
    const t = theme[key];
    expect(read(scope, "primary")).toBe(t.primary);
    expect(read(scope, "primary-hover")).toBe(t.primaryHover);
    expect(read(scope, "status-fg")).toBe(t.statusFg);
    expect(read(scope, "tint-blue-soft")).toBe(t.tint.blue.soft);
    const text = read(scope, "primary-text");
    expect(text === "var(--primary)" ? t.primary : text).toBe(t.primaryText);
    expect(read(scope, "brand-gradient")).toContain(t.brandGradient[1]);
  });
});
