// Enterprise design tokens — the one visual system for #24-#26 · #24
// A restrained institutional language: navy/neutral palette, generous whitespace, subtle borders
// over heavy shadows, Inter/system type, tabular-figure money. NO crypto-gradient styling. Every
// primitive (Card/StatPill/DataTable/Badge/Banner) and view draws from these tokens so the four
// views read as one calm, institutional surface.

// #24 color tokens. `navy` is the institutional brand spine; `ink`/`slate` carry text + chrome;
// semantic tones (positive/warn/halt) are reserved for status, never decoration.
export const color = {
  navy: {
    900: "#0b1f3a",
    800: "#13294b",
    700: "#1c3a5e",
    600: "#2a4d7a",
    50: "#eef2f8",
  },
  ink: "#0f172a",
  slate: {
    600: "#475569",
    500: "#64748b",
    400: "#94a3b8",
    300: "#cbd5e1",
    200: "#e2e8f0",
    100: "#f1f5f9",
    50: "#f8fafc",
  },
  positive: "#15803d",
  warn: "#b45309",
  halt: "#b91c1c",
  white: "#ffffff",
} as const;

// #24 spacing scale (rem). Generous whitespace is a design rule, not an accident.
export const space = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
} as const;

// #24 radii — soft but not playful; cards/pills share one family.
export const radius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  pill: "9999px",
} as const;

// #24 type scale (rem). Inter/system stack; money renders with tabular figures (see tailwind).
export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.375rem",
  xxl: "1.875rem",
} as const;

// #24 the semantic tone vocabulary the Badge/StatPill/Banner primitives key off. `block` is an
// on-chain eligibility revert (rows 3-6,8); `halt` is an engine HALT (rows 9-10) — both red-ish
// but distinct in copy/intensity so a reviewer can tell a compliance block from a solvency HALT.
export type Tone = "neutral" | "navy" | "positive" | "warn" | "block" | "halt";
