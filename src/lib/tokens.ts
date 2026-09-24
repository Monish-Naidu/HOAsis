/**
 * Platform-agnostic design tokens.
 *
 * globals.css owns the web copy of these values; this file is the portable one.
 * When the React Native app lands it imports from here, so a palette change is
 * a two-file edit rather than a redesign. The 2026-09-19 pop pass added the
 * primary blue, the five tints, the gradients and the glows; see
 * docs/design/ui-pop-2026-09-19.md.
 */

export const palette = {
  navy: {
    50: "#f2f5f9",
    100: "#e3e9f1",
    200: "#c7d3e3",
    300: "#9aaec9",
    400: "#6684a9",
    500: "#43618b",
    600: "#2f4a70",
    700: "#24395a",
    800: "#1b2b45",
    900: "#131f33",
    950: "#0b1524",
  },
  neutral: {
    50: "#fafaf9",
    100: "#f4f4f2",
    200: "#e7e6e3",
    300: "#d5d3ce",
    400: "#a8a6a0",
    500: "#78766f",
    600: "#57554f",
    700: "#413f3b",
    800: "#2a2926",
    900: "#1a1917",
  },
} as const;

/** One tint: the hue itself, a soft field, and a foreground that reads on it. */
export interface Tint {
  base: string;
  soft: string;
  fg: string;
}

export type TintName = "blue" | "teal" | "amber" | "coral" | "violet";

export const theme = {
  light: {
    bg: "#f5f6f8",
    surface: "#ffffff",
    surface2: "#f9fafb",
    border: "#e5e7eb",
    fg: "#111a2b",
    fgMuted: "#5f6776",
    brand: palette.navy[800],
    brandFg: "#ffffff",
    accent: "#2c6cd1",
    /** The primary action blue, and the same hue lit from the top left. */
    primary: "#2b6be3",
    primaryHover: "#2160d6",
    primaryFg: "#ffffff",
    primarySoft: "#e8f0fd",
    brandGradient: ["#3f82f2", "#2b6be3", "#1f56c9"],
    brandGradientText: ["#2b6be3", "#5f8ff5", "#7b5cf5"],
    tint: {
      blue: { base: "#2f6fe0", soft: "#e7effd", fg: "#1d4fb0" },
      teal: { base: "#12a37a", soft: "#e0f5ec", fg: "#0b7553" },
      amber: { base: "#f0a11a", soft: "#fdf1d8", fg: "#8f5a05" },
      coral: { base: "#f1603f", soft: "#fee9e3", fg: "#b03a1b" },
      violet: { base: "#7b5cf5", soft: "#eee9fe", fg: "#5636cf" },
    } satisfies Record<TintName, Tint>,
    royal: "#2456d6",
    royalFg: "#ffffff",
    heroField: "#eef2f9",
    heroAccent: "#2f68d8",
    ok: "#1f8a5f",
    warn: "#a8710f",
    danger: "#c9463a",
    /** Chart series, categorical, in fixed order. Validated 2026-09-01; re-stepped brighter 2026-09-19. */
    chart: ["#2f7ae0", "#f06a34", "#17b57c", "#f2a600", "#ec7fab"],
    chartOther: "#78766f",
    glowPrimary: "rgb(43 107 227 / 0.55)",
  },
  dark: {
    bg: palette.navy[950],
    surface: "#101c2e",
    surface2: palette.navy[900],
    border: "#1a2840",
    fg: "#e9edf3",
    fgMuted: "#9aa8bd",
    brand: palette.navy[100],
    brandFg: palette.navy[950],
    accent: "#6ea0f0",
    primary: "#3d7ff0",
    primaryHover: "#4d8bf5",
    primaryFg: "#ffffff",
    primarySoft: "#14284a",
    brandGradient: ["#4d8bf5", "#3d7ff0", "#2b63d6"],
    brandGradientText: ["#6ea0f0", "#8fb6ff", "#b7a6ff"],
    tint: {
      blue: { base: "#4d8bf5", soft: "#14284a", fg: "#9cc0ff" },
      teal: { base: "#1fbf8f", soft: "#0f2f27", fg: "#6fe0bd" },
      amber: { base: "#f5b342", soft: "#33270f", fg: "#f9cd78" },
      coral: { base: "#f4735a", soft: "#3a1c16", fg: "#ffa08c" },
      violet: { base: "#8f76ff", soft: "#241b45", fg: "#c2b3ff" },
    } satisfies Record<TintName, Tint>,
    royal: "#2b63d6",
    royalFg: "#ffffff",
    heroField: "#001330",
    heroAccent: "#7dabf8",
    ok: "#4ecb95",
    warn: "#dfa845",
    danger: "#e88a80",
    /** Same hues re-stepped for the dark surface. */
    chart: ["#4a8ff0", "#e8653a", "#22b586", "#e0a020", "#e56597"],
    chartOther: "#8d99ab",
    glowPrimary: "rgb(77 139 245 / 0.6)",
  },
} as const;

/** 4pt base scale. */
export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export const radius = { sm: 6, md: 10, card: 14, lg: 20, pill: 999 } as const;

export const typeScale = {
  display: { size: 32, weight: "600", tracking: -0.6 },
  title: { size: 22, weight: "600", tracking: -0.3 },
  heading: { size: 16, weight: "600", tracking: -0.1 },
  body: { size: 14, weight: "400", tracking: 0 },
  caption: { size: 12, weight: "500", tracking: 0.1 },
  micro: { size: 11, weight: "600", tracking: 0.4 },
} as const;

/**
 * Motion. Milliseconds and cubic-bezier control points, mirrored from
 * globals.css. `press` is a button under a finger, `fast` a hover, `base`
 * a thing arriving, `slow` a section settling on scroll.
 */
export const motion = {
  duration: { press: 120, fast: 180, base: 320, slow: 640 },
  easing: {
    outSoft: [0.16, 1, 0.3, 1],
    spring: [0.34, 1.4, 0.44, 1],
    pop: [0.22, 1.6, 0.36, 1],
  },
} as const;
