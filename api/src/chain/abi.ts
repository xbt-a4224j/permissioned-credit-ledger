// ABI source of truth for the API signer + error decoder · #21/#66
// Loads the Foundry-emitted artifacts (copied by copy_abis.sh, #13) and exposes (a) the
// CreditToken ABI the wallet client writes invest/transfer/claim against, and (b) a COMBINED
// error ABI — the union of every custom error across CreditToken + the IdentityRegistry — so a
// typed revert decodes to its name even though the call entered through CreditToken. (#66 removed
// the ComplianceRegistry: the only permissioning revert, ReceiverNotVerified, lives on CreditToken.)
// The ABI-drift landmine: a stale selector turns a typed revert opaque, so decoding binds to the
// same artifacts the contracts compiled to.
import creditTokenArtifact from "../abi/CreditToken.json" with { type: "json" };
import identityArtifact from "../abi/IdentityRegistry.json" with { type: "json" };
import type { Abi, AbiFunction } from "viem";

// #21 the error-fragment subtype of an ABI item (viem doesn't re-export AbiError at the root).
type AbiErrorItem = Extract<Abi[number], { type: "error" }>;

interface Artifact {
  abi: Abi;
}

// #21 the full CreditToken ABI (read totalSupply/claimable + write mint/transfer/claim).
export const CREDIT_TOKEN_ABI = (creditTokenArtifact as Artifact).abi;
export const IDENTITY_ABI = (identityArtifact as Artifact).abi;

// #21 the combined error ABI: every `error` fragment from CreditToken + IdentityRegistry,
// de-duplicated by name. decodeReason (#21) decodes a revert against this.
export const COMBINED_ERROR_ABI: Abi = (() => {
  const seen = new Set<string>();
  const errors: AbiErrorItem[] = [];
  for (const abi of [CREDIT_TOKEN_ABI, IDENTITY_ABI]) {
    for (const item of abi) {
      if (item.type === "error" && !seen.has(item.name)) {
        seen.add(item.name);
        errors.push(item);
      }
    }
  }
  return errors;
})();

// #21 the three write function names invest/transfer/claim broadcast (typed lookup in #21).
export const INVEST_FN = "mint" as const;
export const TRANSFER_FN = "transfer" as const;
export const CLAIM_FN = "claim" as const;

// #21 narrow the ABI to its function fragments (used when building typed simulate calls).
export const CREDIT_TOKEN_FUNCTIONS = CREDIT_TOKEN_ABI.filter((i): i is AbiFunction => i.type === "function");
