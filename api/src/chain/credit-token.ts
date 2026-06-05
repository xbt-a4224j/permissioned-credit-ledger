// On-Chain Layer · typed CreditToken bindings for the API signer · #21
// Resolves a loan's CreditToken address from the deploy manifest (no hardcoded addresses) and
// exposes the three write actions invest/transfer/claim as { address, abi, functionName, args }
// requests the resolver simulates then writes (#21). Reads (totalSupply/claimable) reuse the
// same ABI. One token == one loan series; an unknown loanId is a typed error, never a guess.
import type { Address } from "viem";
import { GraphQLError } from "graphql";
import type { Manifest } from "../../../indexer/src/index.ts";
import { CREDIT_TOKEN_ABI } from "./abi.ts";

// #21 the CreditToken address for a loanId (from the manifest). Throws a typed BAD_INPUT error
// for an unknown loan so the API surfaces a clean message, never an opaque undefined.
export function tokenAddressForLoan(manifest: Manifest, loanId: string): Address {
  const loan = manifest.loans[loanId];
  if (loan === undefined) {
    throw new GraphQLError(`unknown loanId: ${loanId}`, { extensions: { code: "BAD_USER_INPUT" } });
  }
  return loan.token as Address;
}

// #21 an invest = issuer mint(to, loanId, amount). The server signer holds ISSUER_ROLE locally.
export function investRequest(manifest: Manifest, loanId: string, wallet: Address, amount: bigint) {
  return {
    address: tokenAddressForLoan(manifest, loanId),
    abi: CREDIT_TOKEN_ABI,
    functionName: "mint" as const,
    args: [wallet, BigInt(loanId), amount] as const,
  };
}

// #21 a transfer = ERC20 transfer(to, amount) from the signer. (Per-user wallet signing is the
// UI's job in #25; here the single server signer originates the holder-to-holder move.)
export function transferRequest(manifest: Manifest, loanId: string, to: Address, amount: bigint) {
  return {
    address: tokenAddressForLoan(manifest, loanId),
    abi: CREDIT_TOKEN_ABI,
    functionName: "transfer" as const,
    args: [to, amount] as const,
  };
}

// #21 a claim = claim() on the loan token, paying accrued interest from the reserve.
export function claimRequest(manifest: Manifest, loanId: string) {
  return {
    address: tokenAddressForLoan(manifest, loanId),
    abi: CREDIT_TOKEN_ABI,
    functionName: "claim" as const,
    args: [] as const,
  };
}
