-- On-Chain Layer · indexer resume cursor · #16
-- Single-row (id=1) last-fully-processed block. On boot the indexer backfills via getLogs from
-- cursor -> latest, then watches the live tail; persisting the cursor makes a dropped
-- connection recoverable (resume from here), not corrupting. block_number is the highest block
-- whose logs are fully ingested + projected.
create table if not exists indexer_cursor (
  id int primary key default 1 check (id = 1),
  block_number bigint not null,
  updated_at timestamptz not null default now()
);
