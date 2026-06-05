// Money Layer · GraphQL mutation inputs — invest / transfer / claim · #20
// The three write paths the thesis is built on. Amounts are BigIntStr (validated to a uint256
// decimal string by the scalar) and wallets are Address (validated 0x-hex) — every external
// input is parsed/validated at the scalar boundary before a resolver (#21) ever touches it.
import { builder } from "./builder.ts";

// #20 invest: the server signer mints `amount` of the loan's CreditToken to `wallet`
// (PositionOpened, matrix rows 1-3). loanId selects the token from the manifest.
export const InvestInput = builder.inputType("InvestInput", {
  fields: (t) => ({
    loanId: t.id({ required: true }),
    wallet: t.field({ type: "Address", required: true }),
    amount: t.field({ type: "BigIntStr", required: true }),
  }),
});

// #20 transfer: a holder-to-holder ERC20 transfer that runs the gauntlet (matrix rows 4-6).
export const TransferInput = builder.inputType("TransferInput", {
  fields: (t) => ({
    loanId: t.id({ required: true }),
    from: t.field({ type: "Address", required: true }),
    to: t.field({ type: "Address", required: true }),
    amount: t.field({ type: "BigIntStr", required: true }),
  }),
});

// #20 claim: pay a holder's accrued interest from the reserve (matrix rows 7-8).
export const ClaimInput = builder.inputType("ClaimInput", {
  fields: (t) => ({
    loanId: t.id({ required: true }),
    wallet: t.field({ type: "Address", required: true }),
  }),
});

// #39 KYC submission — the document is METADATA ONLY (hashed client-side; bytes never leave the
// browser). The provider verdict drives an on-chain setClaims; no PII is transmitted or stored.
export const KycInput = builder.inputType("KycInput", {
  fields: (t) => ({
    wallet: t.field({ type: "Address", required: true }),
    fullName: t.string({ required: true }),
    jurisdiction: t.string({ required: true }), // "US" | "NonUS"
    accredited: t.boolean({ required: true }),
    docFilename: t.string({ required: true }),
    docSize: t.int({ required: true }),
    docSha256: t.string({ required: true }),
  }),
});
