// Money Layer · GraphQL TxReceiptRef — the mutation return + tx lifecycle · #20/#23
// The union-free shape invest/transfer/claim return (#21) and txStatus(hash) reads (#23):
// the broadcast hash, the PENDING->CONFIRMED|REVERTED state, a typed reasonCode on revert, the
// settling block, and the optimistic Position the dashboard shows before the indexer catches up.
import { builder } from "../builder.ts";
import { Position } from "./position.ts";
import { ReasonCode, TxState, type ReasonCodeValue } from "../enums.ts";

// #20/#23 the resolver-produced TxReceiptRef source. `position` is the optimistic row for an
// invest (null for transfer/claim); `reasonCode`/`blockNumber` fill once the tx settles (#23).
export interface TxReceiptRefSource {
  hash: string;
  state: "PENDING" | "CONFIRMED" | "REVERTED";
  reasonCode: ReasonCodeValue | null;
  blockNumber: string | null;
  position: import("./position.ts").PositionSource | null;
}

export const TxReceiptRef = builder.simpleObject("TxReceiptRef", {
  fields: (t) => ({
    hash: t.string({ nullable: false }),
    state: t.field({ type: TxState, nullable: false }),
    reasonCode: t.field({ type: ReasonCode, nullable: true }),
    blockNumber: t.field({ type: "BigIntStr", nullable: true }),
    position: t.field({ type: Position, nullable: true }),
  }),
});
