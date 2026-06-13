// GraphQL query documents — fields pinned to the #20 SDL · #24
// Operation names + fields MUST match the committed Pothos schema (api/schema.graphql). queries.test
// parses these and asserts every selected field exists in the SDL snapshot so a schema rename fails
// the build rather than silently returning null. Money fields are BigIntStr (decoded to bigint at
// the client boundary, never a JS number). collateralType is NOT in the SDL — the CRE/RESIDENTIAL
// seam is derived client-side from the seed loan id (see lib/collateral.ts), so it is not selected.

// #24 the marketplace query: the loan-tape read shape (principal/rate + mortgage ratios + status).
export const LOANS_QUERY = /* GraphQL */ `
  query Loans {
    loans {
      id
      principal
      subscribed
      ratePerSecond
      ltvBps
      dscrBps
      status
      dataRoomUri
    }
  }
`;

// #70 the warehouse ranked book (score desc, paginated), proxied through the API (#64). The score +
// its four contributions make the ranking auditable; weights ship so the UI can show what drives it.
export const BOOK_QUERY = /* GraphQL */ `
  query Book($limit: Int!, $offset: Int!) {
    book(limit: $limit, offset: $offset) {
      weights { credit ret duration portfolio }
      total
      loans {
        loanId
        principal
        ltvBps
        dscrBps
        couponBps
        termMonths
        state
        propertyType
        originator
        tokenized
        score
        creditScore
        returnScore
        durationScore
        portfolioScore
      }
    }
  }
`;

// #72 book-level analytics — totals + concentration + the LTV distribution (#64).
export const BOOK_ANALYTICS_QUERY = /* GraphQL */ `
  query BookAnalytics {
    bookAnalytics {
      total
      tokenized
      totalPrincipalM
      tokenizedPrincipalM
      avgLtvBps
      avgDscrBps
      avgCouponBps
      exposureByType { label count }
      scoreDistribution { label count }
      ltvDistribution { label count }
    }
  }
`;

// #24 the position dashboard query (per holder). principal is the token balance; accrued/claimable
// mirror on-chain interest. Positions are the indexer-projected read model (#66 removed the
// optimistic pre-confirmation row — a fresh invest appears within a block + an index cycle).
export const POSITIONS_QUERY = /* GraphQL */ `
  query Positions($holder: Address!) {
    positions(holder: $holder) {
      id
      loanId
      holder
      principal
      accrued
      claimable
    }
  }
`;
