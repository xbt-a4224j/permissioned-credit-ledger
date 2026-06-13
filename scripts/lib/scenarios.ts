// The 7-row scenario-matrix table (typed outcomes, not strings) · #27/#66
// The CLAUDE.md scenario matrix made executable: each row carries a precise, typed Expected
// outcome — an OK event, a typed on-chain ReasonCode revert, or a typed off-chain EngineState
// HALT — and a `run` that drives the system END TO END: the real GraphQL surface (rows 1-5) or the
// NAV feed / engine (rows 6-7). The verifier asserts deepEqual(actual, expect) per row; a single
// divergence fails the build. (#66 collapsed compliance to verified-only — the old offering /
// accreditation / sanctions-freeze reverts and their actors are gone.)
import type { EngineState, ReasonCode } from "@pcl/shared";
import type { MatrixContext } from "./harness.ts";

// #27 a row's expected outcome: OK + the emitted event, a typed revert ReasonCode (rows 3, 5),
// or a typed engine-state HALT (rows 6-7). Reason codes / engine states are the #14 unions —
// never re-declared as bare strings.
export type Expected =
  | { kind: "ok"; event: "PositionOpened" | "InterestClaimed" }
  | { kind: "revert"; reason: ReasonCode }
  | { kind: "halt"; state: EngineState };

// #27 the verifier compares an Actual against the row's Expected; they share one shape so the
// assertion is a structural deepEqual, not a bespoke per-row predicate.
export type Actual = Expected;

// #27/#66 the canonical seeded actors (mirrors Identities.sol / indexer seed.ts), as a named set so
// a row references an actor by role, not a raw hex literal. Verified-only: 2 verified + 1 unverified.
export type SeededActor = "VERIFIED_1" | "VERIFIED_2" | "UNVERIFIED";

export const ACTORS: Record<SeededActor, `0x${string}`> = {
  VERIFIED_1: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  VERIFIED_2: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  UNVERIFIED: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
};

// #27 one matrix row: its number, name, the actor it exercises, the driver, and the typed Expected.
export interface Scenario {
  row: number;
  name: string;
  actor: SeededActor;
  run: (ctx: MatrixContext) => Promise<Actual>;
  expect: Expected;
}

// #27 the 7 scenarios. Each `run` returns a typed Actual the verifier deepEquals against `expect`.
// Rows 1-2 (OK invest) also wait for the broadcast tx to mine on-chain before passing.
export const SCENARIOS: Scenario[] = [
  {
    row: 1,
    name: "Verified invest (loan 1) — PositionOpened",
    actor: "VERIFIED_2",
    expect: { kind: "ok", event: "PositionOpened" },
    run: (ctx) => ctx.invest("1", ACTORS.VERIFIED_2, "1000000000"),
  },
  {
    row: 2,
    name: "Verified invest (loan 3) — PositionOpened",
    actor: "VERIFIED_2",
    expect: { kind: "ok", event: "PositionOpened" },
    run: (ctx) => ctx.invest("3", ACTORS.VERIFIED_2, "1000000000"),
  },
  {
    row: 3,
    name: "Unverified invest reverts ReceiverNotVerified",
    actor: "UNVERIFIED",
    // The sole compliance gate: a mint to an unverified receiver reverts ReceiverNotVerified.
    expect: { kind: "revert", reason: "ReceiverNotVerified" },
    run: (ctx) => ctx.invest("1", ACTORS.UNVERIFIED, "1000"),
  },
  {
    row: 4,
    name: "Claim with a funded reserve (InterestClaimed, reserve debited)",
    actor: "VERIFIED_1",
    expect: { kind: "ok", event: "InterestClaimed" },
    run: (ctx) => ctx.claimFunded("1", ACTORS.VERIFIED_1),
  },
  {
    row: 5,
    name: "Claim against an underfunded reserve reverts InsufficientReserve",
    actor: "VERIFIED_1",
    expect: { kind: "revert", reason: "InsufficientReserve" },
    run: (ctx) => ctx.claimUnderfunded("1", ACTORS.VERIFIED_1),
  },
  {
    row: 6,
    name: "NAV feed pushes +40% out-of-bounds (HALT NavAnomaly, accrual frozen)",
    actor: "VERIFIED_1",
    expect: { kind: "halt", state: "NavAnomaly" },
    run: (ctx) => ctx.navSpike("1"),
  },
  {
    row: 7,
    name: "Inject cash < claimable (HALT distribution ReconMismatch)",
    actor: "VERIFIED_1",
    expect: { kind: "halt", state: "ReconMismatch" },
    run: (ctx) => ctx.cashMismatch("1", ACTORS.VERIFIED_1),
  },
];

// #27 the typed report the verifier prints + exits on. failures carry the expected-vs-actual diff.
export interface MatrixReport {
  passed: number;
  total: number;
  failures: { row: number; name: string; expected: Expected; actual: Actual }[];
  results: { row: number; name: string; expected: Expected; actual: Actual; ok: boolean }[];
}
