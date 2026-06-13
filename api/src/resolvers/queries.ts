// Query resolvers — read the off-chain read models (no ORM, no chain) · #21
// The six read fields (#20) resolved as raw parameterized SQL against the loans/positions/
// reserve/recon_status/identities read models the indexer (#16) and reconciliation engine (#18)
// populate. Every money column is numeric(78,0) -> a bigint (the #15 client parser) -> a decimal
// string at the GraphQL boundary (the BigIntStr landmine). ratePerSecond comes from the deploy
// manifest (#12). position(s) read the indexer-projected `positions` read model (#66).
import { ratePerSecondFromBps } from "@pcl/shared";
import type { ApiContext } from "../context.ts";
import type { LoanSource } from "../schema/types/loan.ts";
import type { PositionSource } from "../schema/types/position.ts";
import type { ReserveStateSource, ReserveLedgerEntrySource } from "../schema/types/reserve.ts";
import type { ReconciliationStatusSource } from "../schema/types/reconciliation.ts";
import type { NavReadingSource } from "../schema/types/navReading.ts";
import type { ChainEventSource } from "../schema/types/chainEvent.ts";

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
// subscribed = the principal already taken by investors (sum of canonical positions — the
// projection; lags a pending invest by one indexer beat). The marketplace renders
// principal − subscribed as the series' unsubscribed capacity; the authoritative cap stays
// on-chain (mint reverts ExceedsPrincipal past principalCap, #46) — this is display.
export async function resolveLoans(ctx: ApiContext): Promise<LoanSource[]> {
  const frozen = await frozenLoanIds(ctx);
  const rows = await ctx.db<{ id: string; origin_id: string | null; principal: bigint; subscribed: bigint; rate_bps: number; status: string; ltv_bps: number; dscr_bps: number }[]>`
    select l.id, l.origin_id, l.principal::text as principal, l.rate_bps, l.status, l.ltv_bps, l.dscr_bps,
           coalesce(sum(p.principal) filter (where p.principal > 0), 0)::text as subscribed
    from loans l
    left join positions p on p.loan_id = l.id
    group by l.id, l.origin_id, l.principal, l.rate_bps, l.status, l.ltv_bps, l.dscr_bps
    order by l.id::int
  `;
  return rows.map((r) => toLoanSource(r, frozen, ctx.manifest.loans[r.id]));
}

// #66 map a loans row -> the GraphQL Loan source. ratePerSecond falls back to a value computed from
// loans.rate_bps when the loan is absent from the static deploy manifest — i.e. a loan tokenized at
// runtime (#75), whose rate the manifest never learned. Seeded loans keep using the manifest verbatim.
function toLoanSource(
  r: { id: string; origin_id: string | null; principal: bigint; subscribed: bigint; rate_bps: number; status: string; ltv_bps: number; dscr_bps: number },
  frozen: ReadonlySet<string>,
  manifestLoan?: { ratePerSecond: string },
): LoanSource {
  return {
    id: r.id,
    originId: r.origin_id,
    principal: r.principal.toString(),
    subscribed: r.subscribed.toString(),
    ratePerSecond: manifestLoan?.ratePerSecond ?? ratePerSecondFromBps(r.rate_bps).toString(),
    ltvBps: r.ltv_bps,
    dscrBps: r.dscr_bps,
    status: loanStatus(r.status, frozen.has(r.id)),
    dataRoomUri: `ipfs://dataroom/${r.id}`,
  };
}

// #21 one loan by id (null if unknown). Same subscribed aggregation as resolveLoans.
export async function resolveLoan(ctx: ApiContext, id: string): Promise<LoanSource | null> {
  const frozen = await frozenLoanIds(ctx);
  const rows = await ctx.db<{ id: string; origin_id: string | null; principal: bigint; subscribed: bigint; rate_bps: number; status: string; ltv_bps: number; dscr_bps: number }[]>`
    select l.id, l.origin_id, l.principal::text as principal, l.rate_bps, l.status, l.ltv_bps, l.dscr_bps,
           coalesce(sum(p.principal) filter (where p.principal > 0), 0)::text as subscribed
    from loans l
    left join positions p on p.loan_id = l.id
    where l.id = ${id}
    group by l.id, l.origin_id, l.principal, l.rate_bps, l.status, l.ltv_bps, l.dscr_bps
  `;
  const r = rows[0];
  if (r === undefined) return null;
  return toLoanSource(r, frozen, ctx.manifest.loans[r.id]);
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
  };
}

// #21 one holder's position on a loan — the canonical, indexer-projected row (null if none yet).
// Holder is lowercased to match the read model. (#66 dropped the optimistic pre-confirmation row.)
export async function resolvePosition(ctx: ApiContext, holder: string, loanId: string): Promise<PositionSource | null> {
  const h = holder.toLowerCase();
  const rows = await ctx.db<{ id: string; loan_id: string; holder: string; principal: bigint; accrued: bigint; opened_at: bigint | null }[]>`
    select id, loan_id, holder, principal::text as principal, accrued::text as accrued, opened_at
    from positions where holder = ${h} and loan_id = ${loanId} and principal > 0
  `;
  return rows[0] !== undefined ? canonicalPosition(rows[0]) : null;
}

// #21 all of a holder's positions — the canonical (principal > 0) rows from the indexer.
export async function resolvePositions(ctx: ApiContext, holder: string): Promise<PositionSource[]> {
  const h = holder.toLowerCase();
  const rows = await ctx.db<{ id: string; loan_id: string; holder: string; principal: bigint; accrued: bigint; opened_at: bigint | null }[]>`
    select id, loan_id, holder, principal::text as principal, accrued::text as accrued, opened_at
    from positions where holder = ${h} and principal > 0 order by loan_id::int
  `;
  return rows.map(canonicalPosition);
}

// #21 the reserve coverage: the single-row balance + the engine-snapshotted aggregate on-chain
// claimable (#45). NOT sum(positions.accrued) — accrued is event-projected and only moves on
// claims, so it reads 0 forever while interest accrues. The recon cycle (#18) writes
// total_claimable from its live chain snapshot every pass, so this surface (the Servicing
// panel + the demo cash-shortfall trigger) shows the same number I2 evaluates.
export async function resolveReserve(ctx: ApiContext): Promise<ReserveStateSource> {
  const reserveRows = await ctx.db<{ balance: bigint; total_claimable: bigint }[]>`
    select balance::text as balance, total_claimable::text as total_claimable from reserve where id = 1
  `;
  return {
    balance: (reserveRows[0]?.balance ?? 0n).toString(),
    totalClaimable: (reserveRows[0]?.total_claimable ?? 0n).toString(),
  };
}

// #82 the reserve as an append-only ledger — recent entries newest-first (capped at 100). Each
// credit (servicing collection, initial funding) and debit (interest claim, operator report) with
// the running balanceAfter: "every dollar in and out of the reserve." The balance the recon reads is
// kept equal to sum(ledger), so this is the audit trail behind the single coverage figure.
export async function resolveReserveLedger(ctx: ApiContext, limit: number): Promise<ReserveLedgerEntrySource[]> {
  const cap = Math.min(Math.max(1, limit), 100);
  const rows = await ctx.db<{ id: string; entry_type: string; amount: string; reason: string; loan_id: string | null; balance_after: string | null; created_at: Date }[]>`
    select id::text as id, entry_type, amount::text as amount, reason, loan_id, balance_after::text as balance_after, created_at
    from reserve_ledger order by created_at desc, id desc limit ${cap}
  `;
  return rows.map((r) => ({
    id: r.id,
    entryType: r.entry_type,
    amount: r.amount,
    reason: r.reason,
    loanId: r.loan_id,
    balanceAfter: r.balance_after,
    at: r.created_at,
  }));
}

// #21 the latest reconciliation cycle as the GraphQL status (#18 -> #20 shape).
export async function resolveReconciliationStatus(ctx: ApiContext): Promise<ReconciliationStatusSource> {
  return ctx.recon.read();
}

// #39 build a human-readable summary line from a chain_events payload object.
function eventSummary(name: string, payload: Record<string, unknown>): string {
  const loan = payload["loan"] ?? payload["loanId"] ?? "?";
  const short = (addr: unknown): string => typeof addr === "string" ? addr : String(addr ?? "?");
  const amt = (v: unknown): string =>
    typeof v === "string" ? `$${(BigInt(v) / 1_000_000n).toString()}` : "?";
  if (name === "PositionOpened") return `Loan #${loan} · ${short(payload["holder"])} invested ${amt(payload["amount"])}`;
  if (name === "InterestClaimed") return `Loan #${loan} · ${short(payload["holder"])} claimed ${amt(payload["amount"])}`;
  if (name === "Transfer") {
    const from = payload["from"] as string;
    const to = payload["to"] as string;
    const isMint = from === "0x0000000000000000000000000000000000000000";
    if (isMint) return `Loan #${loan} · minted ${amt(payload["amount"])} → ${short(to)}`;
    return `Loan #${loan} · ${short(from)} → ${short(to)} (${amt(payload["amount"])})`;
  }
  // #47 KYC verdict surfaced in the feed: who, and the resulting claim flags.
  if (name === "ClaimsUpdated") {
    const flags = [
      payload["verified"] ? "verified" : "unverified",
      payload["accredited"] ? "accredited" : null,
      payload["frozen"] ? "frozen" : null,
      typeof payload["jurisdiction"] === "string" ? (payload["jurisdiction"] as string) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `KYC · ${short(payload["account"])} → ${flags}`;
  }
  return name;
}

// #39 recent chain events, newest first. limit is clamped to 50 so a caller can't scan the
// full table. payload is jsonb — read as unknown then cast; never interpolated.
export async function resolveChainEvents(ctx: ApiContext, limit: number): Promise<ChainEventSource[]> {
  const cap = Math.min(Math.max(1, limit), 50);
  const rows = await ctx.db<{ id: string; name: string; block_number: bigint; log_index: number; payload: unknown; ingested_at: Date }[]>`
    select id, name, block_number, log_index, payload, ingested_at
    from chain_events order by block_number desc, log_index desc limit ${cap}
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    blockNumber: Number(r.block_number),
    logIndex: r.log_index,
    summary: eventSummary(r.name, (r.payload ?? {}) as Record<string, unknown>),
    ingestedAt: r.ingested_at,
  }));
}

// #39 the live chain head (anvil mines a block every second with --block-time 1), so the Health
// panel's block counter ticks in real time. Reads the node directly, not the indexer cursor (which
// only advances on blocks that carry events). Falls back to the cursor if the RPC hiccups.
// cacheTime: 0 — viem caches getBlockNumber for ~4s by default, which made the head stutter (the
// counter froze for seconds while the chain raced ahead); bypass it so the 1s UI poll reads fresh.
export async function resolveCurrentBlock(ctx: ApiContext): Promise<number> {
  try {
    return Number(await ctx.chain.publicClient.getBlockNumber({ cacheTime: 0 }));
  } catch {
    const rows = await ctx.db<{ block_number: bigint }[]>`select block_number from indexer_cursor where id = 1`;
    return Number(rows[0]?.block_number ?? 0n);
  }
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
