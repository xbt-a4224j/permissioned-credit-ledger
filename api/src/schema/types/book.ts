// #64 the warehouse book, exposed through the API's GraphQL surface so the UI talks to one endpoint.
// BookLoan/RankedBook/BookAnalytics mirror the warehouse REST DTOs (#57/#58); resolvers proxy the
// warehouse client (#63). principal/score are Float (display analytics, not on-chain base-unit money).
import { builder } from "../builder.ts";

const ScoreWeights = builder.simpleObject("ScoreWeights", {
  fields: (t) => ({
    credit: t.float({ nullable: false }),
    ret: t.float({ nullable: false }),
    duration: t.float({ nullable: false }),
    portfolio: t.float({ nullable: false }),
  }),
});

export const BookLoan = builder.simpleObject("BookLoan", {
  fields: (t) => ({
    loanId: t.id({ nullable: false }),
    principal: t.float({ nullable: false }),
    ltvBps: t.int({ nullable: false }),
    dscrBps: t.int({ nullable: false }),
    couponBps: t.int({ nullable: false }),
    termMonths: t.int({ nullable: false }),
    state: t.string({ nullable: false }),
    propertyType: t.string({ nullable: false }),
    originator: t.string({ nullable: false }),
    tokenized: t.boolean({ nullable: false }),
    score: t.float({ nullable: false }),
    creditScore: t.float({ nullable: false }),
    returnScore: t.float({ nullable: false }),
    durationScore: t.float({ nullable: false }),
    portfolioScore: t.float({ nullable: false }),
  }),
});

export const RankedBook = builder.simpleObject("RankedBook", {
  fields: (t) => ({
    weights: t.field({ type: ScoreWeights, nullable: false }),
    total: t.int({ nullable: false }),
    loans: t.field({ type: [BookLoan], nullable: false }),
  }),
});

// a labelled count — reused for every analytics distribution (concentration + LTV histogram).
const BookBucket = builder.simpleObject("BookBucket", {
  fields: (t) => ({
    label: t.string({ nullable: false }),
    count: t.int({ nullable: false }),
  }),
});

export const BookAnalytics = builder.simpleObject("BookAnalytics", {
  fields: (t) => ({
    total: t.int({ nullable: false }),
    tokenized: t.int({ nullable: false }),
    totalPrincipalM: t.int({ nullable: false }), // whole-book $ exposure, millions
    tokenizedPrincipalM: t.int({ nullable: false }), // tokenized-on-chain $ exposure, millions
    avgLtvBps: t.float({ nullable: false }),
    avgDscrBps: t.float({ nullable: false }),
    avgCouponBps: t.float({ nullable: false }),
    byState: t.field({ type: [BookBucket], nullable: false }),
    byPropertyType: t.field({ type: [BookBucket], nullable: false }),
    byOriginator: t.field({ type: [BookBucket], nullable: false }),
    exposureByType: t.field({ type: [BookBucket], nullable: false }), // $ millions by property type
    ltvDistribution: t.field({ type: [BookBucket], nullable: false }),
    scoreDistribution: t.field({ type: [BookBucket], nullable: false }), // loan count by score band
  }),
});
