// Money Layer · the Pothos code-first SchemaBuilder · #20
// One builder instance wires the custom scalars (uint256 money as a string — never a JS number,
// the IEEE-754 landmine — addresses, timestamps) and the ApiContext (#20/#21) into every type
// and resolver. SimpleObjects plugin: the read-model DTOs (Loan/Position/Reconciliation...) are
// plain data shapes resolved from SQL/chain in #21, so they need no per-field resolver here.
import SchemaBuilder from "@pothos/core";
import SimpleObjectsPlugin from "@pothos/plugin-simple-objects";
import type { ApiContext } from "../context.ts";

// #20 the typed schema config: custom scalars (string-encoded uint256, EIP-55 address, Date) +
// the request context. BigIntStr keeps every token amount a decimal string end to end.
export const builder = new SchemaBuilder<{
  Context: ApiContext;
  Scalars: {
    BigIntStr: { Input: string; Output: string };
    DateTime: { Input: Date; Output: Date };
    Address: { Input: string; Output: string };
  };
}>({
  plugins: [SimpleObjectsPlugin],
});
