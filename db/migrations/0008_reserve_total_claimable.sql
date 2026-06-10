-- Money/Seam Layer · reserve.total_claimable — the engine-snapshotted aggregate claimable · #45
-- positions.accrued is event-projected and only moves on InterestClaimed (on-chain accrual is a
-- time-based view; it emits nothing for the indexer to project), so sum(positions.accrued) reads
-- 0 forever while interest accrues — it is NOT the live aggregate claimable. Each recon cycle
-- (#18) already reads per-holder claimable() live from the chain; this column persists that
-- snapshot total so the GraphQL reserve surface (and the Servicing panel + the demo cash-shortfall
-- trigger built on it) shows the same number the I2 gate evaluates, at most one cycle stale.
alter table reserve
  add column if not exists total_claimable numeric(78, 0) not null default 0;
