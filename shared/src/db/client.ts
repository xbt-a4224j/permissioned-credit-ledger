// Raw Postgres client (no ORM) · #15
// One porsager `postgres` client configured so money survives the round trip. The LANDMINE
// (#15 notes): `numeric` comes back as a JS string by default and `BigInt('123.0')` throws,
// so we (a) keep every money column numeric(78,0) — scale 0, no decimal point — and (b)
// register a parser for the numeric OID (1700) that returns a native bigint. That is what
// lets the indexer (#16) and recon engine (#18) compare Usdc6 to Usdc6 with no phantom drift.

import postgres from "postgres";

export type Sql = postgres.Sql;

// #15 Postgres type OID for numeric/decimal. We parse it to bigint (safe because every
// money column is declared scale 0 — integer base units).
const NUMERIC_OID = 1700;

export function makeSql(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    // #15 deterministic, quiet client for tests + the indexer loop.
    max: 8,
    onnotice: () => {},
    types: {
      // #15 native bigint round-trip for uint256-wide money (numeric(78,0)).
      bigint: postgres.BigInt,
      // #15 parse numeric(78,0) -> bigint on read; serialize bigint -> string on write,
      // so a Usdc6 never becomes a lossy number or a decimal string.
      numeric: {
        to: NUMERIC_OID,
        from: [NUMERIC_OID],
        serialize: (v: bigint | string | number) => v.toString(),
        parse: (v: string) => BigInt(v),
      },
    },
  });
}
