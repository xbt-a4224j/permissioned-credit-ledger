// Money Layer · GraphQL Mutation root — drive the chain through the HALT gate · #20/#21
// The three write paths. Field signatures frozen here (#20); the resolver bodies (#21) gate on
// the reconciliation status FIRST (a HALTED engine refuses to broadcast — matrix rows 9-10),
// then simulate (surfacing typed custom-error reverts for free — rows 3-6, 8) and write via the
// single server signer, recording the PENDING tx + optimistic position (#23).
import { builder } from "./builder.ts";
import { TxReceiptRef } from "./types/tx.ts";
import { InvestInput, TransferInput, ClaimInput } from "./inputs.ts";
import { resolveInvest, resolveTransfer, resolveClaim } from "../resolvers/mutations.ts";

builder.mutationType({
  fields: (t) => ({
    // #20/#21 invest: mint the loan token to a wallet (PositionOpened). Returns a PENDING ref.
    invest: t.field({
      type: TxReceiptRef,
      nullable: false,
      args: { input: t.arg({ type: InvestInput, required: true }) },
      resolve: (_root, args, ctx) => resolveInvest(ctx, args.input),
    }),
    // #20/#21 transfer: a gauntleted holder-to-holder transfer.
    transfer: t.field({
      type: TxReceiptRef,
      nullable: false,
      args: { input: t.arg({ type: TransferInput, required: true }) },
      resolve: (_root, args, ctx) => resolveTransfer(ctx, args.input),
    }),
    // #20/#21 claim: pay accrued interest from the reserve (gated by the HALT).
    claim: t.field({
      type: TxReceiptRef,
      nullable: false,
      args: { input: t.arg({ type: ClaimInput, required: true }) },
      resolve: (_root, args, ctx) => resolveClaim(ctx, args.input),
    }),
  }),
});
