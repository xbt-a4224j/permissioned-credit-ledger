// Money Layer (presentation) · GraphQL query documents — fields pinned to the #20 SDL · #24
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
      ratePerSecond
      ltvBps
      dscrBps
      status
      dataRoomUri
    }
  }
`;

// #24 the position dashboard query (per holder). principal is the token balance; accrued/claimable
// mirror on-chain interest; optimistic flags a pre-confirmation row (#23).
export const POSITIONS_QUERY = /* GraphQL */ `
  query Positions($holder: Address!) {
    positions(holder: $holder) {
      id
      loanId
      holder
      principal
      accrued
      claimable
      optimistic
    }
  }
`;
