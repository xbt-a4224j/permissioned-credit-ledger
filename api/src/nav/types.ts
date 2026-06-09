// NAV gate result types · #17
import type { NavReading } from "@pcl/shared";
import type { NavRejectReason } from "./bounds.ts";

// #17 discriminated result of ingesting one NAV mark: accepted readings flow into the feed;
// rejected ones flip engine state to NavAnomaly and freeze accrual (matrix row 9).
export type NavGateResult =
  | { accepted: true; reading: NavReading }
  | { accepted: false; state: "NavAnomaly"; reason: NavRejectReason };

export type { NavRejectReason } from "./bounds.ts";
