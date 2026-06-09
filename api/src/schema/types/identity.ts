// GraphQL Identity type — the eligibility claims · #20
// The claims the on-chain gauntlet (#7) gates transfers on and recon I4 (#18) re-checks:
// verified / accredited / jurisdiction / frozen. SimpleObject resolved from the `identities`
// read model in #21.
import { builder } from "../builder.ts";
import { Jurisdiction } from "../enums.ts";

// #20 the resolver-produced Identity source (the `identities` row).
export interface IdentitySource {
  wallet: string;
  verified: boolean;
  accredited: boolean;
  jurisdiction: "US" | "NonUS";
  frozen: boolean;
}

export const Identity = builder.simpleObject("Identity", {
  fields: (t) => ({
    wallet: t.field({ type: "Address", nullable: false }),
    verified: t.boolean({ nullable: false }),
    accredited: t.boolean({ nullable: false }),
    jurisdiction: t.field({ type: Jurisdiction, nullable: false }),
    frozen: t.boolean({ nullable: false }),
  }),
});
