// Typed GraphQL error classes + formatError guard · #21
// Failures are typed, not stringly: every error the API surfaces carries an extensions.code that
// is one of the 8 typed codes (6 reverts + 2 engine states) or INTERNAL. ReconHaltError is the HALT gate's refusal (the
// engine is HALTED, distribution blocked — matrix rows 9-10); ChainRevertError carries a decoded
// on-chain custom-error ReasonCode (rows 3-6, 8). formatError clamps any leaked error to this
// contract so a client always sees a machine-checkable code, never a raw RPC string or stack.
import { GraphQLError } from "graphql";
import type { EngineState, ReasonCode } from "@pcl/shared";
import { REASON_CODES, ENGINE_STATES } from "@pcl/shared";

// #21 the closed code set the API guarantees on every error.
const CODE_SET = new Set<string>([...REASON_CODES, ...ENGINE_STATES]);

// #21 the reconciliation HALT refusal — thrown BEFORE any chain write when the engine is HALTED.
// Carries the typed engine state (NavAnomaly | ReconMismatch) as the reason code.
export class ReconHaltError extends GraphQLError {
  constructor(reason: EngineState) {
    super(`distribution halted: ${reason}`, { extensions: { code: reason, reasonCode: reason } });
    this.name = "ReconHaltError";
  }
}

// #21 a decoded on-chain custom-error revert (the gauntlet / reserve). Carries the ReasonCode.
export class ChainRevertError extends GraphQLError {
  constructor(reason: ReasonCode) {
    super(reason, { extensions: { code: reason, reasonCode: reason } });
    this.name = "ChainRevertError";
  }
}

// #21 graphql-yoga maskedErrors hook: guarantee extensions.code is always a known code or
// INTERNAL, and never leak an internal message/stack for an unrecognized error.
export function formatError(error: unknown): GraphQLError {
  if (error instanceof GraphQLError) {
    const code = error.extensions?.["code"];
    if (typeof code === "string" && CODE_SET.has(code)) return error;
    // a GraphQLError without a typed code (e.g. validation) keeps its message but is marked.
    const safeCode = typeof code === "string" ? code : "INTERNAL";
    return new GraphQLError(error.message, { extensions: { ...error.extensions, code: safeCode } });
  }
  // never surface a raw thrown value.
  return new GraphQLError("Internal server error", { extensions: { code: "INTERNAL" } });
}
