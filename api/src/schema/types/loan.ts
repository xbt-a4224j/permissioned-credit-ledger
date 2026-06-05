// Asset Layer · GraphQL Loan type — a first-lien mortgage on a Property · #20
// The loan-tape read shape the marketplace (#24) renders: principal + ratePerSecond drive
// on-chain accrual; ltvBps/dscrBps/dataRoomUri are the mortgage modeling (CRE-first, the
// residential seam). Money fields are BigIntStr — never a JS number. SimpleObject: resolved
// straight from the `loans` read model in #21, no per-field resolver.
import { builder } from "../builder.ts";
import { LoanStatus } from "../enums.ts";

// #20 the resolver-produced Loan source (the `loans` row, money as decimal strings).
export interface LoanSource {
  id: string;
  principal: string;
  ratePerSecond: string;
  ltvBps: number;
  dscrBps: number;
  status: "Active" | "Frozen" | "Matured";
  dataRoomUri: string | null;
}

export const Loan = builder.simpleObject("Loan", {
  fields: (t) => ({
    id: t.id({ nullable: false }),
    principal: t.field({ type: "BigIntStr", nullable: false }),
    ratePerSecond: t.field({ type: "BigIntStr", nullable: false }),
    ltvBps: t.int({ nullable: false }),
    dscrBps: t.int({ nullable: false }),
    status: t.field({ type: LoanStatus, nullable: false }),
    dataRoomUri: t.string({ nullable: true }),
  }),
});
