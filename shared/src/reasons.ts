// Asset Layer · typed reason taxonomy — Solidity custom errors mirrored as a TS union · #14
// Correctness is typed, not stringly: the 5 reason codes mirror the 5 on-chain custom
// errors (ComplianceRegistry gauntlet + CreditToken reserve), and the 2 engine states have
// no on-chain analog — they are the off-chain HALTs the NAV gate (#17) and recon engine
// (#18) raise. An exhaustive switch over DomainError['kind'] with no `default` compiles,
// proving union closure.

// #14 the 6 reason codes == the 6 Solidity custom errors (matrix rows 3-6, 8, + sender-freeze).
export type ReasonCode =
  | "SenderFrozen"
  | "NotEligible"
  | "ReceiverFrozen"
  | "ReceiverNotVerified"
  | "AccreditationRequired"
  | "InsufficientReserve";

// #14 engine-only HALT states (no Solidity analog): row 9 NAV spike, row 10 cash shortfall.
export type EngineState = "NavAnomaly" | "ReconMismatch";

// #14 discriminated union: a single `kind` discriminant spans on-chain revert reasons and
// off-chain engine HALTs so every failure in the system has one machine-checkable code.
export type DomainError =
  | { kind: ReasonCode; account?: IdentityAddr; detail?: string }
  | { kind: EngineState; failed?: string; detail?: string };

import type { IdentityAddr } from "./brand.ts";

// #14 the 4-byte selector -> ReasonCode map. Selectors are filled by the indexer/API
// mapper (#21) from the imported ABI; declared here as the single source so a stale
// selector can't silently turn a typed revert opaque (the ABI-drift landmine).
export const SOLIDITY_ERROR_SELECTORS: Record<`0x${string}`, ReasonCode> = {};

// #14 the full closed set, for exhaustiveness tests and the API error enum.
export const REASON_CODES: readonly ReasonCode[] = [
  "SenderFrozen",
  "NotEligible",
  "ReceiverFrozen",
  "ReceiverNotVerified",
  "AccreditationRequired",
  "InsufficientReserve",
] as const;

export const ENGINE_STATES: readonly EngineState[] = ["NavAnomaly", "ReconMismatch"] as const;

// #14 exhaustive narrowing helper: `assertNever` makes a missing union arm a compile error
// at every switch (proves closure; used in the schema/test exhaustiveness check).
export function assertNever(x: never): never {
  throw new Error(`unexpected variant: ${JSON.stringify(x)}`);
}
