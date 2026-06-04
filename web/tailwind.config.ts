// #2 Tailwind v3 config. Enterprise/bank-grade theming (tabular numerics,
// calm palette) is tuned in the UI block (#24).
import type {Config} from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
