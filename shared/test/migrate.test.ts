// Seam · #15 migration runner coverage against a throwaway Postgres.
// Proves: exactly 8 tables created, idempotent re-run, checksum immutability, numeric(78,0)
// precision round-trip > 2^53, and chain_events (block_number, log_index) uniqueness — the
// DB-level guarantees the indexer (#16) and recon engine (#18) build on.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeSql, type Sql } from "../src/db/client.ts";
import { applyMigrations, MigrationChecksumMismatch } from "../src/db/migrate.ts";
import { createThrowawayDb, dropThrowawayDb } from "./db.helper.ts";

describe("applyMigrations against a fresh database", () => {
  let sql: Sql;
  let dbName: string;

  beforeAll(async () => {
    const { name, url } = await createThrowawayDb("pcl_migtest");
    dbName = name;
    sql = makeSql(url);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
    await dropThrowawayDb(dbName);
  });

  test("creates the read-model tables (7 read models + properties + applied_migrations + cursor)", async () => {
    const first = await applyMigrations(sql);
    expect(first.applied.length).toBeGreaterThanOrEqual(4); // >=4 migration files

    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `;
    const names = tables.map((t) => t.table_name);
    // 7 read models (loans, identities, positions, chain_events, nav_readings, reserve,
    // recon_status) + properties (mortgage modeling) + applied_migrations + indexer_cursor (#16)
    // + the tx-tracking tables tx_status + optimistic_positions (#23 GraphQL tx lifecycle).
    expect(names).toEqual(
      [
        "applied_migrations",
        "chain_events",
        "identities",
        "indexer_cursor",
        "loans",
        "nav_readings",
        "optimistic_positions",
        "positions",
        "properties",
        "recon_status",
        "reserve",
        "tx_status",
      ].sort(),
    );
  });

  test("is idempotent: a second run applies 0 files", async () => {
    const second = await applyMigrations(sql);
    expect(second.applied).toEqual([]);
  });

  test("numeric(78,0) round-trips a value > 2^53 as an identical bigint", async () => {
    // a property + loan first (FK), then assert the principal survives.
    const big = 10n ** 24n; // 1e24 >> 2^53
    // numeric(78,0) accepts the decimal-free string form; it parses back to bigint on read.
    const bigStr = big.toString();
    await sql`insert into properties (id, address_label, appraised_value, lien_position) values ('900', 'Test', ${bigStr}, 1)`;
    await sql`
      insert into loans (id, principal, rate_bps, status, started_at, collateral_type, property_id, ltv_bps, dscr_bps)
      values ('900', ${bigStr}, 850, 'PERFORMING', 1, 'CRE', '900', 6500, 14000)
    `;
    const [row] = await sql<{ principal: bigint; appraised_value: bigint }[]>`
      select principal, appraised_value from loans join properties on loans.property_id = properties.id where loans.id = '900'
    `;
    expect(row?.principal).toBe(big);
    expect(typeof row?.principal).toBe("bigint");
    expect(row?.appraised_value).toBe(big);
  });

  test("chain_events rejects a duplicate (block_number, log_index)", async () => {
    await sql`insert into chain_events (id, name, block_number, log_index, payload) values ('0xaa:0', 'Transfer', 7, 0, '{}'::jsonb)`;
    // same (block_number, log_index), different pk -> unique violation.
    await expect(
      sql`insert into chain_events (id, name, block_number, log_index, payload) values ('0xbb:9', 'Transfer', 7, 0, '{}'::jsonb)`,
    ).rejects.toThrow();
  });
});

// #15 immutability: editing an already-applied migration file then re-running throws.
test("MigrationChecksumMismatch when an applied file's bytes change", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pcl-mig-"));
  const file = join(dir, "0001_one.sql");
  writeFileSync(file, "create table t1 (id int primary key);\n");

  const { name, url } = await createThrowawayDb("pcl_checksum");
  const sql = makeSql(url);
  try {
    const first = await applyMigrations(sql, dir);
    expect(first.applied).toEqual(["0001_one.sql"]);

    // re-edit the applied file (forbidden) and re-run.
    writeFileSync(file, "create table t1 (id int primary key, extra text);\n");
    await expect(applyMigrations(sql, dir)).rejects.toBeInstanceOf(MigrationChecksumMismatch);
  } finally {
    await sql.end({ timeout: 5 });
    await dropThrowawayDb(name);
    rmSync(dir, { recursive: true, force: true });
  }
});
