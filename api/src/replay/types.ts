// The Seam · deterministic replay types · #19
// A reconciliation gate is only trustworthy if the state it reconciles is itself deterministic.
// ReplayState is the in-memory fold of the append-only inputs (chain_events + nav_readings);
// ReplayInput is one such input. The fold is PURE and order-independent over interleavings — the
// canonical order is (blockNumber, logIndex) for chain, (observedAt, id) for nav — so any
// arrival order reduces to one ReplayState and one stateHash (the headline property).
import type { ChainEvent, EngineState, IdentityAddr, LoanId, NavReading, PositionId, ReserveState, Usdc6, UnixSeconds } from "@pcl/shared";
import type { InvariantId } from "../recon/types.ts";

// #19 a replayed position (the in-memory mirror of a positions row).
export interface ReplayPosition {
  loan: LoanId;
  holder: IdentityAddr;
  principal: Usdc6;
  accrued: Usdc6;
  openedAt: UnixSeconds | null;
}

// #19 the folded state. positions keyed by PositionId; navByLoan holds the last ACCEPTED mark;
// halted is set the moment a NAV mark is rejected (NavAnomaly) — replay reproduces HALTs too.
export interface ReplayState {
  positions: Map<PositionId, ReplayPosition>;
  reserve: ReserveState;
  navByLoan: Map<LoanId, NavReading>;
  halted: { state: EngineState; failed?: InvariantId } | null;
}

// #19 one totally-ordered input: a chain event or a NAV reading.
export type ReplayInput = { kind: "chain"; event: ChainEvent } | { kind: "nav"; reading: NavReading };
