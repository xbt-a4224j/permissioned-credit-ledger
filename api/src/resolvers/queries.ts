// Money Layer · query resolvers — read the off-chain read models (no ORM, no chain) · #21
// The six read fields (#20) resolved as raw parameterized SQL against the loans/positions/
// reserve/recon_status/identities read models the indexer (#16) and reconciliation engine (#18)
// populate. Every money column is numeric(78,0) -> a bigint (the #15 client parser) -> a decimal
// string at the GraphQL boundary (the BigIntStr landmine). ratePerSecond comes from the deploy
// manifest (#12). position(s) merge the optimistic pre-confirmation rows (#23).
import type { ApiContext } from "../context.ts";
import type { LoanSource } from "../schema/types/loan.ts";
import type { PositionSource } from "../schema/types/position.ts";
import type { ReserveStateSource } from "../schema/types/reserve.ts";
import type { ReconciliationStatusSource } from "../schema/types/reconciliation.ts";
import type { NavReadingSource } from "../schema/types/navReading.ts";
import { optimisticPositionsFor } from "../tx/reconcile.ts";

// #21 read-model loan status -> the GraphQL LoanStatus enum. DEFAULT == Matured (no accrual);
// a NAV-frozen loan shows Frozen; everything else is Active.
function loanStatus(dbStatus: string, frozen: boolean): "Active" | "Frozen" | "Matured" {
  if (frozen) return "Frozen";
  if (dbStatus === "DEFAULT") return "Matured";
  return "Active";
}

// #21 the set of loan ids currently under a NavAnomaly halt (sticky, uncleared). One query.
async function frozenLoanIds(ctx: ApiContext): Promise<Set<string>> {
  const rows = await ctx.db<{ loan: string }[]>`
    with last_clear as (select cycle_id from recon_status where ok = true order by cycle_id desc limit 1)
    select distinct detail ->> 'loan' as loan
    from recon_status
    where state = 'NavAnomaly'
      and (detail ->> 'loan') is not null
      and cycle_id > coalesce((select cycle_id from last_clear), 0)
  `;
  return new Set(rows.map((r) => r.loan));
}

// #21 all 6 loans, ordered by numeric id. ratePerSecond from the manifest (display only).
export async function resolveLoans(ctx: ApiContext): Promise<LoanSource[]> {
  const frozen = await frozenLoanIds(ctx);
  const rows = await ctx.db<{ id: string; principal: bigint; status: string; ltv_bps: number; dscr_bps: number }[]>`
    select id, principal::text as principal, status, ltv_bps, dscr_bps from loans order by id::int
  `;
  return rows.map((r) => {
    const manifestLoan = ctx.manifest.loans[r.id];
    return {
      id: r.id,
      principal: r.principal.toString(),
      ratePerSecond: manifestLoan?.ratePerSecond ?? "0",
      ltvBps: r.ltv_bps,
      dscrBps: r.dscr_bps,
      status: loanStatus(r.status, frozen.has(r.id)),
      dataRoomUri: manifestLoan ? `ipfs://dataroom/${r.id}` : null,
    };
  });
}

// #21 one loan by id (null if unknown).
export async function resolveLoan(ctx: ApiContext, id: string): Promise<LoanSource | null> {
  const frozen = await frozenLoanIds(ctx);
  const rows = await ctx.db<{ id: string; principal: bigint; status: string; ltv_bps: number; dscr_bps: number }[]>`
    select id, principal::text as principal, status, ltv_bps, dscr_bps from loans where id = ${id}
  `;
  const r = rows[0];
  if (r === undefined) return null;
  const manifestLoan = ctx.manifest.loans[r.id];
  return {
    id: r.id,
    principal: r.principal.toString(),
    ratePerSecond: manifestLoan?.ratePerSecond ?? "0",
    ltvBps: r.ltv_bps,
    dscrBps: r.dscr_bps,
    status: loanStatus(r.status, frozen.has(r.id)),
    dataRoomUri: manifestLoan ? `ipfs://dataroom/${r.id}` : null,
  };
}

// #21 map a canonical positions row -> the GraphQL Position source. claimable is the off-chain
// accrued mirror (positions.accrued); the on-chain claimable is recon's authoritative value.
function canonicalPosition(r: { id: string; loan_id: string; holder: string; principal: bigint; accrued: bigint; opened_at: bigint | null }): PositionSource {
  return {
    id: r.id,
    holder: r.holder,
    loanId: r.loan_id,
    principal: r.principal.toString(),
    accrued: r.accrued.toString(),
    claimable: r.accrued.toString(),
    lastAccrualAt: new Date(Number(r.opened_at ?? 0n) * 1000),
    optimistic: false,
  };
}

// #21/#23 one holder's position on a loan: the canonical row, or — before the indexer catches up
// — a synthesized optimistic row (optimistic=true). Holder is lowercased to match the read model.
export async function resolvePosition(ctx: ApiContext, holder: string, loanId: string): Promise<PositionSource | null> {
  const h = holder.toLowerCase();
  const rows = await ctx.db<{ id: string; loan_id: string; holder: string; principal: bigint; accrued: bigint; opened_at: bigint | null }[]>`
    select id, loan_id, holder, principal::text as principal, accrued::text as accrued, opened_at
    from positions where holder = ${h} and loan_id = ${loanId} and principal > 0
  `;
  if (rows[0] !== undefined) return canonicalPosition(rows[0]);
  const optimistic = await optimisticPositionsFor(ctx.db, h);
  return optimistic.find((p) => p.loanId === loanId) ?? null;
}

// #21/#23 all of a holder's positions: canonical (principal > 0) plus un-reconciled optimistic
// rows whose canonical counterpart has not yet landed (#23).
export async function resolvePositions(ctx: ApiContext, holder: string): Promise<PositionSource[]> {
  const h = holder.toLowerCase();
  const rows = await ctx.db<{ id: string; loan_id: string; holder: string; principal: bigint; accrued: bigint; opened_at: bigint | null }[]>`
    select id, loan_id, holder, principal::text as principal, accrued::text as accrued, opened_at
    from positions where holder = ${h} and principal > 0 order by loan_id::int
  `;
  const canonical = rows.map(canonicalPosition);
  const canonicalLoans = new Set(canonical.map((p) => p.loanId));
  const optimistic = (await optimisticPositionsFor(ctx.db, h)).filter((p) => !canonicalLoans.has(p.loanId));
  return [...canonical, ...optimistic];
}

// #21 the reserve coverage: the single-row balance + the aggregate off-chain claimable
// (sum of positions.accrued). recon I2 requires totalClaimable <= balance.
export async function resolveReserve(ctx: ApiContext): Promise<ReserveStateSource> {
  const reserveRows = await ctx.db<{ balance: bigint }[]>`select balance::text as balance from reserve where id = 1`;
  const claimRows = await ctx.db<{ total: bigint }[]>`select coalesce(sum(accrued), 0)::text as total from positions`;
  return {
    balance: (reserveRows[0]?.balance ?? 0n).toString(),
    totalClaimable: (claimRows[0]?.total ?? 0n).toString(),
  };
}

// #21 the marquee: the latest reconciliation cycle as the GraphQL status (#18 -> #20 shape).
export async function resolveReconciliationStatus(ctx: ApiContext): Promise<ReconciliationStatusSource> {
  return ctx.recon.read();
}

// #38 the last 10 NAV readings for a loan, newest first. loanId is a parameterized string
// from the query arg — never interpolated directly (tagged-template driver handles escaping).
export async function resolveNavReadings(ctx: ApiContext, loanId: string): Promise<NavReadingSource[]> {
  const rows = await ctx.db<{ id: string; loan_id: string; nav_bps: number; observed_at: bigint; source: string; accepted: boolean; reject_reason: string | null }[]>`
    select id::text, loan_id, nav_bps, observed_at, source, accepted, reject_reason
    from nav_readings
    where loan_id = ${loanId}
    order by observed_at desc
    limit 10
  `;
  return rows.map((r) => ({
    id: r.id,
    loanId: r.loan_id,
    navBps: r.nav_bps,
    observedAt: new Date(Number(r.observed_at) * 1000),
    source: r.source,
    accepted: r.accepted,
    rejectReason: r.reject_reason,
  }));
}
