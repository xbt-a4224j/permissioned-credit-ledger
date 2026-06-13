// Build the ReconSnapshot from chain + read models · #18
// loadSnapshot is the only I/O in the engine: it reads the off-chain read models (positions,
// reserve, identities, anomalous NAV) and the on-chain layer (per-token totalSupply +
// per-holder claimable) via viem, normalizing every money value to Usdc6 base units. The pure
// invariants (#18) and replay (#19) then verdict over the result. The token set comes from the
// loans read model (loans.token_address) — #66 — so RUNTIME-TOKENIZED loans are reconciled as
// first-class, exactly the set the indexer watches (#75); seeded loans carry the same token, so
// the matrix is unchanged.
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

// #66 _manifest is retained for signature stability across the recon cycle; the token set now comes
// from the loans read model (below), so the param is intentionally unused.
export async function loadSnapshot(sql: Sql, chain: PublicClient, _manifest: SnapshotManifest): Promise<ReconSnapshot> {
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

  // #66 the loan→token set from the loans read model — every tokenized loan (seeded + runtime), the
  // same set the indexer watches (#75). Drives both the I3 NavAnomaly scan and the on-chain reads.
  const loanTokenRows = await sql<{ id: string; token_address: string }[]>`
    select id, token_address from loans where token_address is not null order by id::int
  `;

  // I3: which active loans are under a NavAnomaly halt right now.
  const anomalousLoans: LoanId[] = [];
  for (const row of loanTokenRows) {
    const ln = loanId(row.id);
    if (await isAccrualFrozen(sql, ln)) anomalousLoans.push(ln);
  }

  // --- on-chain layer (viem) ---
  // #66 reconcile AT the indexer's cursor block, not `latest`. The off-chain positions/reserve above
  // reflect events projected up to this block, so reading on-chain supply/claimable at the SAME height
  // keeps both sides on one consistent instant. Reading `latest` instead races the indexer: a mint
  // confirmed on-chain but not yet projected makes onchain>offchain for ~1 cycle and trips a SPURIOUS
  // SupplyBacked halt that self-heals. Block time + cycle time are fast, so the skew is brief — but a
  // demo invest would still flicker HALTED and (worse) the halt gate would block a follow-up action.
  const cursorRow = await sql<{ block_number: string }[]>`select block_number::text as block_number from indexer_cursor limit 1`;
  const readOpts = { blockNumber: cursorRow[0] !== undefined ? BigInt(cursorRow[0].block_number) : undefined };

  const tokenByLoan = new Map<string, `0x${string}`>();
  for (const row of loanTokenRows) tokenByLoan.set(row.id, row.token_address as `0x${string}`);

  // per-token totalSupply (at the cursor block).
  const supplies: Usdc6[] = [];
  for (const token of tokenByLoan.values()) {
    const c = getContract({ address: token, abi: READ_ABI, client: chain });
    supplies.push(usdc6((await c.read.totalSupply(readOpts)) as bigint));
  }

  // per-holder on-chain claimable (at the cursor block), on that holder's loan token.
  const holders: HolderFacts[] = [];
  const claimables: Usdc6[] = [];
  for (const r of positionRows) {
    const token = tokenByLoan.get(r.loan_id);
    const holder = identityAddr(r.holder);
    const principal = usdc6(r.principal);
    let onchainClaimable = usdc6(0n);
    if (token !== undefined) {
      const c = getContract({ address: token, abi: READ_ABI, client: chain });
      onchainClaimable = usdc6((await c.read.claimable([holder], readOpts)) as bigint);
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
