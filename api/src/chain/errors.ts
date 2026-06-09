// Typed revert decoding — custom error -> ReasonCode · #21
// The whole matrix asserts a specific typed failure per branch; this is where an opaque RPC
// revert becomes one of the 6 on-chain ReasonCodes. decodeReason walks a viem error chain (or
// takes raw revert `data`) and decodes the custom error name against the COMBINED error ABI
// (#21 abi) — so a gauntlet revert thrown in ComplianceRegistry still resolves even though the
// tx entered through CreditToken. It is TOTAL: any input (arbitrary bytes, a non-error) returns
// a ReasonCode or null, never throws — the property the #21 fast-check test pins.
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  type Hex,
} from "viem";
import type { ReasonCode } from "@pcl/shared";
import { COMBINED_ERROR_ABI } from "./abi.ts";

// #21 the 6 Solidity custom-error names that map 1:1 onto a ReasonCode (the matrix branches).
// AccessControl/ERC20/Reentrancy reverts are NOT reason codes — they fall through to null.
const ERROR_NAME_TO_REASON: Record<string, ReasonCode> = {
  SenderFrozen: "SenderFrozen",
  NotEligible: "NotEligible",
  ReceiverFrozen: "ReceiverFrozen",
  ReceiverNotVerified: "ReceiverNotVerified",
  AccreditationRequired: "AccreditationRequired",
  InsufficientReserve: "InsufficientReserve",
};

// #21 decode raw revert bytes -> error name -> ReasonCode. Returns null for non-matching /
// undecodable data. Never throws (totality).
function reasonFromData(data: Hex): ReasonCode | null {
  try {
    const decoded = decodeErrorResult({ abi: COMBINED_ERROR_ABI, data });
    return ERROR_NAME_TO_REASON[decoded.errorName] ?? null;
  } catch {
    return null;
  }
}

// #21 the main mapper. Accepts a thrown viem error, a raw revert-data hex string, or anything.
// Walks the viem error cause chain for a ContractFunctionRevertedError (which carries the
// decoded errorName or the raw data) and maps it; otherwise tries to read raw `data`.
export function decodeReason(err: unknown): ReasonCode | null {
  // raw revert data passed directly (the errors.decode.test.ts path).
  if (typeof err === "string" && /^0x[0-9a-fA-F]*$/.test(err)) {
    return reasonFromData(err as Hex);
  }

  // a viem BaseError chain: find the revert and read its decoded name or raw data.
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const named = revert.data?.errorName;
      if (named !== undefined && ERROR_NAME_TO_REASON[named] !== undefined) return ERROR_NAME_TO_REASON[named];
      const raw = revert.raw;
      if (raw !== undefined) return reasonFromData(raw);
    }
  }

  // last resort: an object carrying a `data` hex (some transports surface it loosely).
  if (typeof err === "object" && err !== null) {
    const data = (err as { data?: unknown }).data;
    if (typeof data === "string" && /^0x[0-9a-fA-F]*$/.test(data)) return reasonFromData(data as Hex);
  }

  return null;
}

// #21 the GraphQL extensions.code for a reason — identity here (the code IS the typed string the
// schema enum exposes); kept as a named seam so a future HTTP-status mapping has one home.
export function mapReasonToHttpCode(r: ReasonCode): string {
  return r;
}
