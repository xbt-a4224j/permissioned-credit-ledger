// The reconciliation cycle — assert invariants, HALT on break · #18
// runReconCycle is the gate in front of every value-moving action. It loads the snapshot,
// evaluates the 4 invariants in fixed order, and persists a recon_status row. All-pass ->
// {ok:true, state_hash} and distribution stays open. First failure -> {ok:false} with the typed
// engine state ('NavAnomaly' if I3, else 'ReconMismatch'), the named failed invariant, and a
// distribution-halt flag (the latest recon_status.ok=false) so a break actually stops payouts.
// Matrix row 10 (inject cash < claimable) trips I2 -> ReconMismatch.
import { keccak256, toHex, type PublicClient } from "viem";
import type { Sql } from "@pcl/shared";
import { evaluateInvariants } from "./invariants.ts";
import { loadSnapshot, type SnapshotManifest } from "./snapshot.ts";
import type { ReconResult, ReconSnapshot } from "./types.ts";
// #19 the live cycle's state_hash is a COLD replay of the same DB inputs, so the recon_status
// row and an independent replay share one fingerprint (live and replay provably agree).
import { loadInputs, replay } from "../replay/replay.ts";
import { stateHash as replayStateHash } from "../replay/hash.ts";

// #18 default state_hash: a deterministic keccak over the snapshot's money-bearing fields.
// #19 rewires runReconCycle to use stateHash(replay(loadInputs)) so the live row and a cold
// replay share one fingerprint; until then this is a stable, sensitive snapshot fingerprint.
export function snapshotHash(s: ReconSnapshot): `0x${string}` {
  const canonical = JSON.stringify({
    supply: s.onchainTotalSupply.toString(),
    backed: s.offchainBackedPrincipal.toString(),
    claimable: s.onchainClaimableTotal.toString(),
    collected: s.offchainCollected.toString(),
    anomalous: [...s.anomalousLoans].sort(),
    holders: [...s.holders]
      .map((h) => ({ loan: h.loan, holder: h.holder, principal: h.principal.toString(), claimable: h.onchainClaimable.toString() }))
      .sort((a, b) => (a.holder + a.loan < b.holder + b.loan ? -1 : 1)),
  });
  return keccak256(toHex(canonical));
}

// #18/#19 the engine's state-hash source. The default folds a cold replay of the DB inputs
// (chain_events + nav_readings) into the deterministic stateHash, so the live recon_status row
// equals an independent replay's fingerprint. setStateHasher lets tests/tools override it (e.g.
// the snapshot fingerprint) without rewriting the cycle body.
let stateHasher: (sql: Sql, fallback: ReconSnapshot) => Promise<string> = async (sql, _snapshot) =>
  replayStateHash(replay(await loadInputs(sql)));

export function setStateHasher(fn: (sql: Sql, fallback: ReconSnapshot) => Promise<string>): void {
  stateHasher = fn;
}

export async function runReconCycle(sql: Sql, chain: PublicClient, manifest: SnapshotManifest): Promise<ReconResult> {
  const snapshot = await loadSnapshot(sql, chain, manifest);
  const verdict = evaluateInvariants(snapshot);
  const stateHash = await stateHasher(sql, snapshot);

  if (verdict.ok) {
    await sql`
      insert into recon_status (ok, state, failed_invariant, state_hash, detail)
      values (true, null, null, ${stateHash}, null)
    `;
    return { ok: true, stateHash };
  }

  // I3 break is a NAV anomaly; every other break is a reconciliation mismatch.
  const state = verdict.failed === "NavInBounds" ? "NavAnomaly" : "ReconMismatch";
  await sql`
    insert into recon_status (ok, state, failed_invariant, state_hash, detail)
    values (false, ${state}, ${verdict.failed}, ${stateHash}, ${sql.json(verdict.detail as Parameters<typeof sql.json>[0])})
  `;
  return { ok: false, state, failed: verdict.failed, detail: verdict.detail };
}
