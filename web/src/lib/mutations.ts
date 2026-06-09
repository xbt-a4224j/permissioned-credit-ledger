// GraphQL mutation/query docs + the typed result · #25/#38 — investor writes (invest/transfer/
// claim), operator ops (submitNav/reportCash), and the NAV-readings query.
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

// #38 operator ops: submit a NAV reading through the gate (loanId + navBps). Returns the new recon
// status so the UI can show the gate decision immediately — accepted marks update state, rejected
// marks leave state unchanged but are stored in nav_readings with accepted=false.
export const SUBMIT_NAV_MUTATION = /* GraphQL */ `
  mutation SubmitNav($loanId: Int!, $navBps: Int!) {
    submitNav(loanId: $loanId, navBps: $navBps) { state cycle haltReason }
  }
`;

// #38 operator ops: report collected servicing cash (loanId + USDC amount in base units as a string).
// Returns the new recon status — a mismatch between reported cash and aggregate claimable trips HALT.
export const REPORT_CASH_MUTATION = /* GraphQL */ `
  mutation ReportCash($loanId: Int!, $amount: String!) {
    reportCash(loanId: $loanId, amount: $amount) { state cycle haltReason }
  }
`;

// #38 NAV readings for a loan (newest first, up to 10). Used by the ops card to display the
// gate's accept/reject history — the source + rejectReason columns make the gate's logic visible.
export const NAV_READINGS_QUERY = /* GraphQL */ `
  query NavReadings($loanId: ID!) {
    navReadings(loanId: $loanId) {
      id
      navBps
      observedAt
      source
      accepted
      rejectReason
    }
  }
`;
