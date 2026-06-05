// #24 web Vitest config — jsdom env for RTL component tests + the fast-check property suites.
// Separate from the root config (which excludes web/**) because the UI tests need a DOM and the
// React plugin; the off-chain suites stay node-only.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
