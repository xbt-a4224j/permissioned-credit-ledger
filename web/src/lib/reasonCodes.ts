// The typed reason-code bridge — never stringly · #25
// The 8-member closed set == the GraphQL ReasonCode enum (#20), which itself mirrors the 6 Solidity
// custom errors (the eligibility gauntlet + reserve, #14) plus the 2 off-chain engine HALT states
// (#17/#18). The UI renders a typed ReasonBadge keyed off REASON_META; it NEVER renders a raw error
// string. `tone: 'block'` = an on-chain eligibility/reserve revert (rows 3-6,8); `tone: 'halt'` =
// an engine HALT (rows 9-10). reasonCodes.test.ts pins this set equal to the #20 SDL enum snapshot
// (api/schema.graphql) so a renamed code fails the build rather than silently mis-rendering.

export type ReasonCode =
  | "SenderFrozen"
  | "NotEligible"
  | "ReceiverFrozen"
  | "ReceiverNotVerified"
  | "AccreditationRequired"
  | "InsufficientReserve"
  | "NavAnomaly"
  | "ReconMismatch";

// #25 the closed set, for exhaustiveness checks and the SDL-enum drift guard.
export const REASON_CODES: readonly ReasonCode[] = [
  "SenderFrozen",
  "NotEligible",
  "ReceiverFrozen",
  "ReceiverNotVerified",
  "AccreditationRequired",
  "InsufficientReserve",
  "NavAnomaly",
  "ReconMismatch",
] as const;

// #25 single-sourced copy for every code: a short label + an explanatory blurb + the tone the
// Badge/Banner primitives color by. `block` = compliance/reserve revert; `halt` = engine HALT.
export const REASON_META: Record<ReasonCode, { label: string; blurb: string; tone: "block" | "halt" }> = {
  SenderFrozen: {
    label: "Sender frozen",
    blurb: "The sending identity is frozen in the IdentityRegistry; a frozen holder cannot initiate any outbound transfer.",
    tone: "block",
  },
  NotEligible: {
    label: "Not eligible",
    blurb: "The transfer failed the compliance gauntlet — the holder is not eligible to hold this loan series.",
    tone: "block",
  },
  ReceiverFrozen: {
    label: "Receiver frozen",
    blurb: "The receiving identity is frozen in the IdentityRegistry; the transfer is blocked.",
    tone: "block",
  },
  ReceiverNotVerified: {
    label: "Receiver not verified",
    blurb: "The receiving wallet has no verified identity claim; transfers to it are blocked.",
    tone: "block",
  },
  AccreditationRequired: {
    label: "Accreditation required",
    blurb: "This Reg-D series requires an accredited US holder; the receiver is not accredited.",
    tone: "block",
  },
  InsufficientReserve: {
    label: "Insufficient reserve",
    blurb: "The mock reserve cannot cover this claim; accrued interest is left intact.",
    tone: "block",
  },
  NavAnomaly: {
    label: "NAV anomaly — HALTED",
    blurb: "An out-of-bounds NAV mark tripped the validation gate. Accrual is frozen until reconciliation clears.",
    tone: "halt",
  },
  ReconMismatch: {
    label: "Recon mismatch — HALTED",
    blurb: "Off-chain servicing cash does not equal on-chain claimable. Distribution is halted by the engine.",
    tone: "halt",
  },
};

// #25 the typed narrowing guard: only a known code passes (an unknown string is rejected so a
// stale/garbage `extensions.code` can never become a rendered badge).
export function isReasonCode(x: string): x is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(x);
}

// #26 the two halt-tone codes — the engine HALT states the recon panel raises (rows 9-10).
export type HaltCode = "NavAnomaly" | "ReconMismatch";

// #26 narrow a ReasonCode to a HaltCode (the recon stream's haltCode).
export function isHaltCode(code: ReasonCode): code is HaltCode {
  return code === "NavAnomaly" || code === "ReconMismatch";
}
