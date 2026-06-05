// Money Layer (presentation) · invest/transfer/claim mutation docs + the typed result · #25
// Operation names + inputs MUST match the Pothos mutations (#20/#21): invest(InvestInput),
// transfer(TransferInput), claim(ClaimInput), each returning a TxReceiptRef. MutationResult is a
// discriminated union: { ok:true, txHash } on a clean broadcast, { ok:false, code } on a typed
// revert/HALT (the ReasonCode from extensions.code, never a parsed string). Money inputs are
// BigIntStr decimal strings end to end — no Number() coercion.
import type { ReasonCode } from "./reasonCodes.ts";

// #25 the TxReceiptRef fields the flows read (hash + state + optional optimistic position).
export interface TxReceiptRef {
  hash: string;
  state: "PENDING" | "CONFIRMED" | "REVERTED";
  reasonCode: ReasonCode | null;
  blockNumber: string | null;
  position: { id: string; loanId: string; holder: string; principal: string; accrued: string; claimable: string; optimistic: boolean } | null;
}

// #25 the discriminated mutation result the UI branches on. `code` is a typed ReasonCode on failure.
export type MutationResult<T> = { ok: true; data: T; txHash: `0x${string}` } | { ok: false; code: ReasonCode; message: string };

// #25 invest: mint the loan token to a wallet (PositionOpened; rows 1-3, 6). Returns the PENDING ref.
export const INVEST_MUTATION = /* GraphQL */ `
  mutation Invest($input: InvestInput!) {
    invest(input: $input) {
      hash
      state
      reasonCode
      blockNumber
      position { id loanId holder principal accrued claimable optimistic }
    }
  }
`;

// #25 transfer: a gauntleted holder-to-holder transfer (rows 4-5).
export const TRANSFER_MUTATION = /* GraphQL */ `
  mutation Transfer($input: TransferInput!) {
    transfer(input: $input) {
      hash
      state
      reasonCode
      blockNumber
    }
  }
`;

// #25 claim: pay a holder's accrued interest from the reserve (rows 7-8; InsufficientReserve).
export const CLAIM_MUTATION = /* GraphQL */ `
  mutation Claim($input: ClaimInput!) {
    claim(input: $input) {
      hash
      state
      reasonCode
      blockNumber
    }
  }
`;
