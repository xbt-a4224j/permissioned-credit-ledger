// Money Layer · the GET /sse endpoint — a live event-stream off the read models · #22
// Returns a text/event-stream ReadableStream that: replays buffered events on reconnect
// (Last-Event-ID), subscribes to the shared bus and writes each event as an SSE frame, emits a
// heartbeat comment every 15s so latency-tolerant proxies keep the connection open, supports an
// optional ?holder=0x.. filter on the accrual stream, and tears the listener + heartbeat down on
// req.signal abort (no leaked subscriber, no further writes). The bus + sources are shared across
// connections (started once at boot, #21 server).
import type { EventBus, FeedEnvelope } from "./bus.ts";
import { encodeComment, encodeFrame } from "./serialize.ts";

// #22 heartbeat cadence (keep-alive). 15s comfortably under common 30-60s proxy idle timeouts.
const HEARTBEAT_MS = 15_000;

// #22 should this connection receive this event? An accrual stream filtered by ?holder only sees
// that holder's ticks; recon/tx/heartbeat are always delivered (system-wide signals).
function passesFilter(env: FeedEnvelope, holder: string | null): boolean {
  if (holder === null) return true;
  if (env.event.type === "accrual") return env.event.data.holder.toLowerCase() === holder.toLowerCase();
  return true;
}

// #22 build the SSE Response. encoder is a TextEncoder; the stream closes + unsubscribes on abort.
export function sseHandler(req: Request, bus: EventBus): Response {
  const url = new URL(req.url);
  const holder = url.searchParams.get("holder");
  const lastEventId = req.headers.get("Last-Event-ID");
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (s: string): void => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          /* controller already closed (client gone) — ignore. */
        }
      };

      // #22 resume: replay buffered events with id > Last-Event-ID (no duplicates, in order).
      if (lastEventId !== null) {
        const since = Number(lastEventId);
        if (Number.isFinite(since)) {
          for (const env of bus.replaySince(since)) {
            if (passesFilter(env, holder)) write(encodeFrame(env));
          }
        }
      }

      // #22 live subscription.
      unsubscribe = bus.on((env) => {
        if (passesFilter(env, holder)) write(encodeFrame(env));
      });

      // #22 keep-alive heartbeat comment.
      heartbeat = setInterval(() => write(encodeComment(`heartbeat ${new Date().toISOString()}`)), HEARTBEAT_MS);

      // #22 teardown on client abort: unsubscribe, stop heartbeat, close the stream.
      const abort = (): void => {
        if (unsubscribe !== null) unsubscribe();
        unsubscribe = null;
        if (heartbeat !== null) clearInterval(heartbeat);
        heartbeat = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      if (req.signal.aborted) abort();
      else req.signal.addEventListener("abort", abort, { once: true });
    },
    cancel() {
      if (unsubscribe !== null) unsubscribe();
      unsubscribe = null;
      if (heartbeat !== null) clearInterval(heartbeat);
      heartbeat = null;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      // #41 CORS: the web app (localhost:51730) connects to the API (localhost:41990); EventSource
      // requires the response to carry Allow-Origin or the browser silently drops the connection.
      "access-control-allow-origin": "*",
    },
  });
}
