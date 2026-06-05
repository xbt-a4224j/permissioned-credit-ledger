// Money Layer · NAV feed + validation gate barrel · #17
export { NAV_BOUNDS, withinBounds, type NavRejectReason, type WithinBoundsResult } from "./bounds.ts";
export { ingestNav } from "./gate.ts";
export { isAccrualFrozen, accrualMultiplier } from "./accrualGate.ts";
export { simulateFeed, type FeedScenario } from "./feed.ts";
export type { NavGateResult } from "./types.ts";
