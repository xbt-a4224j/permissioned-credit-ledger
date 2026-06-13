// GraphQL Identity type — the verified claim · #20/#66
// The claim the on-chain permissioning check gates transfers on and recon I4 (#18) re-checks:
// `verified`. SimpleObject resolved from the `identities` read model in #21. (#66 collapsed the
// old accreditation / jurisdiction / sanctions-freeze claims to verified-only.)
import { builder } from "../builder.ts";

// #20 the resolver-produced Identity source (the `identities` row).
export interface IdentitySource {
  wallet: string;
  verified: boolean;
}

export const Identity = builder.simpleObject("Identity", {
  fields: (t) => ({
    wallet: t.field({ type: "Address", nullable: false }),
    verified: t.boolean({ nullable: false }),
  }),
});
