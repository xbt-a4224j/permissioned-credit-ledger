// SSE frame encoder · #22
// Turns a FeedEnvelope into a text/event-stream frame (`id:` / `event:` / `data:`). The data is
// JSON with a bigint replacer so a token amount that somehow arrives as a bigint serializes to a
// decimal STRING, never a lossy number (the BigIntStr landmine). Dates serialize to ISO strings.
import type { FeedEnvelope, FeedEvent } from "./bus.ts";

// #22 JSON.stringify replacer: bigint -> decimal string; Date -> ISO string. Everything else
// passes through. Guarantees money is never widened to an IEEE-754 number on the wire.
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

// #22 serialize one event's data payload (string, with the bigint/date replacer).
export function serializeData(event: FeedEvent): string {
  return JSON.stringify(event.data, replacer);
}

// #22 encode a full SSE frame: id + event-type + data, terminated by a blank line.
export function encodeFrame(env: FeedEnvelope): string {
  return `id: ${env.id}\nevent: ${env.event.type}\ndata: ${serializeData(env.event)}\n\n`;
}

// #22 a keep-alive comment frame (SSE comments start with `:` and are ignored by EventSource).
export function encodeComment(text: string): string {
  return `: ${text}\n\n`;
}
