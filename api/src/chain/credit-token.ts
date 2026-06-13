// Typed CreditToken bindings for the API signer · #21/#66
// Exposes the three write actions invest/transfer/claim as { address, abi, functionName, args }
// requests the resolver simulates then writes (#21). The token ADDRESS is resolved by the caller from
// the loans read model (#66 — loans.token_address is the single source of truth for ALL loans, the 6
// seeded AND any runtime-tokenized one), not a static deploy manifest, so a tokenized loan works
// exactly like a seeded one. One token == one loan series.
import type { Address } from "viem";
import { CREDIT_TOKEN_ABI } from "./abi.ts";

// #21 an invest = issuer mint(to, loanId, amount). The server signer holds ISSUER_ROLE locally. The
// on-chain mint still takes the loanId (the token's loan series); the address selects the token.
export function investRequest(address: Address, loanId: string, wallet: Address, amount: bigint) {
  return {
    address,
    abi: CREDIT_TOKEN_ABI,
    functionName: "mint" as const,
    args: [wallet, BigInt(loanId), amount] as const,
  };
}

// #21 a transfer = ERC20 transfer(to, amount) from the signer. (Per-user wallet signing is the
// UI's job in #25; here the single server signer originates the holder-to-holder move.)
export function transferRequest(address: Address, to: Address, amount: bigint) {
  return {
    address,
    abi: CREDIT_TOKEN_ABI,
    functionName: "transfer" as const,
    args: [to, amount] as const,
  };
}

// #21 a claim = claim() on the loan token, paying accrued interest from the reserve.
export function claimRequest(address: Address) {
  return {
    address,
    abi: CREDIT_TOKEN_ABI,
    functionName: "claim" as const,
    args: [] as const,
  };
}
