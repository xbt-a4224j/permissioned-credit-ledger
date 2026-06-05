// Money Layer (presentation) · the mutation runner — gql call -> typed MutationResult · #25
// Bridges the gql() boundary (which throws GraphqlCodeError carrying extensions.code) into the
// discriminated MutationResult the tx lifecycle consumes: a clean broadcast returns { ok, txHash };
// a typed revert/HALT returns { ok:false, code } so the UI renders a ReasonBadge, never a string.
import type { MutationResult, TxReceiptRef } from "./mutations.ts";
import { GraphqlCodeError, gql } from "./graphqlClient.ts";

// #25 run `doc` with `vars`, reading the TxReceiptRef out of `field`. Maps the typed error code to
// { ok:false }; an untyped failure surfaces as a generic message (no rendered string code).
export async function runMutation(
  doc: string,
  vars: object,
  field: "invest" | "transfer" | "claim",
): Promise<MutationResult<TxReceiptRef>> {
  try {
    const data = await gql<Record<string, TxReceiptRef>, object>(doc, vars);
    const ref = data[field];
    // no receipt is an untyped (shape) failure, not a reason code — bubble it to the lifecycle.
    if (ref === undefined) throw new Error("no receipt returned");
    // a synchronous typed revert can also surface as state REVERTED with a reasonCode.
    if (ref.state === "REVERTED" && ref.reasonCode !== null) {
      return { ok: false, code: ref.reasonCode, message: ref.reasonCode };
    }
    return { ok: true, data: ref, txHash: ref.hash as `0x${string}` };
  } catch (err) {
    if (err instanceof GraphqlCodeError && err.code !== null) {
      return { ok: false, code: err.code, message: err.message };
    }
    throw err; // an untyped failure (network) bubbles to the lifecycle's catch
  }
}
