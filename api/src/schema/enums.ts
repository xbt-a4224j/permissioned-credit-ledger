// Money Layer · typed GraphQL enums — reason codes + lifecycle states · #20
// Correctness is typed, not stringly: ReasonCode is the 7-member closed set (the 5 Solidity
// custom errors mirrored in #14 + the 2 off-chain engine HALTs, #17/#18) the API surfaces as
// extensions.code rather than opaque RPC strings. ReconState/LoanStatus/Jurisdiction/TxState are
// the small closed enums the read layer and tx tracker (#23) project the read models onto.
import { REASON_CODES, ENGINE_STATES } from "@pcl/shared";
import { builder } from "./builder.ts";

// #20 the 7 reason codes (5 on-chain reverts + 2 engine HALTs). Built from the @pcl/shared
// single source so a renamed code can't drift between the contract layer and the API.
export const REASON_CODE_VALUES = [...REASON_CODES, ...ENGINE_STATES] as const;

// #20 the TS union the GraphQL ReasonCode enum exposes (the 7 codes). Source types that carry a
// reason code (TxReceiptRef.reasonCode, ReconciliationStatus.haltReason) use this so the resolver
// return shape matches the enum exactly under strict typing.
export type ReasonCodeValue = (typeof REASON_CODE_VALUES)[number];

export const ReasonCode = builder.enumType("ReasonCode", {
  values: REASON_CODE_VALUES,
  description: "The 5 on-chain custom errors + 2 off-chain engine HALT states, as one typed code.",
});

// #20 reconciliation verdict: OK keeps distribution open, HALTED blocks it (the marquee gate).
export const ReconState = builder.enumType("ReconState", {
  values: ["OK", "HALTED"] as const,
});

// #20 loan-series display status (mirrors the on-chain LoanStatus enum semantics for the UI).
export const LoanStatus = builder.enumType("LoanStatus", {
  values: ["Active", "Frozen", "Matured"] as const,
});

// #20 jurisdiction mirrors IdentityRegistry.Jurisdiction (US / non-US gating).
export const Jurisdiction = builder.enumType("Jurisdiction", {
  values: ["US", "NonUS"] as const,
});

// #20/#23 tx lifecycle: PENDING on broadcast, then CONFIRMED or REVERTED once mined.
export const TxState = builder.enumType("TxState", {
  values: ["PENDING", "CONFIRMED", "REVERTED"] as const,
});
