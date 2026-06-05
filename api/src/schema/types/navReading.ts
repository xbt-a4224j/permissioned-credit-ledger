// Money Layer · GraphQL NavReading type — a single NAV mark as ingested by the gate · #38
// Exposes the nav_readings table rows to the GraphQL surface so the UI (and the platform ops)
// can inspect which marks were accepted vs rejected and why. observedAt is a DateTime
// scalar (ISO-8601, already registered in scalars.ts) so callers get a real timestamp.
import { builder } from "../builder.ts";

// #38 the resolver-produced source shape (mirrors the nav_readings table columns).
export interface NavReadingSource {
  id: string;
  loanId: string;
  navBps: number;
  observedAt: Date;
  source: string;
  accepted: boolean;
  rejectReason: string | null;
}

// #38 the GraphQL simpleObject — resolved straight from the read model, no per-field resolver.
export const NavReading = builder.simpleObject("NavReading", {
  fields: (t) => ({
    id: t.id({ nullable: false }),
    loanId: t.string({ nullable: false }),
    navBps: t.int({ nullable: false }),
    observedAt: t.field({ type: "DateTime", nullable: false }),
    source: t.string({ nullable: false }),
    accepted: t.boolean({ nullable: false }),
    rejectReason: t.string({ nullable: true }),
  }),
});
