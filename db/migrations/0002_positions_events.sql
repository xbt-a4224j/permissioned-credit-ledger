-- On-Chain Layer mirror · positions + the append-only chain-event log · #15
-- positions are the holder stakes the recon I2 (#18) bounds by collected cash; chain_events
-- is the canonical, append-only input deterministic replay (#19) folds. Its (block_number,
-- log_index) uniqueness is the DB-level idempotency the indexer (#16) leans on so a reorg or
-- double-delivered log is a no-op, never a double-count.

-- #15 positions: one row per (loan, holder). accrued is the off-chain mirror of on-chain
-- claimable. unique(loan_id, holder) enforces single-position-per-holder-per-loan.
create table if not exists positions (
  id text primary key,
  loan_id text references loans (id),
  holder text references identities (addr),
  principal numeric(78, 0) not null default 0,
  accrued numeric(78, 0) not null default 0,
  opened_at bigint,
  unique (loan_id, holder)
);

-- #15 chain_events: id is the canonical `txHash:logIndex` (#14 EventId). The
-- unique(block_number, log_index) + the pk are BOTH idempotency keys the indexer upserts on.
-- payload is the typed event body (jsonb) the replay reducer (#19) re-decodes.
create table if not exists chain_events (
  id text primary key,
  name text not null,
  block_number bigint not null,
  log_index int not null,
  payload jsonb not null,
  ingested_at timestamptz not null default now(),
  unique (block_number, log_index)
);

-- #15 the canonical replay ordering key: (block_number, log_index). Replay (#19) sorts by
-- this so any arrival interleaving folds to one canonical order -> one stateHash.
create index if not exists idx_chain_events_order on chain_events (block_number, log_index);
