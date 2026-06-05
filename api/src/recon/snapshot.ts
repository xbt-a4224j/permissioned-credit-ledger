// The Seam · build the ReconSnapshot from chain + read models · #18
// loadSnapshot is the only I/O in the engine: it reads the off-chain read models (positions,
// reserve, identities, anomalous NAV) and the on-chain layer (per-token totalSupply +
// per-holder claimable) via viem, normalizing every money value to Usdc6 base units. The pure
// invariants (#18) and replay (#19) then verdict over the result. Token addresses come from the
// #12 manifest — no hardcoded addresses.
import { getContract, type PublicClient } from "viem";
import { identityAddr, loanId, usdc6, type IdentityAddr, type LoanId, type Sql, type Usdc6 } from "@pcl/shared";
import { isAccrualFrozen } from "../nav/accrualGate.ts";
import type { HolderFacts, IdentityFacts, ReconSnapshot } from "./types.ts";

// #18 minimal CreditToken read ABI (totalSupply + claimable) for the on-chain side.
const READ_ABI = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claimable", stateMutability: "view", inputs: [{ name: "holder", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export interface SnapshotManifest {
  loans: Record<string, { loanId: number; token: string }>;
}

// #18 sum a list of Usdc6 (folds the per-token / per-holder reads).
function sum(vals: Usdc6[]): Usdc6 {
  return vals.reduce((acc, v) => (acc + v) as Usdc6, usdc6(0n));
}

export async function loadSnapshot(sql: Sql, chain: PublicClient, manifest: SnapshotManifest): Promise<ReconSnapshot> {
  // --- off-chain read models ---
  const positionRows = await sql<{ loan_id: string; holder: string; principal: bigint }[]>`
    select loan_id, holder, principal::text as principal from positions where principal > 0
  `;
  const reserveRow = await sql<{ balance: bigint }[]>`select balance::text as balance from reserve where id = 1`;
  const identityRows = await sql<{ addr: string; verified: boolean; frozen: boolean }[]>`select addr, verified, frozen from identities`;

  const identities = new Map<IdentityAddr, IdentityFacts>();
  for (const r of identityRows) {
    const addr = identityAddr(r.addr);
    identities.set(addr, { addr, verified: r.verified, frozen: r.frozen });
  }

  // I3: which active loans are under a NavAnomaly halt right now.
  const anomalousLoans: LoanId[] = [];
  for (const key of Object.keys(manifest.loans)) {
    const ln = loanId(manifest.loans[key]!.loanId);
    if (await isAccrualFrozen(sql, ln)) anomalousLoans.push(ln);
  }

  // --- on-chain layer (viem) ---
  const tokenByLoan = new Map<string, `0x${string}`>();
  for (const ln of Object.values(manifest.loans)) tokenByLoan.set(String(ln.loanId), ln.token as `0x${string}`);

  // per-token totalSupply.
  const supplies: Usdc6[] = [];
  for (const token of tokenByLoan.values()) {
    const c = getContract({ address: token, abi: READ_ABI, client: chain });
    supplies.push(usdc6((await c.read.totalSupply()) as bigint));
  }

  // per-holder on-chain claimable, on that holder's loan token.
  const holders: HolderFacts[] = [];
  const claimables: Usdc6[] = [];
  for (const r of positionRows) {
    const token = tokenByLoan.get(r.loan_id);
    const holder = identityAddr(r.holder);
    const principal = usdc6(r.principal);
    let onchainClaimable = usdc6(0n);
    if (token !== undefined) {
      const c = getContract({ address: token, abi: READ_ABI, client: chain });
      onchainClaimable = usdc6((await c.read.claimable([holder])) as bigint);
    }
    holders.push({ loan: loanId(r.loan_id), holder, principal, onchainClaimable });
    claimables.push(onchainClaimable);
  }

  return {
    onchainTotalSupply: sum(supplies),
    offchainBackedPrincipal: sum(positionRows.map((r) => usdc6(r.principal))),
    onchainClaimableTotal: sum(claimables),
    offchainCollected: usdc6(reserveRow[0]?.balance ?? 0n),
    anomalousLoans,
    holders,
    identities,
    navByLoan: new Map(),
  };
}
