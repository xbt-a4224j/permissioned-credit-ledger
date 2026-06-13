// #66 TokenizeResult — what the tokenizeLoan mutation returns: the new on-chain loan id, its
// deployed CreditToken address, and the deploy tx hash.
import { builder } from "../builder.ts";

export const TokenizeResult = builder.simpleObject("TokenizeResult", {
  fields: (t) => ({
    loanId: t.id({ nullable: false }),
    tokenAddress: t.string({ nullable: false }),
    txHash: t.string({ nullable: false }),
  }),
});
