// On-Chain Layer mirror · GraphQL Position type — a holder's stake in a loan · #20
// principal is the token balance; accrued/claimable mirror on-chain interest the recon engine
// (#18) bounds by collected cash. `optimistic` (populated in #23) flags a pre-confirmation,
// indexer-not-yet-caught-up row so the dashboard can show an invest the instant it broadcasts
// and then converge to the canonical row. Money fields BigIntStr.
import { builder } from "../builder.ts";

// #20 the resolver-produced Position source. `optimistic` defaults false for canonical rows
// (the indexer-projected `positions`), true for synthesized optimistic rows (#23).
export interface PositionSource {
  id: string;
  holder: string;
  loanId: string;
  principal: string;
  accrued: string;
  claimable: string;
  lastAccrualAt: Date;
  optimistic: boolean;
}

export const Position = builder.simpleObject("Position", {
  fields: (t) => ({
    id: t.id({ nullable: false }),
    holder: t.field({ type: "Address", nullable: false }),
    loanId: t.id({ nullable: false }),
    principal: t.field({ type: "BigIntStr", nullable: false }),
    accrued: t.field({ type: "BigIntStr", nullable: false }),
    claimable: t.field({ type: "BigIntStr", nullable: false }),
    lastAccrualAt: t.field({ type: "DateTime", nullable: false }),
    optimistic: t.boolean({ nullable: false }),
  }),
});
