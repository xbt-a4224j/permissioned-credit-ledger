-- Money Layer · tx lifecycle + optimistic positions · #23
-- Fuji confirmations take seconds but invest/transfer/claim return on broadcast (#21), so the
-- API tracks PENDING -> CONFIRMED|REVERTED and writes an OPTIMISTIC position immediately, then
-- deletes it once the indexer (#16) has projected the canonical positions row at/after the tx's
-- block. The optimistic row is a UX convenience ONLY — it is excluded from every reconciliation
-- query (#18) so an un-settled invest can never trip a false ReconMismatch.

-- #23 one row per broadcast tx. reason_code is a decoded ReasonCode on REVERTED (matrix rows
-- 3-6, 8); block_number is the settling block (drives optimistic reconciliation).
create table if not exists tx_status (
  hash text primary key,
  kind text not null check (kind in ('invest', 'transfer', 'claim')),
  state text not null check (state in ('PENDING', 'CONFIRMED', 'REVERTED')),
  reason_code text,
  holder text,
  loan_id text,
  submitted_at timestamptz not null default now(),
  settled_at timestamptz,
  block_number numeric(78, 0)
);

-- #23 query PENDING txs (the confirmation watcher loop) + a holder's lifecycle rows.
create index if not exists idx_tx_status_state on tx_status (state);
create index if not exists idx_tx_status_holder_loan on tx_status (holder, loan_id);

-- #23 the optimistic position shown before the indexer catches up. Keyed by tx hash (cascade
-- delete with its tx_status row); strictly hash/block matched to its canonical counterpart so two
-- rapid invests on the same loan reconcile independently (never a (holder, loan) heuristic).
create table if not exists optimistic_positions (
  hash text primary key references tx_status (hash) on delete cascade,
  holder text not null,
  loan_id text not null,
  principal numeric(78, 0) not null,
  created_at timestamptz not null default now()
);

-- #23 fetch a holder's outstanding optimistic positions (merged into position(s), #21).
create index if not exists idx_optimistic_positions_holder_loan on optimistic_positions (holder, loan_id);
