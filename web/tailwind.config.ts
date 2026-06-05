// #24 Tailwind v3 config — enterprise/bank-grade theming derived from the design tokens
// (web/src/theme.ts). Navy/neutral palette, Inter/system type, and a `font-tabular` utility for
// aligned money columns. NO crypto-gradient styling.
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2f8",
          600: "#2a4d7a",
          700: "#1c3a5e",
          800: "#13294b",
          900: "#0b1f3a",
        },
        positive: "#15803d",
        warn: "#b45309",
        halt: "#b91c1c",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontFeatureSettings: {
        tabular: '"tnum" 1, "lnum" 1',
      },
    },
  },
  plugins: [
    // #24 `font-tabular` — tabular + lining figures so money columns align digit-for-digit.
    ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) => {
      addUtilities({
        ".font-tabular": { "font-variant-numeric": "tabular-nums lining-nums" },
      });
    },
  ],
} satisfies Config;
