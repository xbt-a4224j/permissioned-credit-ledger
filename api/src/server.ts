// The graphql-yoga server + SSE + health, on the fixed API port · #21/#22
// createServer wires the Pothos schema (#20) onto graphql-yoga with the per-request ApiContext
// (#21) and the typed formatError guard (every error carries a ReasonCode or INTERNAL). The fetch
// handler also routes GET /health (liveness) and GET /sse (the live feed, #22) off one shared
// EventBus; the accrual + recon sources and the tx confirmation watcher (#23) start once at boot.
// One server signer drives all writes; the HALT gate (#21) blocks distribution on a recon break.
import { createYoga } from "graphql-yoga";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { schema } from "./schema/index.ts";
import { formatError } from "./errors.ts";
import { createContext, type ApiContext } from "./context.ts";
import { EventBus } from "./sse/bus.ts";
import { sseHandler } from "./sse/handler.ts";
import { startAccrualSource, startReconSource } from "./sse/sources.ts";
import { startConfirmationWatcher } from "./tx/tracker.ts";

// #39 action log — append-only JSONL file at repo-root/logs/actions.log (gitignored).
const LOG_DIR = new URL("../../../logs", import.meta.url).pathname;
const LOG_FILE = `${LOG_DIR}/actions.log`;
try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* already exists */ }

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

// #39 append one JSONL entry. Never throws — a log failure must not crash the API.
function appendLog(entry: Record<string, unknown>): void {
  try {
    appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch { /* swallow */ }
}

// #39 read last `limit` lines from the log file, parsed as JSON.
function readLog(limit: number): unknown[] {
  try {
    const lines = readFileSync(LOG_FILE, "utf8").trimEnd().split("\n").filter(Boolean);
    return lines.slice(-Math.min(limit, 200)).reverse().map((l) => JSON.parse(l));
  } catch { return []; }
}

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
    // #21 the code guarantee: every surfaced error has extensions.code in the 8 typed codes or INTERNAL.
    maskedErrors: { maskError: (error) => formatError(error) },
    landingPage: false,
  });

  // #22 start the live sources + the tx watcher once, sharing the one bus.
  const stopAccrual = startAccrualSource(ctx, bus);
  const stopRecon = startReconSource(ctx, bus);
  const stopWatcher = startConfirmationWatcher(ctx.db, ctx.chain.publicClient, bus);

  // #21/#22/#39 the fetch router: /health, /sse, /log, /logs, else GraphQL.
  const fetch = (req: Request): Promise<Response> | Response => {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "@pcl/api" }), {
        headers: { "content-type": "application/json", ...CORS_HEADERS },
      });
    }
    if (req.method === "GET" && url.pathname === "/sse") {
      return sseHandler(req, bus);
    }
    // #39 POST /log — append a user/product action entry (fire-and-forget from the UI).
    if (req.method === "POST" && url.pathname === "/log") {
      return (async (): Promise<Response> => {
        try {
          const body = await req.json() as Record<string, unknown>;
          // strip any attempt to inject large payloads or prototype pollution
          const safe: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(body)) {
            if (typeof k === "string" && k.length < 64 && !k.startsWith("__")) safe[k] = v;
          }
          appendLog(safe);
        } catch { /* malformed body — ignore */ }
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      })();
    }
    // #39 GET /logs?limit=N — return the last N action log entries as JSON (newest first).
    if (req.method === "GET" && url.pathname === "/logs") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
      return new Response(JSON.stringify(readLog(limit)), {
        headers: { "content-type": "application/json", ...CORS_HEADERS },
      });
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
