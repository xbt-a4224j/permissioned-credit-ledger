// #2 root Vitest config — discovers tests across the Bun workspaces. The
// deterministic-replay fast-check property (#19) and recon tests (#18) run here.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// #20 graphql is a single peer-dep copy (bun isolates it under .bun/graphql@…). Under the vitest
// loader Pothos and the test can otherwise instantiate it twice -> "another module or realm" on a
// cross-copy GraphQLSchema. Aliasing graphql to that one resolved path forces a single instance,
// so the Pothos-built schema and the test's validateSchema share one realm. Resolved dynamically
// from the api workspace (where graphql is installed) so a lockfile bump doesn't break the alias.
const HERE = dirname(fileURLToPath(import.meta.url));
const apiRequire = createRequire(join(HERE, "api", "package.json"));
const GRAPHQL_DIR = dirname(apiRequire.resolve("graphql/package.json"));

export default defineConfig({
  resolve: {
    alias: {
      graphql: GRAPHQL_DIR,
    },
  },
  test: {
    include: ["{shared,api,indexer,scripts}/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "contracts/**", "web/**"],
    server: {
      deps: {
        // #20 inline the graphql-consuming packages so their `import 'graphql'` goes through the
        // alias above (the single copy) instead of Node's externalized resolution — otherwise the
        // Pothos-built schema and the test's graphql land in different realms.
        inline: ["@pothos/core", "@pothos/plugin-simple-objects", "graphql-yoga"],
      },
    },
    // #21 the integration suites share ONE local anvil + the verify-gate Postgres; the chain is
    // stateful (the mutation suite broadcasts then snapshots/reverts; recon/nav warp time). Run
    // files sequentially in a single worker so shared state is deterministic and snapshot/revert is
    // well-ordered — parallel workers against one anvil would interleave reverts and drift.
    fileParallelism: false,
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
