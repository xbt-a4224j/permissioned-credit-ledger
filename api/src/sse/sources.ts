// SSE sources — turn read-model changes into pushed bus events · #22
// The client never polls; these sources do the watching server-side. startAccrualSource recomputes
// a per-holder accrual tick off positions.principal * ratePerSecond * elapsed on a fixed interval
// and publishes `accrual` (a DISPLAY projection only — never written back; the on-chain accrued
// (#9) and recon engine (#18) stay authoritative). startReconSource pushes a `recon` frame on every
// new reconciliation cycle / state transition via Postgres LISTEN/NOTIFY (a HALT reaches the UI the
// instant #18 commits it), with a short poll as the fallback when the listener drops.
import type { Sql } from "@pcl/shared";
import type { Manifest } from "../../../indexer/src/index.ts";
import type { EventBus } from "./bus.ts";
import { readReconStatus } from "../recon-reader.ts";

// #9 matches CreditToken.RATE_SCALE — ratePerSecond is fixed-point scaled by 1e18.
const RATE_SCALE = 10n ** 18n;

// #22 one accrual recompute pass: for each open position, claimable = accrued + principal *
// ratePerSecond * elapsed / SCALE, where elapsed is wall-seconds since opened_at. Publishes one
// `accrual` event per holder-position. Frozen loans contribute their accrued only (no advance).
// #41 per-position wall-clock anchor for the DISPLAY ticker. positions.opened_at is a block NUMBER
// (the optimistic-reconcile gate in tx/reconcile.ts depends on that), so it CANNOT be used as a
// unix timestamp here — doing so made `now - opened_at` ~56 years and inflated claimable to ~$178k,
// burying the per-second tick. Instead the source anchors each position the first time it sees it
// (live wall-clock); claimable then starts at the settled `accrued` (≈0) and counts up visibly. The
// anchor lives only in memory, so a restart/reset cleanly restarts the ticker near zero.
async function emitAccrualTicks(sql: Sql, manifest: Manifest, bus: EventBus, now: number, anchors: Map<string, number>, prevAccrued: Map<string, bigint>): Promise<void> {
  // money is selected ::text so it arrives as a decimal string; BigInt it for the math (the
  // numeric parser only fires on the numeric OID, not on a ::text cast — #15 client note).
  const rows = await sql<{ loan_id: string; holder: string; principal: string; accrued: string; opened_at: bigint | null }[]>`
    select loan_id, holder, principal::text as principal, accrued::text as accrued, opened_at
    from positions where principal > 0
  `;
  for (const r of rows) {
    const ln = manifest.loans[r.loan_id];
    const ratePerSecond = ln !== undefined ? BigInt(ln.ratePerSecond) : 0n;
    const key = `${r.loan_id}:${r.holder}`;
    const accrued = BigInt(r.accrued);
    let anchor = anchors.get(key);
    if (anchor === undefined) {
      anchor = now;
      anchors.set(key, anchor);
    }
    // reset anchor when accrued drops to 0 (claim confirmed on-chain) so claimable ticks from $0
    const prev = prevAccrued.get(key) ?? accrued;
    if (accrued === 0n && prev > 0n) {
      anchor = now;
      anchors.set(key, anchor);
    }
    prevAccrued.set(key, accrued);
    const elapsed = BigInt(Math.max(0, now - anchor));
    const pending = (BigInt(r.principal) * ratePerSecond * elapsed) / RATE_SCALE;
    const claimable = accrued + pending;
    bus.publish({
      type: "accrual",
      data: {
        holder: r.holder,
        loanId: r.loan_id,
        accrued: accrued.toString(),
        claimable: claimable.toString(),
        at: new Date(now * 1000),
      },
    });
  }
}

// #22 start the accrual ticker on a fixed interval (default 1000ms). Returns a stop fn that
// clears the timer (the handler/boot calls it on teardown). `nowFn` is injectable for tests.
export function startAccrualSource(
  ctx: { db: Sql; manifest: Manifest },
  bus: EventBus,
  intervalMs = 1000,
  nowFn: () => number = () => Math.floor(Date.now() / 1000),
): () => void {
  let stopped = false;
  // #41 in-memory wall-clock anchors per position (see emitAccrualTicks); reset with the process.
  const anchors = new Map<string, number>();
  // #41 track previous accrued per position so we can detect a claim (accrued drops to 0) and
  // reset the anchor — making the displayed claimable drop back to $0.0000 as expected.
  const prevAccrued = new Map<string, bigint>();
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await emitAccrualTicks(ctx.db, ctx.manifest, bus, nowFn(), anchors, prevAccrued);
    } catch {
      // transient read error — the next tick retries.
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };
  let timer = setTimeout(() => void tick(), intervalMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

// #22 start the reconciliation source: LISTEN on `recon_changed` and publish a `recon` frame on
// every NOTIFY (the trigger fires on a new recon_status row, #22 migration). A low-frequency poll
// backstops a dropped listener so a HALT is never missed. Returns a stop fn that unlistens +
// clears the poll timer.
export function startReconSource(ctx: { db: Sql }, bus: EventBus, pollMs = 2000): () => void {
  let stopped = false;
  let lastCycle = -1;

  const publishLatest = async (): Promise<void> => {
    const status = await readReconStatus(ctx.db);
    if (status.cycle !== lastCycle) {
      lastCycle = status.cycle;
      bus.publish({ type: "recon", data: status });
    }
  };

  // LISTEN/NOTIFY: push the instant #18 commits a row.
  let unlisten: (() => Promise<void>) | null = null;
  void ctx.db
    .listen("recon_changed", () => void publishLatest())
    .then((handle) => {
      if (stopped) void handle.unlisten();
      else unlisten = handle.unlisten;
    })
    .catch(() => {
      /* listener unavailable (e.g. pooled) — the poll fallback covers it. */
    });

  // poll fallback (and initial emit).
  const poll = async (): Promise<void> => {
    if (stopped) return;
    try {
      await publishLatest();
    } catch {
      /* retry next tick */
    }
    if (!stopped) timer = setTimeout(() => void poll(), pollMs);
  };
  let timer = setTimeout(() => void poll(), 0);

  return () => {
    stopped = true;
    clearTimeout(timer);
    if (unlisten !== null) void unlisten();
  };
}
