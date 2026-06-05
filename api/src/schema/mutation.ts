// Money Layer · GraphQL Mutation root — drive the chain through the HALT gate · #20/#21
// The three write paths. Field signatures frozen here (#20); the resolver bodies (#21) gate on
// the reconciliation status FIRST (a HALTED engine refuses to broadcast — matrix rows 9-10),
// then simulate (surfacing typed custom-error reverts for free — rows 3-6, 8) and write via the
// single server signer, recording the PENDING tx + optimistic position (#23).
import { builder } from "./builder.ts";
import { TxReceiptRef } from "./types/tx.ts";
import { ReconciliationStatus } from "./types/reconciliation.ts";
import { KycResult } from "./types/kyc.ts";
import { InvestInput, TransferInput, ClaimInput, KycInput } from "./inputs.ts";
import { resolveInvest, resolveTransfer, resolveClaim } from "../resolvers/mutations.ts";
import { resolvePushNav, resolveInjectCash, resolveSubmitNav, resolveReportCash } from "../resolvers/demo.ts";
import { resolveSubmitKyc } from "../kyc/resolve.ts";

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
    // #33 demo trigger — push a +40% NAV spike to halt the loan with NavAnomaly (matrix row 9).
    // Local-node only; returns the resulting reconciliation status so the UI updates immediately.
    pushNav: t.field({
      type: ReconciliationStatus,
      nullable: false,
      args: { loanId: t.arg.int({ required: true }) },
      resolve: (_root, args, ctx) => resolvePushNav(ctx, args.loanId),
    }),
    // #33 demo trigger — under-fund the reserve below claimable to halt with ReconMismatch (row 10).
    injectCash: t.field({
      type: ReconciliationStatus,
      nullable: false,
      args: { loanId: t.arg.int({ required: true }) },
      resolve: (_root, args, ctx) => resolveInjectCash(ctx, args.loanId),
    }),
    // #38 the platform ops: submit a NAV reading through the gate; gate decides accept/reject.
    submitNav: t.field({
      type: ReconciliationStatus,
      nullable: false,
      args: {
        loanId: t.arg.int({ required: true }),
        navBps: t.arg.int({ required: true }),
      },
      resolve: (_root, args, ctx) => resolveSubmitNav(ctx, args.loanId, args.navBps),
    }),
    // #38 the platform ops: report collected servicing cash; sets reserve balance + runs recon.
    reportCash: t.field({
      type: ReconciliationStatus,
      nullable: false,
      args: {
        loanId: t.arg.int({ required: true }),
        amount: t.arg.string({ required: true }),
      },
      resolve: (_root, args, ctx) => resolveReportCash(ctx, args.loanId, args.amount),
    }),
    // #39 KYC onboarding: provider verdict → (on approve) issuer-signs IdentityRegistry.setClaims so
    // the wallet's on-chain claims flip and the transfer gauntlet now passes. Metadata only, no PII.
    submitKyc: t.field({
      type: KycResult,
      nullable: false,
      args: { input: t.arg({ type: KycInput, required: true }) },
      resolve: (_root, args, ctx) => resolveSubmitKyc(ctx, args.input),
    }),
  }),
});
