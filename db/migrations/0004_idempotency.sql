-- Seam · migration idempotency ledger · #15
-- applied_migrations records every applied file + its sha256 so the runner (migrate.ts)
-- never re-applies a file and throws MigrationChecksumMismatch if a previously-applied
-- file's bytes changed under it — making the schema an auditable, immutable, replayable
-- artifact (you add a new numbered migration, you never edit an applied one).
create table if not exists applied_migrations (
  filename text primary key,
  applied_at timestamptz not null default now(),
  checksum text not null
);
