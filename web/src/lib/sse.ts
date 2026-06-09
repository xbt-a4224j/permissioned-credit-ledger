// The live accrual stream — one EventSource, no polling · #24
// Subscribes to the #22 SSE feed (GET ${VITE_API_URL}/sse) and parses `event: accrual` frames into
// a per-position tick map. The count-up the dashboard shows derives from the engine's pushed
// `accruedWei`/`claimableWei` (a DISPLAY projection of the authoritative on-chain accrued, #9) —
// never a client setInterval guessing, which would drift from the deterministic state and silently
// contradict the reconciliation verdict. Money stays bigint (BigIntStr -> bigint here), never a
// number. The EventSource reconnects with capped backoff so a paused API in CI never wedges a test.
import { useEffect, useRef, useState } from "react";
import type { IdentityAddr, LoanId, PositionId } from "../types.ts";

// #24 a per-position accrual tick. Money is bigint base units; asOf is epoch seconds from the frame.
export interface AccrualTick {
  positionId: PositionId;
  holder: IdentityAddr;
  loanId: LoanId;
  accruedWei: bigint;
  claimableWei: bigint;
  asOf: number;
}

// #22 the on-the-wire accrual frame data shape (money as decimal strings, `at` as an ISO date).
interface AccrualFrame {
  holder: string;
  loanId: string;
  accrued: string;
  claimable: string;
  at: string;
}

// #24 the API origin (same default as the GraphQL client — the fixed API port).
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:41990/graphql";
// strip a trailing /graphql so the SSE path is a sibling of the GraphQL endpoint.
const SSE_URL = `${API_URL.replace(/\/graphql\/?$/, "")}/sse`;

// #24 canonical position key — `${loanId}:${holder}` lowercased, matching the shared positionId.
function keyOf(loanId: string, holder: string): PositionId {
  return `${loanId}:${holder.toLowerCase()}` as PositionId;
}

// #24 parse one `accrual` frame -> a tick, or null when the payload is malformed (dropped, never
// throws — a single bad frame must not kill the stream).
export function parseAccrualFrame(raw: string): AccrualTick | null {
  try {
    const f = JSON.parse(raw) as Partial<AccrualFrame>;
    if (typeof f.holder !== "string" || typeof f.loanId !== "string") return null;
    if (typeof f.accrued !== "string" || typeof f.claimable !== "string") return null;
    return {
      positionId: keyOf(f.loanId, f.holder),
      holder: f.holder.toLowerCase() as IdentityAddr,
      loanId: f.loanId as LoanId,
      accruedWei: BigInt(f.accrued),
      claimableWei: BigInt(f.claimable),
      asOf: typeof f.at === "string" ? Math.floor(new Date(f.at).getTime() / 1000) : Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}

// #24 the hook: open one EventSource, coalesce accrual ticks by positionId, reconnect with capped
// backoff. Returns the latest tick per position. Recon `event: recon` frames are handled by
// useReconStream (#26) on its own subscription — this hook ignores non-accrual frames.
export function useAccrualStream(): Map<PositionId, AccrualTick> {
  const [ticks, setTicks] = useState<Map<PositionId, AccrualTick>>(() => new Map());
  const backoffRef = useRef(500);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const onAccrual = (ev: MessageEvent): void => {
      const tick = parseAccrualFrame(ev.data as string);
      if (tick === null) return; // malformed frame dropped
      setTicks((prev) => {
        const next = new Map(prev);
        next.set(tick.positionId, tick);
        return next;
      });
    };

    const connect = (): void => {
      if (closed) return;
      es = new EventSource(SSE_URL);
      es.addEventListener("accrual", onAccrual as EventListener);
      es.onopen = (): void => {
        backoffRef.current = 500; // reset backoff on a healthy connection
      };
      es.onerror = (): void => {
        es?.close();
        if (closed) return;
        const wait = Math.min(backoffRef.current, 8000);
        backoffRef.current = Math.min(wait * 2, 8000);
        retry = setTimeout(connect, wait);
      };
    };
    connect();

    return () => {
      closed = true;
      if (retry !== null) clearTimeout(retry);
      es?.close();
    };
  }, []);

  return ticks;
}
