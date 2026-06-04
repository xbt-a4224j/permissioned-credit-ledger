// Money Layer · API entrypoint — migrate, then serve GraphQL + SSE on the fixed port · #21/#22/#23
// Boots the whole API: apply migrations (idempotent, #15), build the server (Pothos schema #20,
// resolvers #21, SSE #22, tx watcher #23), and listen on API_PORT (41990, the CLAUDE.md fixed
// port). The reconciliation HALT gate (#21) blocks distribution on a recon break; one server
// signer drives all writes against the local node (Fuji is the live-demo target only).
import { applyMigrations } from "@pcl/shared";
import { createServer } from "./server.ts";
import { createContext } from "./context.ts";

// #2 kept for the toolchain smoke test (the workspace's typed surface marker).
export const API_NAME = "@pcl/api" as const;

export { createServer } from "./server.ts";
export { createContext } from "./context.ts";

const API_PORT = Number(process.env.API_PORT ?? "41990");

// #21 only run the listener when executed directly (tests import createServer, not the boot).
if (import.meta.main) {
  const ctx = createContext();
  await applyMigrations(ctx.db);
  const server = createServer(ctx);

  const bunServer = Bun.serve({ port: API_PORT, fetch: server.fetch });
  console.log(`[api] graphql + sse on http://localhost:${bunServer.port}/graphql  (sse: /sse, health: /health)`);

  const shutdown = async (): Promise<void> => {
    await server.dispose();
    bunServer.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
