// Money Layer · the graphql-yoga server + SSE + health, on the fixed API port · #21/#22
// createServer wires the Pothos schema (#20) onto graphql-yoga with the per-request ApiContext
// (#21) and the typed formatError guard (every error carries a ReasonCode or INTERNAL). The fetch
// handler also routes GET /health (liveness) and GET /sse (the live feed, #22) off one shared
// EventBus; the accrual + recon sources and the tx confirmation watcher (#23) start once at boot.
// One server signer drives all writes; the HALT gate (#21) blocks distribution on a recon break.
import { createYoga } from "graphql-yoga";
import { schema } from "./schema/index.ts";
import { formatError } from "./errors.ts";
import { createContext, type ApiContext } from "./context.ts";
import { EventBus } from "./sse/bus.ts";
import { sseHandler } from "./sse/handler.ts";
import { startAccrualSource, startReconSource } from "./sse/sources.ts";
import { startConfirmationWatcher } from "./tx/tracker.ts";

// #21 the assembled server: a fetch handler + the started background loops + a disposer.
export interface PclServer {
  fetch: (req: Request) => Promise<Response> | Response;
  bus: EventBus;
  context: ApiContext;
  dispose: () => Promise<void>;
}

// #21 build the server. A single shared ApiContext backs every GraphQL request (one DB pool, one
// signer); yoga's maskedErrors uses formatError so a leaked error is clamped to the code contract.
export function createServer(ctx: ApiContext = createContext()): PclServer {
  const bus = new EventBus();

  const yoga = createYoga<Record<string, never>, ApiContext>({
    schema,
    // #21 same context for every request (stateless reads/writes; no auth layer by design).
    context: () => ctx,
    graphqlEndpoint: "/graphql",
    // #21 the code guarantee: every surfaced error has extensions.code in the 7 ReasonCodes or INTERNAL.
    maskedErrors: { maskError: (error) => formatError(error) },
    landingPage: false,
  });

  // #22 start the live sources + the tx watcher once, sharing the one bus.
  const stopAccrual = startAccrualSource(ctx, bus);
  const stopRecon = startReconSource(ctx, bus);
  const stopWatcher = startConfirmationWatcher(ctx.db, ctx.chain.publicClient, bus);

  // #21/#22 the fetch router: /health, /sse, else GraphQL.
  const fetch = (req: Request): Promise<Response> | Response => {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "@pcl/api" }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (req.method === "GET" && url.pathname === "/sse") {
      return sseHandler(req, bus);
    }
    return yoga.fetch(req);
  };

  const dispose = async (): Promise<void> => {
    stopAccrual();
    stopRecon();
    stopWatcher();
    await ctx.db.end({ timeout: 5 });
  };

  return { fetch, bus, context: ctx, dispose };
}
