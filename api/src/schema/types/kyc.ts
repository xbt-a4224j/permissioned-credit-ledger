// GraphQL KYC types — status + verdict · #39
import { builder } from "../builder.ts";
import type { KycStatusView, KycResultView } from "../../kyc/resolve.ts";

// #39 a wallet's current on-chain claims (the gauntlet's source of truth) — drives the UI badge.
export const KycStatus = builder.simpleObject("KycStatus", {
  fields: (t) => ({
    verified: t.boolean({ nullable: false }),
    accredited: t.boolean({ nullable: false }),
    jurisdiction: t.string({ nullable: false }),
    frozen: t.boolean({ nullable: false }),
  }),
});

// #39 the verdict of a KYC submission: APPROVED writes claims on-chain (txHash + claims set);
// REJECTED carries a reason and no claims.
export const KycResult = builder.simpleObject("KycResult", {
  fields: (t) => ({
    decision: t.string({ nullable: false }),
    reason: t.string({ nullable: true }),
    txHash: t.string({ nullable: true }),
    claims: t.field({ type: KycStatus, nullable: true }),
  }),
});

export type { KycStatusView, KycResultView };
