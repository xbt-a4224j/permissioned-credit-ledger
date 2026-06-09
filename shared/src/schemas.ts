// ArkType schemas + inferred domain types (mortgage-general) · #14 / #44
// One vocabulary for the loan-tape: a Loan is a first-lien MORTGAGE on a Property
// (collateralType CRE today, RESIDENTIAL-ready — the seam), money is branded Usdc6,
// ratios are Bps. A `.pipe(...)` morph brands on parse so a parsed value is already a
// domain type, never a loose primitive the recon engine (#18) could mis-compare.
// Enums mirror the on-chain truth: LoanStatus == the CreditToken.LoanStatus enum,
// Jurisdiction matches the IdentityRegistry. (#44: migrated zod -> ArkType.)

import { type } from "arktype";
import {
  bps,
  eventId,
  identityAddr,
  loanId,
  positionId,
  propertyId,
  unixSeconds,
  usdc6,
  type PositionId,
} from "./brand.ts";

// #14 base-unit money (numeric(78,0) shape, #15) -> branded Usdc6. The `.pipe` OUTPUT is already
// branded; the morph's input stays loose (bigint | integer | digit-string) so callers aren't forced
// to pre-brand. Parsed/inferred output type is Usdc6.
const Usdc6Schema = type("bigint | number.integer | /^\\d+$/").pipe((v) => usdc6(v as bigint | number | string));

const BpsSchema = type("0 <= number.integer <= 1000000").pipe((v) => bps(v));
const UnixSecondsSchema = type("number.integer >= 0").pipe((v) => unixSeconds(v));
const LoanIdSchema = type("string | number").pipe((v) => loanId(v as string | number));
const PropertyIdSchema = type("string | number").pipe((v) => propertyId(v as string | number));
const IdentityAddrSchema = type("string").pipe((v) => identityAddr(v));

// #14 loan-series status mirrors CreditToken.LoanStatus (no accrual at DEFAULT).
export const LoanStatusSchema = type("'PERFORMING' | 'DELINQUENT' | 'DEFAULT'");
export type LoanStatus = typeof LoanStatusSchema.infer;

// #14 jurisdiction mirrors IdentityRegistry.Jurisdiction (US / non-US gating).
export const JurisdictionSchema = type("'US' | 'nonUS'");
export type Jurisdiction = typeof JurisdictionSchema.infer;

// #14 collateral type — the mortgage-general seam: CRE-first, residential plugs in.
export const CollateralTypeSchema = type("'CRE' | 'RESIDENTIAL'");
export type CollateralType = typeof CollateralTypeSchema.infer;

// #14 Property: the first-lien collateral a Loan is a mortgage on.
export const PropertySchema = type({
  id: PropertyIdSchema,
  addressLabel: "string",
  appraisedValue: Usdc6Schema,
  lienPosition: "number.integer > 0",
});
export type Property = typeof PropertySchema.infer;

// #14 Loan: a first-lien MORTGAGE on a Property. collateralType/propertyId/ltvBps/dscrBps
// are the mortgage modeling; principal+rateBps drive on-chain accrual.
export const LoanSchema = type({
  id: LoanIdSchema,
  principal: Usdc6Schema,
  rateBps: BpsSchema,
  status: LoanStatusSchema,
  startedAt: UnixSecondsSchema,
  collateralType: CollateralTypeSchema,
  propertyId: PropertyIdSchema,
  ltvBps: BpsSchema,
  dscrBps: BpsSchema,
});
export type Loan = typeof LoanSchema.infer;

// #14 Identity: the claims the eligibility gauntlet (#7) and recon I4 (#18) read.
export const IdentitySchema = type({
  addr: IdentityAddrSchema,
  verified: "boolean",
  accredited: "boolean",
  jurisdiction: JurisdictionSchema,
  frozen: "boolean",
});
export type Identity = typeof IdentitySchema.infer;

// #14 Position: a holder's stake in a loan; accrued is the off-chain mirror of on-chain
// claimable that recon I2 (#18) bounds by collected cash.
export const PositionSchema = type({
  id: type("string").pipe((v) => v as PositionId),
  loan: LoanIdSchema,
  holder: IdentityAddrSchema,
  principal: Usdc6Schema,
  accrued: Usdc6Schema,
  openedAt: UnixSecondsSchema,
});
export type Position = typeof PositionSchema.infer;

// #14 derive the canonical PositionId from (loan, holder) — re-exported for callers that
// build a Position from chain events (#16) or replay (#19).
export { positionId };

// #14 EventId from (txHash, logIndex) for the ChainEvent envelope.
const EventIdSchema = type({ txHash: "string", logIndex: "number.integer >= 0" }).pipe(({ txHash, logIndex }) =>
  eventId(txHash, logIndex),
);

// #14 ChainEvent: discriminated on `name`. Each event the indexer (#16) decodes carries
// its EventId + (blockNumber, logIndex) ordering keys + a typed payload. These are the
// append-only inputs replay (#19) folds. ArkType auto-discriminates the union on the literal `name`.
const eventBase = {
  id: EventIdSchema,
  blockNumber: type("bigint"),
  logIndex: "number.integer >= 0",
  token: IdentityAddrSchema, // the CreditToken (loan series) that emitted it
} as const;

export const ChainEventSchema = type({
  ...eventBase,
  name: "'PositionOpened'",
  holder: IdentityAddrSchema,
  loan: LoanIdSchema,
  amount: Usdc6Schema,
})
  .or({
    ...eventBase,
    name: "'Transfer'",
    // #14 loan is resolved from the emitting token (one CreditToken == one loan series) at
    // decode time (#16) so the Transfer event is self-contained for the (loan, holder) projection.
    loan: LoanIdSchema,
    from: IdentityAddrSchema,
    to: IdentityAddrSchema,
    amount: Usdc6Schema,
  })
  .or({
    ...eventBase,
    name: "'InterestClaimed'",
    holder: IdentityAddrSchema,
    loan: LoanIdSchema,
    amount: Usdc6Schema,
  })
  .or({
    ...eventBase,
    name: "'LoanStatusChanged'",
    loan: LoanIdSchema,
    status: LoanStatusSchema,
  });
export type ChainEvent = typeof ChainEventSchema.infer;
export type ChainEventName = ChainEvent["name"];

// #14 NavReading: an off-chain NAV/servicing mark the validation gate (#17) bounds; the
// off-chain truth on-chain accrual is meant to track.
export const NavReadingSchema = type({
  loan: LoanIdSchema,
  navBps: BpsSchema,
  observedAt: UnixSecondsSchema,
  source: "string",
});
export type NavReading = typeof NavReadingSchema.infer;

// #14 ReserveState: the mock-USDC reserve claims pay from; recon conservation reads it.
export const ReserveStateSchema = type({
  balance: Usdc6Schema,
  updatedAt: UnixSecondsSchema,
});
export type ReserveState = typeof ReserveStateSchema.infer;
