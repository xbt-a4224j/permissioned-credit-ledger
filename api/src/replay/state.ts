// The Seam · empty replay state · #19
import { unixSeconds, usdc6 } from "@pcl/shared";
import type { ReplayState } from "./types.ts";

// #19 the genesis state every fold starts from: no positions, zero reserve, no NAV, not halted.
export function emptyState(): ReplayState {
  return {
    positions: new Map(),
    reserve: { balance: usdc6(0n), updatedAt: unixSeconds(0) },
    navByLoan: new Map(),
    halted: null,
  };
}
