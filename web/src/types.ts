// UI view-model types over the GraphQL read shape · #24
// The UI speaks the same branded money/identifier vocabulary as the off-chain layers (#14): money
// is a bigint base unit (decoded from the BigIntStr wire scalar), ids are branded strings. These
// view models mirror the committed GraphQL SDL (#20) exactly — `LoanStatus` is the on-chain
// Active|Frozen|Matured enum, Loan carries the mortgage modeling (ltvBps/dscrBps/collateralType).
// Money is never coerced through a JS number; BigIntStr -> bigint at the client boundary only.
import type { IdentityAddr, LoanId, PositionId } from "@pcl/shared";

export type { IdentityAddr, LoanId, PositionId };

// #24 the on-chain loan-series display status (mirrors CreditToken.LoanStatus via the API enum).
// `Frozen` is the row-9 NavAnomaly freeze surface; the accrual ticker stops on it.
export type LoanStatus = "Active" | "Frozen" | "Matured";

// #24 the mortgage-general seam made visible in the marketplace: CRE-first, residential plugs in.
export type CollateralType = "CRE" | "RESIDENTIAL";

// #24 a marketplace Loan: a first-lien mortgage on a Property. Money fields are bigint base units.
// subscribed = principal already taken by investors; principal − subscribed = unsubscribed capacity.
export interface Loan {
  id: LoanId;
  principal: bigint;
  subscribed: bigint;
  ratePerSecond: bigint;
  ltvBps: number;
  dscrBps: number;
  status: LoanStatus;
  collateralType: CollateralType;
  dataRoomUri: string | null;
}

// #24 a holder Position: principal is the token balance; accrued/claimable mirror on-chain
// interest the recon engine (#18) bounds. `optimistic` flags a pre-confirmation row (#23).
export interface Position {
  id: PositionId;
  holder: IdentityAddr;
  loanId: LoanId;
  principal: bigint;
  accrued: bigint;
  claimable: bigint;
  optimistic: boolean;
}
