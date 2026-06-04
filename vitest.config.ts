// #2 root Vitest config — discovers tests across the Bun workspaces. The
// deterministic-replay fast-check property (#19) and recon tests (#18) run here.
import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    include: ["{shared,api,indexer,scripts}/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "contracts/**", "web/**"],
  },
});
