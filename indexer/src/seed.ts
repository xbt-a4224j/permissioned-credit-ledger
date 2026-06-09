// Seed the off-chain reference tables from the deploy manifest · #16
// The indexer mirrors chain EVENTS into positions/reserve, but the loan-tape reference rows
// (properties, loans, identities) are genesis facts the recon engine (#18) reads to check
// I1 (supply backed by loan principal) and I4 (holder identity valid). seedReference upserts
// them deterministically from the #12 manifest + the 6 canonical seeded identities (the exact
// claim mix from contracts/script/config/Identities.sol), so the off-chain reference matches
// the on-chain world without re-reading every claim over RPC.
import type { Sql } from "@pcl/shared";
import type { Manifest } from "./manifest.ts";

// #16 the 6 canonical identities (addresses + claims) — mirrors Identities.sol exactly:
// 2 accredited-US, 2 accredited Reg-S non-US, 1 unverified, 1 frozen.
export const SEEDED_IDENTITIES: { addr: string; verified: boolean; accredited: boolean; jurisdiction: "US" | "nonUS"; frozen: boolean }[] = [
  { addr: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8", verified: true, accredited: true, jurisdiction: "US", frozen: false },
  { addr: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc", verified: true, accredited: true, jurisdiction: "US", frozen: false },
  { addr: "0x90f79bf6eb2c4f870365e785982e1f101e93b906", verified: true, accredited: true, jurisdiction: "nonUS", frozen: false },
  { addr: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65", verified: true, accredited: true, jurisdiction: "nonUS", frozen: false },
  { addr: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc", verified: false, accredited: false, jurisdiction: "nonUS", frozen: false },
  { addr: "0x976ea74026e726554db657fa54763abd0c3a0aa9", verified: true, accredited: true, jurisdiction: "US", frozen: true },
];

const SECONDS_PER_YEAR = 31_536_000n;
const RATE_SCALE = 10n ** 18n; // matches CreditToken.RATE_SCALE

// #16 implied annual rate in bps from ratePerSecond (scaled by 1e18): rate*seconds/scale,
// expressed in basis points. Display/reference only — on-chain accrual is the source of truth.
function annualRateBps(ratePerSecond: bigint): number {
  return Number((ratePerSecond * SECONDS_PER_YEAR * 10000n) / RATE_SCALE);
}

// #16 implied collateral value from LTV: value = principal * 10000 / ltvBps.
function appraisedValue(principal: bigint, ltvBps: number): bigint {
  return (principal * 10000n) / BigInt(ltvBps);
}

export async function seedReference(sql: Sql, m: Manifest): Promise<void> {
  // identities first (positions FK references them).
  for (const id of SEEDED_IDENTITIES) {
    await sql`
      insert into identities (addr, verified, accredited, jurisdiction, frozen)
      values (${id.addr}, ${id.verified}, ${id.accredited}, ${id.jurisdiction}, ${id.frozen})
      on conflict (addr) do update set
        verified = excluded.verified, accredited = excluded.accredited,
        jurisdiction = excluded.jurisdiction, frozen = excluded.frozen
    `;
  }

  // properties + loans from the manifest (property_id == loanId, first-lien).
  for (const ln of Object.values(m.loans)) {
    const principal = BigInt(ln.principal);
    const propId = String(ln.loanId);
    await sql`
      insert into properties (id, address_label, appraised_value, lien_position)
      values (${propId}, ${ln.label}, ${appraisedValue(principal, ln.ltvBps).toString()}, 1)
      on conflict (id) do update set address_label = excluded.address_label, appraised_value = excluded.appraised_value
    `;
    await sql`
      insert into loans (id, principal, rate_bps, status, started_at, collateral_type, property_id, ltv_bps, dscr_bps)
      values (${String(ln.loanId)}, ${ln.principal}, ${annualRateBps(BigInt(ln.ratePerSecond))}, ${ln.status}, 0, ${ln.collateralType}, ${propId}, ${ln.ltvBps}, ${ln.dscrBps})
      on conflict (id) do update set
        principal = excluded.principal, status = excluded.status,
        collateral_type = excluded.collateral_type, ltv_bps = excluded.ltv_bps, dscr_bps = excluded.dscr_bps
    `;
  }

  // reserve single-row: seed to mirror the on-chain MockUSDC funding (Deploy.s.sol RESERVE_FUNDING
  // = 1_000_000e6). The off-chain `collected cash` the recon I2 invariant (claimable <= collected)
  // compares against must reflect the funded reserve — otherwise on-chain accrual outruns a 0 row and
  // the engine HALTs on its own. InterestClaimed projections debit this; reportCash overrides it.
  await sql`insert into reserve (id, balance, updated_at) values (1, 1000000000000, 0) on conflict (id) do update set balance = 1000000000000`;
}
