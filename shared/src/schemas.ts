// Asset Layer · zod schemas + inferred domain types (mortgage-general) · #14
// One vocabulary for the loan-tape: a Loan is a first-lien MORTGAGE on a Property
// (collateralType CRE today, RESIDENTIAL-ready — the seam), money is branded Usdc6,
// ratios are Bps. zod `.transform()` brands on parse so a parsed value is already a
// domain type, never a loose primitive the recon engine (#18) could mis-compare.
// Enums mirror the on-chain truth: LoanStatus == the CreditToken.LoanStatus enum,
// Jurisdiction matches the IdentityRegistry.

import { z } from "zod";
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

// #14 base-unit money string (numeric(78,0) shape, #15) -> branded Usdc6. The `.transform`
// output is already branded; we deliberately do NOT annotate `z.ZodType<Usdc6>` because that
// would force the (unbranded) zod INPUT to be Usdc6 too. Parsed output type is Usdc6.
const Usdc6Schema = z.union([z.bigint(), z.number().int(), z.string().regex(/^\d+$/)]).transform((v) => usdc6(v));

const BpsSchema = z.number().int().min(0).max(1_000_000).transform((v) => bps(v));
const UnixSecondsSchema = z.number().int().min(0).transform((v) => unixSeconds(v));
const LoanIdSchema = z.union([z.string(), z.number()]).transform((v) => loanId(v));
const PropertyIdSchema = z.union([z.string(), z.number()]).transform((v) => propertyId(v));
const IdentityAddrSchema = z.string().transform((v) => identityAddr(v));

// #14 loan-series status mirrors CreditToken.LoanStatus (no accrual at DEFAULT).
export const LoanStatusSchema = z.enum(["PERFORMING", "DELINQUENT", "DEFAULT"]);
export type LoanStatus = z.infer<typeof LoanStatusSchema>;

// #14 jurisdiction mirrors IdentityRegistry.Jurisdiction (US / non-US gating).
export const JurisdictionSchema = z.enum(["US", "nonUS"]);
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

// #14 collateral type — the mortgage-general seam: CRE-first, residential plugs in.
export const CollateralTypeSchema = z.enum(["CRE", "RESIDENTIAL"]);
export type CollateralType = z.infer<typeof CollateralTypeSchema>;

// #14 Property: the first-lien collateral a Loan is a mortgage on.
export const PropertySchema = z.object({
  id: PropertyIdSchema,
  addressLabel: z.string(),
  appraisedValue: Usdc6Schema,
  lienPosition: z.number().int().positive(),
});
export type Property = z.infer<typeof PropertySchema>;

// #14 Loan: a first-lien MORTGAGE on a Property. collateralType/propertyId/ltvBps/dscrBps
// are the mortgage modeling; principal+rateBps drive on-chain accrual.
export const LoanSchema = z.object({
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
export type Loan = z.infer<typeof LoanSchema>;

// #14 Identity: the claims the eligibility gauntlet (#7) and recon I4 (#18) read.
export const IdentitySchema = z.object({
  addr: IdentityAddrSchema,
  verified: z.boolean(),
  accredited: z.boolean(),
  jurisdiction: JurisdictionSchema,
  frozen: z.boolean(),
});
export type Identity = z.infer<typeof IdentitySchema>;

// #14 Position: a holder's stake in a loan; accrued is the off-chain mirror of on-chain
// claimable that recon I2 (#18) bounds by collected cash.
export const PositionSchema = z.object({
  id: z.string().transform((v) => v as PositionId),
  loan: LoanIdSchema,
  holder: IdentityAddrSchema,
  principal: Usdc6Schema,
  accrued: Usdc6Schema,
  openedAt: UnixSecondsSchema,
});
export type Position = z.infer<typeof PositionSchema>;

// #14 derive the canonical PositionId from (loan, holder) — re-exported for callers that
// build a Position from chain events (#16) or replay (#19).
export { positionId };

// #14 EventId from (txHash, logIndex) for the ChainEvent envelope.
const EventIdSchema = z
  .object({ txHash: z.string(), logIndex: z.number().int().min(0) })
  .transform(({ txHash, logIndex }) => eventId(txHash, logIndex));

// #14 ChainEvent: discriminated on `name`. Each event the indexer (#16) decodes carries
// its EventId + (blockNumber, logIndex) ordering keys + a typed payload. These are the
// append-only inputs replay (#19) folds.
const eventBase = {
  id: EventIdSchema,
  blockNumber: z.bigint(),
  logIndex: z.number().int().min(0),
  token: IdentityAddrSchema, // the CreditToken (loan series) that emitted it
};

export const ChainEventSchema = z.discriminatedUnion("name", [
  z.object({
    ...eventBase,
    name: z.literal("PositionOpened"),
    holder: IdentityAddrSchema,
    loan: LoanIdSchema,
    amount: Usdc6Schema,
  }),
  z.object({
    ...eventBase,
    name: z.literal("Transfer"),
    from: IdentityAddrSchema,
    to: IdentityAddrSchema,
    amount: Usdc6Schema,
  }),
  z.object({
    ...eventBase,
    name: z.literal("InterestClaimed"),
    holder: IdentityAddrSchema,
    loan: LoanIdSchema,
    amount: Usdc6Schema,
  }),
  z.object({
    ...eventBase,
    name: z.literal("LoanStatusChanged"),
    loan: LoanIdSchema,
    status: LoanStatusSchema,
  }),
]);
export type ChainEvent = z.infer<typeof ChainEventSchema>;
export type ChainEventName = ChainEvent["name"];

// #14 NavReading: an off-chain NAV/servicing mark the validation gate (#17) bounds; the
// off-chain truth on-chain accrual is meant to track.
export const NavReadingSchema = z.object({
  loan: LoanIdSchema,
  navBps: BpsSchema,
  observedAt: UnixSecondsSchema,
  source: z.string(),
});
export type NavReading = z.infer<typeof NavReadingSchema>;

// #14 ReserveState: the mock-USDC reserve claims pay from; recon conservation reads it.
export const ReserveStateSchema = z.object({
  balance: Usdc6Schema,
  updatedAt: UnixSecondsSchema,
});
export type ReserveState = z.infer<typeof ReserveStateSchema>;
