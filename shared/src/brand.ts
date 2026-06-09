// Branded domain scalars + validating smart constructors · #14
// Nominal types so an on-chain `claimable` and an off-chain `collected` are the same
// `Usdc6` and never two loose bigints — the precondition the recon invariants (#18) and
// the replay hash (#19) compare against. Money is 6-decimal fixed-point base units
// (matches the CreditToken/MockUSDC 6dp), bps is integer basis points.

export type Brand<K, T> = K & { readonly __brand: T };

// #14 canonical identifiers. EventId is the indexer's idempotency key (#16) and the
// replay ordering tiebreak (#19): `${txHash}:${logIndex}`.
export type LoanId = Brand<string, "LoanId">;
export type IdentityAddr = Brand<`0x${string}`, "IdentityAddr">;
export type PositionId = Brand<string, "PositionId">;
export type PropertyId = Brand<string, "PropertyId">;
export type EventId = Brand<string, "EventId">;

// #14 money + ratios. Usdc6: 6-decimal fixed-point as bigint base units (uint256-wide).
export type Usdc6 = Brand<bigint, "Usdc6">;
export type Bps = Brand<number, "Bps">;
export type UnixSeconds = Brand<number, "UnixSeconds">;

// #14 loanId: a positive integer string (loans are keyed by uint256 loanId in the manifest).
export function loanId(raw: string | number | bigint): LoanId {
  const s = typeof raw === "string" ? raw : raw.toString();
  if (!/^\d+$/.test(s)) throw new Error(`invalid LoanId: ${s}`);
  return s as LoanId;
}

// #14 positionId: canonical `${loanId}:${holder}` so the (loan, holder) uniqueness in
// the DB (#15) and the replay state map (#19) share one key.
export function positionId(loan: LoanId, holder: IdentityAddr): PositionId {
  return `${loan}:${holder.toLowerCase()}` as PositionId;
}

// #14 propertyId: a positive integer string (one property per loan in the seed).
export function propertyId(raw: string | number): PropertyId {
  const s = typeof raw === "string" ? raw : raw.toString();
  if (!/^\d+$/.test(s)) throw new Error(`invalid PropertyId: ${s}`);
  return s as PropertyId;
}

// #14 identityAddr: a checksum-agnostic 20-byte hex address, lowercased so map keys and
// DB joins (#15) never split on case. The recon I4 holder check (#18) relies on this.
export function identityAddr(raw: string): IdentityAddr {
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) throw new Error(`invalid IdentityAddr: ${raw}`);
  return raw.toLowerCase() as IdentityAddr;
}

// #14 eventId: deterministic + injective over (txHash, logIndex). The injectivity is a
// fast-check property because the indexer (#16) dedupes and replay (#19) orders by it.
export function eventId(txHash: string, logIndex: number): EventId {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error(`invalid txHash: ${txHash}`);
  if (!Number.isInteger(logIndex) || logIndex < 0) throw new Error(`invalid logIndex: ${logIndex}`);
  return `${txHash.toLowerCase()}:${logIndex}` as EventId;
}

// #14 usdc6: validate-and-brand a non-negative integer base-unit amount. Accepts a
// decimal-free string (the DB numeric(78,0) shape, #15) or a bigint.
export function usdc6(raw: bigint | number | string): Usdc6 {
  let v: bigint;
  if (typeof raw === "bigint") v = raw;
  else if (typeof raw === "number") {
    if (!Number.isInteger(raw)) throw new Error(`Usdc6 must be an integer: ${raw}`);
    v = BigInt(raw);
  } else {
    if (!/^-?\d+$/.test(raw)) throw new Error(`invalid Usdc6 string: ${raw}`);
    v = BigInt(raw);
  }
  if (v < 0n) throw new Error(`Usdc6 must be non-negative: ${v}`);
  return v as Usdc6;
}

// #14 bps: integer basis points in [0, 1_000_000] (0%..10000%); NAV marks/LTV/DSCR.
export function bps(raw: number): Bps {
  if (!Number.isInteger(raw) || raw < 0 || raw > 1_000_000) throw new Error(`invalid Bps: ${raw}`);
  return raw as Bps;
}

// #14 unixSeconds: integer epoch seconds; clamps the staleness clock the NAV gate (#17)
// and replay (#19) inject so time is deterministic, never Date.now().
export function unixSeconds(raw: number): UnixSeconds {
  if (!Number.isInteger(raw) || raw < 0) throw new Error(`invalid UnixSeconds: ${raw}`);
  return raw as UnixSeconds;
}

// #14 LANDMINE guard (see ticket notes): never JSON.stringify a Usdc6/bigint — it
// silently coerces to number and loses precision above 2^53, surfacing as a phantom
// ReconMismatch (#18). Every boundary (DB, GraphQL, SSE, hash) goes through these.
export function usdc6ToString(v: Usdc6): string {
  return v.toString();
}

export function usdc6FromString(s: string): Usdc6 {
  return usdc6(s);
}

// #14 add two Usdc6 staying branded (accrual folds in the replay reducer, #19).
export function usdc6Add(a: Usdc6, b: Usdc6): Usdc6 {
  return (a + b) as Usdc6;
}
