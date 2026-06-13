// GraphQL Query root — read the off-chain read models · #20/#21/#23
// The read fields the views consume: loans/loan/position/positions/reserve/reconciliationStatus
// (#20), txStatus (#23), chainEvents/currentBlock (#34), navReadings (#38), kycStatus (#39).
// Field signatures are frozen here (#20); the resolver bodies read the Postgres read models the
// indexer (#16) and reconciliation engine (#18) populate (#21) — queries never touch the chain.
import { builder } from "./builder.ts";
import { Loan } from "./types/loan.ts";
import { Position } from "./types/position.ts";
import { ReserveState, ReserveLedgerEntry } from "./types/reserve.ts";
import { RankedBook, BookAnalytics } from "./types/book.ts";
import { ReconciliationStatus } from "./types/reconciliation.ts";
import { TxReceiptRef } from "./types/tx.ts";
import { NavReading } from "./types/navReading.ts";
import { ChainEvent } from "./types/chainEvent.ts";
import { KycStatus } from "./types/kyc.ts";
import { resolveKycStatus } from "../kyc/resolve.ts";
import { resolveBook, resolveBookAnalytics } from "../resolvers/book.ts";
import {
  resolveLoan,
  resolveLoans,
  resolvePosition,
  resolvePositions,
  resolveReconciliationStatus,
  resolveReserve,
  resolveReserveLedger,
  resolveNavReadings,
  resolveChainEvents,
  resolveCurrentBlock,
} from "../resolvers/queries.ts";
import { resolveTxStatus } from "../resolvers/tx-queries.ts";

builder.queryType({
  fields: (t) => ({
    // #20/#21 the loan-tape: all 6 seeded loans, ordered by id.
    loans: t.field({
      type: [Loan],
      nullable: false,
      resolve: (_root, _args, ctx) => resolveLoans(ctx),
    }),
    // #20/#21 one loan by id (null if unknown).
    loan: t.field({
      type: Loan,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, args, ctx) => resolveLoan(ctx, String(args.id)),
    }),
    // #20/#21 one holder's position on a loan (the indexer-projected canonical row).
    position: t.field({
      type: Position,
      nullable: true,
      args: {
        holder: t.arg({ type: "Address", required: true }),
        loanId: t.arg.id({ required: true }),
      },
      resolve: (_root, args, ctx) => resolvePosition(ctx, args.holder, String(args.loanId)),
    }),
    // #20/#21 all of a holder's positions (the indexer-projected canonical rows).
    positions: t.field({
      type: [Position],
      nullable: false,
      args: { holder: t.arg({ type: "Address", required: true }) },
      resolve: (_root, args, ctx) => resolvePositions(ctx, args.holder),
    }),
    // #20/#21 the reserve coverage (balance + aggregate claimable).
    reserve: t.field({
      type: ReserveState,
      nullable: false,
      resolve: (_root, _args, ctx) => resolveReserve(ctx),
    }),
    // #82 the reserve append-only ledger — recent credits/debits, newest first (cap 100).
    reserveLedger: t.field({
      type: [ReserveLedgerEntry],
      nullable: false,
      args: { limit: t.arg.int({ required: false, defaultValue: 20 }) },
      resolve: (_root, args, ctx) => resolveReserveLedger(ctx, args.limit ?? 20),
    }),
    // #20/#21 the latest reconciliation cycle as a first-class query.
    reconciliationStatus: t.field({
      type: ReconciliationStatus,
      nullable: false,
      resolve: (_root, _args, ctx) => resolveReconciliationStatus(ctx),
    }),
    // #23 the tracked tx lifecycle (PENDING->CONFIRMED|REVERTED) for a broadcast hash.
    txStatus: t.field({
      type: TxReceiptRef,
      nullable: true,
      args: { hash: t.arg.string({ required: true }) },
      resolve: (_root, args, ctx) => resolveTxStatus(ctx, args.hash),
    }),
    // #38 the last 10 NAV readings for a loan (newest first), for the operator ops feed panel.
    navReadings: t.field({
      type: [NavReading],
      nullable: false,
      args: { loanId: t.arg.id({ required: true }) },
      resolve: (_root, args, ctx) => resolveNavReadings(ctx, String(args.loanId)),
    }),
    // #39 recent on-chain events (newest first), capped at 50. Powers the Health live event log.
    chainEvents: t.field({
      type: [ChainEvent],
      nullable: false,
      args: { limit: t.arg.int({ required: false, defaultValue: 20 }) },
      resolve: (_root, args, ctx) => resolveChainEvents(ctx, args.limit ?? 20),
    }),
    // #39 current block number from the indexer cursor — the last fully-ingested block.
    currentBlock: t.int({
      nullable: false,
      resolve: (_root, _args, ctx) => resolveCurrentBlock(ctx),
    }),
    // #39 a wallet's current on-chain KYC claims (the gauntlet's source of truth) — UI badge.
    kycStatus: t.field({
      type: KycStatus,
      nullable: false,
      args: { wallet: t.arg({ type: "Address", required: true }) },
      resolve: (_root, args, ctx) => resolveKycStatus(ctx, args.wallet),
    }),
    // #64 the warehouse's ranked book (score desc, paginated) — proxied from the Java sidecar (#63).
    book: t.field({
      type: RankedBook,
      nullable: false,
      args: {
        limit: t.arg.int({ required: false, defaultValue: 50 }),
        offset: t.arg.int({ required: false, defaultValue: 0 }),
        includeTokenized: t.arg.boolean({ required: false, defaultValue: false }),
      },
      resolve: (_root, args) => resolveBook(args.limit ?? 50, args.offset ?? 0, args.includeTokenized ?? false),
    }),
    // #64 book-level analytics (concentration + LTV distribution) from the warehouse.
    bookAnalytics: t.field({
      type: BookAnalytics,
      nullable: false,
      resolve: () => resolveBookAnalytics(),
    }),
  }),
});
