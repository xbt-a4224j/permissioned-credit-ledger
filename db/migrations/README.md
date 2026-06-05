# db/migrations · #15

Numbered, raw SQL migrations for the off-chain read models (no ORM). Applied on startup by
`applyMigrations` (`shared/src/db/migrate.ts`).

## Rules

- **Numbered, lexicographic order.** `NNNN_name.sql` (`0001_`, `0002_`, …). Lexicographic sort
  == apply order. Never reorder.
- **Immutable once applied.** Never edit a migration that has run anywhere — `applyMigrations`
  records each file's `sha256` in `applied_migrations` and throws `MigrationChecksumMismatch`
  if a previously-applied file's bytes change. To change the schema, **add a new numbered
  file**.
- **Money is `numeric(78,0)`.** Scale 0, integer base units (uint256-wide). The client
  (`client.ts`) parses it to a native `bigint` so a `Usdc6` (#14) never sees a decimal point —
  the guard against phantom `ReconMismatch` (#18).
- **Idempotent.** Re-running applies 0 files and is a no-op.

## Tables

| Migration | Tables |
|---|---|
| `0001_init.sql` | `properties`, `loans`, `identities` |
| `0002_positions_events.sql` | `positions`, `chain_events` |
| `0003_nav_reserve_recon.sql` | `nav_readings`, `reserve`, `recon_status` |
| `0004_idempotency.sql` | `applied_migrations` |
| `0005_indexer_cursor.sql` | `indexer_cursor` (#16) |
