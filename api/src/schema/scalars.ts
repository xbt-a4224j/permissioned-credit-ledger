// Money Layer · custom GraphQL scalars (string money, address, datetime) · #20
// The marquee landmine: a uint256 token amount over 2^53 silently corrupts as a JS number and
// fabricates the very off-chain/on-chain drift the reconciliation engine exists to catch. So
// BigIntStr carries every amount as a base-10 string, validated by zod on parse AND serialize —
// it round-trips uint256 max losslessly. Address is a 20-byte hex; DateTime is ISO-8601.
import { GraphQLError } from "graphql";
import { z } from "zod";
import { builder } from "./builder.ts";

// #20 a decimal-only, non-negative integer string (uint256-wide). No sign, no decimal point —
// matches the numeric(78,0) read-model shape (#15) and the Usdc6 base unit (#14).
const bigIntStr = z.string().regex(/^\d+$/, "BigIntStr must be a base-10 non-negative integer string");
const UINT256_MAX = (1n << 256n) - 1n;

// #20 coerce a string|number|bigint into the canonical decimal string, validating the range.
function toBigIntStr(value: unknown): string {
  let s: string;
  if (typeof value === "bigint") s = value.toString();
  else if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) throw new GraphQLError("BigIntStr must be a non-negative integer");
    s = value.toString();
  } else if (typeof value === "string") s = value;
  else throw new GraphQLError("BigIntStr must be a string");

  const parsed = bigIntStr.safeParse(s);
  if (!parsed.success) throw new GraphQLError(parsed.error.issues[0]?.message ?? "invalid BigIntStr");
  if (BigInt(s) > UINT256_MAX) throw new GraphQLError("BigIntStr exceeds uint256 max");
  return s;
}

// #20 BigIntStr scalar: serialize (resolver -> client) and parse (client -> resolver) both go
// through the same validator, so a value can never widen to a lossy number at the boundary.
export const BigIntStr = builder.scalarType("BigIntStr", {
  serialize: (value) => toBigIntStr(value),
  parseValue: (value) => toBigIntStr(value),
});

// #20 Address scalar: a 0x-prefixed 20-byte hex (checksum-agnostic; lowercased on parse so DB
// joins + map keys never split on case, mirroring identityAddr in #14).
const addressRe = /^0x[0-9a-fA-F]{40}$/;
export const Address = builder.scalarType("Address", {
  serialize: (value) => {
    if (typeof value !== "string" || !addressRe.test(value)) throw new GraphQLError("invalid Address");
    return value;
  },
  parseValue: (value) => {
    if (typeof value !== "string" || !addressRe.test(value)) throw new GraphQLError("invalid Address");
    return value.toLowerCase();
  },
});

// #20 DateTime scalar: ISO-8601 string <-> Date. Used for accrual/recon timestamps.
export const DateTime = builder.scalarType("DateTime", {
  serialize: (value) => (value instanceof Date ? value.toISOString() : new Date(value as string).toISOString()),
  parseValue: (value) => {
    if (typeof value !== "string" && !(value instanceof Date)) throw new GraphQLError("invalid DateTime");
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) throw new GraphQLError("invalid DateTime");
    return d;
  },
});
