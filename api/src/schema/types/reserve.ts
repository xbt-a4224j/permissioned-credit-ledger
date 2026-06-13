// GraphQL ReserveState type — the mock-USDC reserve · #20
// The off-chain collected-cash mirror claims pay from. recon I2 (#18) requires
// totalClaimable <= balance; surfacing both lets the health panel (#26) show the coverage
// margin. Money fields BigIntStr.
import { builder } from "../builder.ts";

// #20 the resolver-produced ReserveState source — both fields off the single-row `reserve`:
// balance is reported collected cash; totalClaimable is the engine-snapshotted aggregate
// on-chain claimable the recon cycle persists each pass (#45).
export interface ReserveStateSource {
  balance: string;
  totalClaimable: string;
}

export const ReserveState = builder.simpleObject("ReserveState", {
  fields: (t) => ({
    balance: t.field({ type: "BigIntStr", nullable: false }),
    totalClaimable: t.field({ type: "BigIntStr", nullable: false }),
  }),
});

// #82 one row of the reserve append-only ledger of record. balance (above) is a maintained cache;
// this is the authoritative audit trail: every credit (servicing collection, initial funding) and
// debit (interest claim, operator report), with the running balanceAfter. Powers the Servicing
// panel's "every dollar in and out of the reserve". Money fields are BigIntStr base units (USDC e6).
export interface ReserveLedgerEntrySource {
  id: string;
  entryType: string; // 'credit' | 'debit' (the DB check constraint)
  amount: string;
  reason: string;
  loanId: string | null;
  balanceAfter: string | null;
  at: Date;
}

export const ReserveLedgerEntry = builder.simpleObject("ReserveLedgerEntry", {
  fields: (t) => ({
    id: t.id({ nullable: false }),
    entryType: t.string({ nullable: false }),
    amount: t.field({ type: "BigIntStr", nullable: false }),
    reason: t.string({ nullable: false }),
    loanId: t.id({ nullable: true }),
    balanceAfter: t.field({ type: "BigIntStr", nullable: true }),
    at: t.field({ type: "DateTime", nullable: false }),
  }),
});
