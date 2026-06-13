// GraphQL TxReceiptRef — the mutation return + tx lifecycle · #20/#23
// The union-free shape invest/transfer/claim return (#21) and txStatus(hash) reads (#23):
// the broadcast hash, the PENDING->CONFIRMED|REVERTED state, a typed reasonCode on revert, and the
// settling block. (#66 dropped the optimistic Position that used to ride along — the dashboard now
// reads the canonical position from the indexer once it lands, a block + an index cycle later.)
import { builder } from "../builder.ts";
import { ReasonCode, TxState, type ReasonCodeValue } from "../enums.ts";

// #20/#23 the resolver-produced TxReceiptRef source. `reasonCode`/`blockNumber` fill once the tx
// settles (#23).
export interface TxReceiptRefSource {
  hash: string;
  state: "PENDING" | "CONFIRMED" | "REVERTED";
  reasonCode: ReasonCodeValue | null;
  blockNumber: string | null;
}

export const TxReceiptRef = builder.simpleObject("TxReceiptRef", {
  fields: (t) => ({
    hash: t.string({ nullable: false }),
    state: t.field({ type: TxState, nullable: false }),
    reasonCode: t.field({ type: ReasonCode, nullable: true }),
    blockNumber: t.field({ type: "BigIntStr", nullable: true }),
  }),
});
