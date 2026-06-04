// The Seam · canonical state serialization + keccak fingerprint · #19
// stateHash fingerprints a ReplayState so "are we still solvent?" has a single, reproducible,
// byte-exact answer. Determinism dies on three things (the #19 landmine): JSON key order (we
// sort every object key + map entry), bigint serialization (every Usdc6 routes through
// usdc6ToString, never the default thrower), and Map iteration order (we sort entries before
// hashing). canonicalize is exposed so a hash diff can be eye-diffed against the canonical form.
import { keccak256, toHex } from "viem";
import { usdc6ToString } from "@pcl/shared";
import type { ReplayState } from "./types.ts";

// #19 a fully-sorted, bigint-safe plain object — the single canonical form of a ReplayState.
export function canonicalize(s: ReplayState): unknown {
  const positions = [...s.positions.entries()]
    .map(([id, p]) => ({
      id,
      loan: p.loan,
      holder: p.holder,
      principal: usdc6ToString(p.principal),
      accrued: usdc6ToString(p.accrued),
      openedAt: p.openedAt,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const navByLoan = [...s.navByLoan.entries()]
    .map(([loan, r]) => ({ loan, navBps: r.navBps, observedAt: r.observedAt, source: r.source }))
    .sort((a, b) => (a.loan < b.loan ? -1 : a.loan > b.loan ? 1 : 0));

  return {
    positions,
    reserve: { balance: usdc6ToString(s.reserve.balance), updatedAt: s.reserve.updatedAt },
    navByLoan,
    halted: s.halted,
  };
}

// #19 the deterministic fingerprint: keccak256 of the canonical JSON. Equal inputs (in any
// interleaving) -> equal hash; a 1-base-unit change anywhere -> a different hash.
export function stateHash(s: ReplayState): `0x${string}` {
  return keccak256(toHex(JSON.stringify(canonicalize(s))));
}
