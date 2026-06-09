// The 10-row scenario-matrix table (typed outcomes, not strings) · #27
// The CLAUDE.md scenario matrix made executable: each row carries a precise, typed Expected
// outcome — an OK event, a typed on-chain ReasonCode revert, or a typed off-chain EngineState
// HALT — and a `run` that drives the system END TO END: the real GraphQL surface (rows 1-3, 5-8),
// a holder-simulated eth_call against the contract (row 4), or the NAV feed / engine (rows 9-10).
// The verifier asserts deepEqual(actual, expect) per row; a single divergence fails the build.
import type { EngineState, ReasonCode } from "@pcl/shared";
import type { MatrixContext } from "./harness.ts";

// #27 a row's expected outcome: OK + the emitted event, a typed revert ReasonCode (rows 3-6, 8),
// or a typed engine-state HALT (rows 9-10). Reason codes / engine states are the #14 unions —
// never re-declared as bare strings.
export type Expected =
  | { kind: "ok"; event: "PositionOpened" | "InterestClaimed" }
  | { kind: "revert"; reason: ReasonCode }
  | { kind: "halt"; state: EngineState };

// #27 the verifier compares an Actual against the row's Expected; they share one shape so the
// assertion is a structural deepEqual, not a bespoke per-row predicate.
export type Actual = Expected;

// #27 the canonical seeded actors (mirrors Identities.sol / indexer seed.ts), as a named set so a
// row references an actor by role, not a raw hex literal.
export type SeededActor =
  | "ACCREDITED_US_1"
  | "ACCREDITED_US_2"
  | "REG_S_NONUS_1"
  | "REG_S_NONUS_2"
  | "UNVERIFIED"
  | "FROZEN";

export const ACTORS: Record<SeededActor, `0x${string}`> = {
  ACCREDITED_US_1: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  ACCREDITED_US_2: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  REG_S_NONUS_1: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
  REG_S_NONUS_2: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
  UNVERIFIED: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
  FROZEN: "0x976ea74026e726554db657fa54763abd0c3a0aa9",
};

// #27 one matrix row: its number, name, the actor it exercises, the driver, and the typed Expected.
export interface Scenario {
  row: number;
  name: string;
  actor: SeededActor;
  run: (ctx: MatrixContext) => Promise<Actual>;
  expect: Expected;
}

// #27 the 10 scenarios. Each `run` returns a typed Actual the verifier deepEquals against `expect`.
// Rows 1-2 (OK invest) also wait for the broadcast tx to mine on-chain before passing.
export const SCENARIOS: Scenario[] = [
  {
    row: 1,
    name: "Accredited-US invest (RegD loan 1)",
    actor: "ACCREDITED_US_2",
    expect: { kind: "ok", event: "PositionOpened" },
    run: (ctx) => ctx.invest("1", ACTORS.ACCREDITED_US_2, "1000000000"),
  },
  {
    row: 2,
    name: "Reg-S non-US invest (RegS loan 3)",
    actor: "REG_S_NONUS_2",
    expect: { kind: "ok", event: "PositionOpened" },
    run: (ctx) => ctx.invest("3", ACTORS.REG_S_NONUS_2, "1000000000"),
  },
  {
    row: 3,
    name: "Unverified invest reverts ReceiverNotVerified",
    actor: "UNVERIFIED",
    // Gauntlet order: sender-freeze (step 0) -> receiver-freeze (step 1) -> VERIFIED (step 2)
    // -> eligible -> offering-rule. An unregistered (unverified) receiver trips step 2 first.
    expect: { kind: "revert", reason: "ReceiverNotVerified" },
    run: (ctx) => ctx.invest("1", ACTORS.UNVERIFIED, "1000"),
  },
  {
    row: 4,
    name: "Frozen holder initiates transfer reverts SenderFrozen",
    actor: "FROZEN",
    // Gauntlet step 0: a frozen SENDER cannot initiate any outbound transfer regardless of
    // the receiver. Freeze = complete lockout (can't send AND can't receive). Driven via
    // transferAs (eth_call simulated AS the frozen holder): the API's single server signer
    // can only originate issuer-sent transfers, so the sender-side branch is proven directly
    // against the contract — the same drive-the-mechanism pattern rows 9-10 use.
    expect: { kind: "revert", reason: "SenderFrozen" },
    run: (ctx) => ctx.transferAs("1", ACTORS.FROZEN, ACTORS.ACCREDITED_US_1, "1000"),
  },
  {
    row: 5,
    name: "US holder on a Reg-S offering reverts NotEligible (offering mismatch)",
    actor: "ACCREDITED_US_2",
    // The canonical NotEligible: the Reg-S gauntlet branch reverts NotEligible for a US holder (a
    // US holder is "not eligible" for a Reg-S offering, not "un-verified"). loan 3 is the Reg-S
    // token. This is the only on-chain source of a bare NotEligible in the seeded world.
    expect: { kind: "revert", reason: "NotEligible" },
    run: (ctx) => ctx.transfer("3", ACTORS.REG_S_NONUS_1, ACTORS.ACCREDITED_US_2, "1000"),
  },
  {
    row: 6,
    name: "US non-accredited holder on a Reg-D token reverts AccreditationRequired",
    actor: "ACCREDITED_US_2",
    // CLAUDE.md row 6 exactly: a verified, US, NON-accredited receiver on a Reg-D loan trips the
    // accreditation branch. The seeded world has no non-accredited actor, so the harness seeds one
    // ON-CHAIN via the issuer (setClaims), then transfers a Reg-D token to it -> AccreditationRequired.
    expect: { kind: "revert", reason: "AccreditationRequired" },
    run: (ctx) => ctx.transferToNonAccredited("1"),
  },
  {
    row: 7,
    name: "Claim with a funded reserve (InterestClaimed, reserve debited)",
    actor: "ACCREDITED_US_1",
    expect: { kind: "ok", event: "InterestClaimed" },
    run: (ctx) => ctx.claimFunded("1", ACTORS.ACCREDITED_US_1),
  },
  {
    row: 8,
    name: "Claim against an underfunded reserve reverts InsufficientReserve",
    actor: "ACCREDITED_US_1",
    expect: { kind: "revert", reason: "InsufficientReserve" },
    run: (ctx) => ctx.claimUnderfunded("1", ACTORS.ACCREDITED_US_1),
  },
  {
    row: 9,
    name: "NAV feed pushes +40% out-of-bounds (HALT NavAnomaly, accrual frozen)",
    actor: "ACCREDITED_US_1",
    expect: { kind: "halt", state: "NavAnomaly" },
    run: (ctx) => ctx.navSpike("1"),
  },
  {
    row: 10,
    name: "Inject cash < claimable (HALT distribution ReconMismatch)",
    actor: "ACCREDITED_US_1",
    expect: { kind: "halt", state: "ReconMismatch" },
    run: (ctx) => ctx.cashMismatch("1", ACTORS.ACCREDITED_US_1),
  },
];

// #27 the typed report the verifier prints + exits on. failures carry the expected-vs-actual diff.
export interface MatrixReport {
  passed: number;
  total: number;
  failures: { row: number; name: string; expected: Expected; actual: Actual }[];
  results: { row: number; name: string; expected: Expected; actual: Actual; ok: boolean }[];
}
