// The live reconciliation status stream — the recon verdict made visible · #26
// Opens its own EventSource on the #22 /sse feed (capped-backoff reconnect, one per hook instance)
// and parses `event: recon` frames into a typed ReconStatus. The four InvariantResult.name values
// are EXACTLY the engine's four invariants (#18). A HALT (NavAnomaly row 9 / ReconMismatch row 10)
// flips `state` to 'HALTED' and sets the typed `haltCode`; the header pill + panel both read this
// one source so a halt is impossible to miss. Money stays bigint (BigIntStr -> bigint here).
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import type { HaltCode } from "./reasonCodes.ts";
import { isHaltCode, isReasonCode } from "./reasonCodes.ts";

// #26 the four invariant names, in the UI's canonical PascalCase (1:1 with engine #18 I1-I4).
export type InvariantName = "SupplyBacked" | "ClaimableLeCollected" | "NavInBounds" | "IdentityValid";

// #26 one invariant's verdict (pass/fail + a human detail).
export interface InvariantResult {
  name: InvariantName;
  ok: boolean;
  detail: string;
}

// #26 a per-holder on-chain-vs-off-chain delta. deltaWei == onChainClaimableWei - offChainCollectedWei.
export interface BalanceDelta {
  holder: Address;
  onChainClaimableWei: bigint;
  offChainCollectedWei: bigint;
  deltaWei: bigint;
}

// #26 the full recon status the panel + header pill render.
export interface ReconStatus {
  state: "OK" | "HALTED";
  haltCode?: HaltCode;
  cycle: number;
  stateHash: `0x${string}`;
  invariants: InvariantResult[];
  deltas: BalanceDelta[];
  asOf: number;
}

// #22 the on-the-wire recon frame (the GraphQL ReconciliationStatusSource, money as strings).
interface ReconFrame {
  state: "OK" | "HALTED";
  cycle: number;
  checkedAt: string;
  haltReason: string | null;
  stateHash?: string;
  invariants: { name: string; ok: boolean; onchain: string | null; offchain: string | null; delta: string | null }[];
  deltas?: { holder: string; onChainClaimableWei: string; offChainCollectedWei: string; deltaWei: string }[];
}

// #26 the engine's camelCase invariant names -> the UI's PascalCase canonical names.
const NAME_MAP: Record<string, InvariantName> = {
  supplyBacked: "SupplyBacked",
  claimableCovered: "ClaimableLeCollected",
  navInBounds: "NavInBounds",
  identityValid: "IdentityValid",
};
// #26 the canonical render order — the panel always shows exactly these 4 rows.
const CANONICAL_ORDER: InvariantName[] = ["SupplyBacked", "ClaimableLeCollected", "NavInBounds", "IdentityValid"];

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:41990/graphql";
const SSE_URL = `${API_URL.replace(/\/graphql\/?$/, "")}/sse`;

// #26 map one wire invariant row -> the canonical InvariantResult; detail carries the delta when set.
function mapInvariants(rows: ReconFrame["invariants"]): InvariantResult[] {
  const byName = new Map<InvariantName, InvariantResult>();
  for (const r of rows) {
    const name = NAME_MAP[r.name];
    if (name === undefined) continue;
    const detail = r.delta !== null ? `delta ${r.delta}` : r.ok ? "in agreement" : "mismatch";
    byName.set(name, { name, ok: r.ok, detail });
  }
  // always emit all 4 in canonical order; a missing row defaults to ok (genesis is consistent).
  return CANONICAL_ORDER.map((name) => byName.get(name) ?? { name, ok: true, detail: "in agreement" });
}

// #26 derive the per-holder deltas. The engine may push an explicit `deltas` array; if absent, the
// stream has no per-holder breakdown for this cycle (an empty table, not a recomputed guess).
function mapDeltas(frame: ReconFrame): BalanceDelta[] {
  if (frame.deltas === undefined) return [];
  return frame.deltas.map((d) => ({
    holder: d.holder.toLowerCase() as Address,
    onChainClaimableWei: BigInt(d.onChainClaimableWei),
    offChainCollectedWei: BigInt(d.offChainCollectedWei),
    deltaWei: BigInt(d.deltaWei),
  }));
}

// #26 parse one `recon` frame -> a typed ReconStatus, or null when malformed (dropped, never throws).
export function parseReconFrame(raw: string): ReconStatus | null {
  try {
    const f = JSON.parse(raw) as Partial<ReconFrame>;
    if (f.state !== "OK" && f.state !== "HALTED") return null;
    if (!Array.isArray(f.invariants)) return null;
    const status: ReconStatus = {
      state: f.state,
      cycle: typeof f.cycle === "number" ? f.cycle : 0,
      stateHash: (typeof f.stateHash === "string" ? f.stateHash : "0x") as `0x${string}`,
      invariants: mapInvariants(f.invariants),
      deltas: mapDeltas(f as ReconFrame),
      asOf: typeof f.checkedAt === "string" ? Math.floor(new Date(f.checkedAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
    };
    // the typed halt code: only a known halt-tone reason code (NavAnomaly | ReconMismatch).
    if (f.state === "HALTED" && typeof f.haltReason === "string" && isReasonCode(f.haltReason) && isHaltCode(f.haltReason)) {
      status.haltCode = f.haltReason;
    }
    return status;
  } catch {
    return null;
  }
}

// #26 the hook: subscribe to the `recon` channel on one EventSource (capped-backoff reconnect),
// returning the latest ReconStatus (undefined until the first frame).
export function useReconStream(): ReconStatus | undefined {
  const [status, setStatus] = useState<ReconStatus | undefined>(undefined);
  const backoffRef = useRef(500);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const onRecon = (ev: MessageEvent): void => {
      const next = parseReconFrame(ev.data as string);
      if (next !== null) setStatus(next);
    };

    // #26 immediate one-shot fetch so the panel/pill render the current status within one request —
    // never stuck on "Connecting…" waiting for the next SSE publish. SSE then keeps it live; we only
    // seed if a live frame hasn't already arrived (prev ?? seed), so we never clobber a fresher HALT.
    void fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ reconciliationStatus { state cycle checkedAt haltReason invariants { name ok onchain offchain delta } } }" }),
    })
      .then((r) => r.json())
      .then((j: { data?: { reconciliationStatus?: unknown } }) => {
        if (closed || j.data?.reconciliationStatus === undefined) return;
        const seed = parseReconFrame(JSON.stringify(j.data.reconciliationStatus));
        if (seed !== null) setStatus((prev) => prev ?? seed);
      })
      .catch(() => { /* SSE will deliver it */ });

    const connect = (): void => {
      if (closed) return;
      es = new EventSource(SSE_URL);
      es.addEventListener("recon", onRecon as EventListener);
      es.onopen = (): void => {
        backoffRef.current = 500;
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

  return status;
}
