// The pure replay reducer · #19
// applyInput folds ONE ordered input into ReplayState, reusing the SAME math as the live system:
// the indexer projectors' balance model (#16) for chain events and the NAV withinBounds gate
// (#17) for marks — so replay and live can't diverge. It is a pure function: state in, state out,
// NO wall-clock and NO RNG (the deterministic `now` is injected). That purity is what makes the
// interleaving property hold; a Date.now() here would silently break it only in CI.
import { identityAddr, positionId, unixSeconds, usdc6, type ChainEvent, type IdentityAddr, type NavReading, type UnixSeconds } from "@pcl/shared";
import { withinBounds } from "../nav/bounds.ts";
import type { ReplayInput, ReplayPosition, ReplayState } from "./types.ts";

// #19 the ERC20 mint source / burn sink sentinel, branded for comparison against event addrs.
const ZERO: IdentityAddr = identityAddr("0x0000000000000000000000000000000000000000");

// #19 clone-on-write helpers keep applyInput pure (never mutate the input state).
function cloneState(s: ReplayState): ReplayState {
  return {
    positions: new Map([...s.positions].map(([k, v]) => [k, { ...v }])),
    reserve: { ...s.reserve },
    navByLoan: new Map(s.navByLoan),
    halted: s.halted ? { ...s.halted } : null,
  };
}

function ensurePosition(s: ReplayState, loan: ReplayPosition["loan"], holder: IdentityAddr): ReplayPosition {
  const id = positionId(loan, holder);
  let p = s.positions.get(id);
  if (p === undefined) {
    p = { loan, holder, principal: usdc6(0n), accrued: usdc6(0n), openedAt: null };
    s.positions.set(id, p);
  }
  return p;
}

// #19 chain-event fold — mirrors project.ts: Transfer is the balance source of truth (mint =
// 0x0 credit, burn = 0x0 debit), PositionOpened stamps opened_at, InterestClaimed debits the
// reserve + resets accrued, LoanStatusChanged is carried (status drives nothing in the balance
// fold here — accrual freeze is the NAV gate's job).
function applyChain(next: ReplayState, ev: ChainEvent): void {
  switch (ev.name) {
    case "PositionOpened": {
      const p = ensurePosition(next, ev.loan, ev.holder);
      if (p.openedAt === null) p.openedAt = unixSeconds(Number(ev.blockNumber));
      break;
    }
    case "Transfer": {
      if (ev.from !== ZERO) {
        const from = ensurePosition(next, ev.loan, ev.from);
        from.principal = (from.principal - ev.amount) as typeof from.principal;
      }
      if (ev.to !== ZERO) {
        const to = ensurePosition(next, ev.loan, ev.to);
        to.principal = (to.principal + ev.amount) as typeof to.principal;
      }
      break;
    }
    case "InterestClaimed": {
      next.reserve.balance = (next.reserve.balance - ev.amount) as typeof next.reserve.balance;
      next.reserve.updatedAt = unixSeconds(Number(ev.blockNumber));
      const id = positionId(ev.loan, ev.holder);
      const p = next.positions.get(id);
      if (p !== undefined) p.accrued = usdc6(0n);
      break;
    }
    case "LoanStatusChanged":
      // status transition: no balance effect in the replay fold (kept for completeness).
      break;
  }
}

// #19 NAV fold — run the SAME bounds gate as live. Accept -> advance navByLoan; reject -> record
// the NavAnomaly halt (replay reproduces the row-9 HALT). `now` is the deterministic replay clock.
function applyNav(next: ReplayState, reading: NavReading, now: UnixSeconds): void {
  const prev = next.navByLoan.get(reading.loan) ?? null;
  const verdict = withinBounds(prev, reading, now, true);
  if (verdict.ok) {
    next.navByLoan.set(reading.loan, reading);
  } else if (next.halted === null) {
    next.halted = { state: "NavAnomaly", failed: "NavInBounds" };
  }
}

// #19 the pure single-step reducer. `now` is the injected deterministic clock (max observedAt
// across the input set), threaded by replay() so it's identical for every interleaving.
export function applyInput(s: ReplayState, input: ReplayInput, now: UnixSeconds): ReplayState {
  const next = cloneState(s);
  if (input.kind === "chain") applyChain(next, input.event);
  else applyNav(next, input.reading, now);
  return next;
}

// #19 canonical total order over inputs. chain: (blockNumber, logIndex); nav: (observedAt,
// source) — distinct keyspaces are separated by a kind tag so chain always precedes nav at the
// same numeric position deterministically. Any input SET has exactly one fold order.
export function orderKey(input: ReplayInput): string {
  if (input.kind === "chain") {
    const bn = input.event.blockNumber.toString().padStart(20, "0");
    const li = String(input.event.logIndex).padStart(10, "0");
    return `0:${bn}:${li}`;
  }
  const oa = String(input.reading.observedAt).padStart(20, "0");
  return `1:${oa}:${input.reading.source}:${input.reading.navBps}`;
}
