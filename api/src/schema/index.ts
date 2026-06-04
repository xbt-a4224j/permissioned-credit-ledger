// Money Layer · the assembled GraphQL schema · #20
// Imports every scalar/enum/type/input/root module for side-effect registration on the shared
// builder, then freezes the SDL with builder.toSchema(). The print-schema script (#20) snapshots
// this to api/schema.graphql and CI diffs it, so an accidental rename fails the build.
import { printSchema, validateSchema } from "graphql";
import { builder } from "./builder.ts";

// scalars + enums first (types reference them by name).
import "./scalars.ts";
import "./enums.ts";

// object types.
import "./types/loan.ts";
import "./types/identity.ts";
import "./types/position.ts";
import "./types/reserve.ts";
import "./types/reconciliation.ts";
import "./types/tx.ts";

// inputs + roots.
import "./inputs.ts";
import "./query.ts";
import "./mutation.ts";

// #20 the built, validated schema consumed by the yoga server (#21) and the snapshot script.
export const schema = builder.toSchema();

// #20 validate the schema and return the errors as plain messages ([] == valid). The vitest config
// aliases graphql to a single copy so Pothos's schema and this validateSchema share one realm.
export function validateBuiltSchema(): string[] {
  return validateSchema(schema).map((e) => e.message);
}

// #20 the SDL snapshot the print-schema script + CI diff use.
export function schemaSDL(): string {
  return printSchema(schema);
}
