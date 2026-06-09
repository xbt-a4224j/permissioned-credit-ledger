// The CRE/RESIDENTIAL seam, derived from the seed · #24
// The mortgage-general seam (CLAUDE.md): the platform is seeded CRE-first (5 CRE + 1 RESIDENTIAL)
// so residential plugs into identical rails. The GraphQL Loan shape (#20) does not yet carry
// collateralType (it is a named-but-cut extension point), so the marketplace derives the badge from
// the deterministic seed: loan #6 is the lone RESIDENTIAL, #1-#5 are CRE. When the field lands in
// the schema, this single function is the only thing that changes.
import type { CollateralType, LoanId } from "../types.ts";

// #24 the seeded residential loan id (the 6th loan; #1-#5 are CRE). Single source so the seam is
// one constant, not scattered string checks.
const RESIDENTIAL_LOAN_IDS = new Set<string>(["6"]);

export function collateralTypeFor(id: LoanId): CollateralType {
  return RESIDENTIAL_LOAN_IDS.has(id) ? "RESIDENTIAL" : "CRE";
}
