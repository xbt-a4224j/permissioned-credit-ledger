// Numbered raw-SQL migration runner (no ORM) · #15
// applyMigrations reads db/migrations/*.sql in lexicographic order, applies each unseen file
// inside its own transaction, and records filename + sha256 in applied_migrations. Re-running
// is a no-op (0 files applied). If a PREVIOUSLY-applied file's bytes changed, it throws
// MigrationChecksumMismatch rather than silently diverging — the immutability rule that keeps
// the read-model schema an auditable, replayable artifact. Applied on startup by the indexer
// (#16) and the recon harness (#18).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { Sql } from "./client.ts";

// #15 thrown when an applied migration's bytes change under us (never edit; add a new file).
export class MigrationChecksumMismatch extends Error {
  constructor(
    readonly filename: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`migration ${filename} changed after being applied (checksum ${expected} -> ${actual})`);
    this.name = "MigrationChecksumMismatch";
  }
}

// #15 repo db/migrations dir, resolved from this file's location (shared/src/db ->
// ../../../db/migrations). Uses import.meta.url + fileURLToPath so it resolves identically
// under Bun and under Vitest's loader (import.meta.dir is Bun-only).
const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, "..", "..", "..", "db", "migrations");

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// #15 ensure the ledger table exists before we read it (bootstraps from a bare database;
// the same DDL also ships as 0004 so a fresh apply records itself).
async function ensureLedger(sql: Sql): Promise<void> {
  await sql`
    create table if not exists applied_migrations (
      filename text primary key,
      applied_at timestamptz not null default now(),
      checksum text not null
    )
  `;
}

// #15 a fixed key for the migration advisory lock. dev.sh starts the indexer and api
// concurrently and both run applyMigrations against a fresh DB; without serialization their
// `create table if not exists applied_migrations` race on the pg_type catalog (23505), and the
// apply loop could double-run a file. A session advisory lock makes the second migrator wait,
// then find every file already recorded and skip it.
const MIGRATION_LOCK_KEY = 4_815_162_342;

export async function applyMigrations(sql: Sql, migrationsDir: string = MIGRATIONS_DIR): Promise<{ applied: string[] }> {
  // #15 dev.sh starts the indexer and api concurrently and both run this against a fresh DB; without
  // serialization their `create table if not exists applied_migrations` race on the pg_type catalog
  // (23505) and the apply loop can double-run a file. A pg_advisory_lock is session-scoped, so it
  // must be held on a single pinned connection — reserve one out of the pool (max: 8) purely to hold
  // the lock, and run the migration work on the pooled `sql` (which, unlike a reserved connection,
  // supports `.begin` for the per-file transactions). The lock still serializes the two processes:
  // the second to arrive blocks on pg_advisory_lock until the first releases, then finds every file
  // already recorded and skips it.
  const lockConn = await sql.reserve();
  try {
    await lockConn.unsafe(`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
    try {
      return await applyMigrationsLocked(sql, migrationsDir);
    } finally {
      await lockConn.unsafe(`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
    }
  } finally {
    lockConn.release();
  }
}

async function applyMigrationsLocked(sql: Sql, migrationsDir: string): Promise<{ applied: string[] }> {
  await ensureLedger(sql);

  // #15 lexicographic order == numeric order given the 0001_/0002_ prefixes.
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const rows = await sql<{ filename: string; checksum: string }[]>`
    select filename, checksum from applied_migrations
  `;
  const seen = new Map(rows.map((r) => [r.filename, r.checksum]));

  const applied: string[] = [];
  for (const filename of files) {
    const bytes = readFileSync(join(migrationsDir, filename));
    const checksum = sha256(bytes);
    const prior = seen.get(filename);

    if (prior !== undefined) {
      // #15 immutability check: a re-edited applied migration is a hard error.
      if (prior !== checksum) throw new MigrationChecksumMismatch(filename, prior, checksum);
      continue; // already applied, bytes unchanged -> skip
    }

    // #15 apply the file + record it atomically so a crash never leaves a half-applied,
    // unrecorded migration (the read model would then silently lie to recon).
    await sql.begin(async (tx) => {
      await tx.unsafe(bytes.toString("utf8"));
      await tx`insert into applied_migrations (filename, checksum) values (${filename}, ${checksum})`;
    });
    applied.push(filename);
  }

  return { applied };
}
