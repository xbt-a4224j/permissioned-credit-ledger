// GraphQL ReserveState type — the mock-USDC reserve · #20
// The off-chain collected-cash mirror claims pay from. recon I2 (#18) requires
// totalClaimable <= balance; surfacing both lets the health panel (#26) show the coverage
// margin. Money fields BigIntStr.
import { builder } from "../builder.ts";

// #20 the resolver-produced ReserveState source (the single-row `reserve` + summed claimable).
export interface ReserveStateSource {
  balance: string;
  totalClaimable: string;
}

export const ReserveState = builder.simpleObject("ReserveState", {
  fields: (t) => ({
    balance: t.field({ type: "BigIntStr", nullable: false }),
    totalClaimable: t.field({ type: "BigIntStr", nullable: false }),
  }),
});
