/**
 * Platform-agnostic design tokens.
 *
 * globals.css owns the web copy of these values; this file is the portable one.
 * When the React Native app lands it imports from here, so a palette change is
 * a two-file edit rather than a redesign.
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

export const theme = {
  light: {
    bg: palette.neutral[100],
    surface: "#ffffff",
    surface2: palette.neutral[50],
    border: "#e4e3df",
    fg: "#16202e",
    fgMuted: "#6b6f78",
    brand: palette.navy[800],
    brandFg: "#ffffff",
    accent: "#2c6cd1",
    royal: "#1b3e8c",
    royalFg: "#ffffff",
    heroField: "#eef2f9",
    heroAccent: "#2f68d8",
    ok: "#2e7d5b",
    warn: "#a8710f",
    danger: "#b3453b",
    /** Chart series, categorical, in fixed order. Validated 2026-09-01. */
    chart: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"],
    chartOther: "#78766f",
  },
  dark: {
    bg: palette.navy[950],
    surface: "#101c2e",
    surface2: palette.navy[900],
    border: "#1f3050",
    fg: "#e9edf3",
    fgMuted: "#9aa8bd",
    brand: palette.navy[100],
    brandFg: palette.navy[950],
    accent: "#6ea0f0",
    royal: "#1b3e8c",
    royalFg: "#ffffff",
    heroField: "#001330",
    heroAccent: "#7dabf8",
    ok: "#5cbd92",
    warn: "#dfa845",
    danger: "#e2837a",
    /** Same hues re-stepped for the dark surface. */
    chart: ["#3987e5", "#d95926", "#199e70", "#c98500"],
    chartOther: "#8d99ab",
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
