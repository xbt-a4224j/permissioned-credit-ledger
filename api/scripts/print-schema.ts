// Money Layer · print the GraphQL SDL snapshot · #20
// Emits the built schema (#20) as SDL to stdout. `bun run api/scripts/print-schema.ts >
// api/schema.graphql` writes the committed snapshot CI diffs, so a renamed reason code or a
// dropped field fails the build (the schema-drift guard from #20's notes).
import { printSchema } from "graphql";
import { schema } from "../src/schema/index.ts";

process.stdout.write(printSchema(schema));
process.stdout.write("\n");
