-- #66 drop optimistic_positions — the pre-confirmation position cache is gone. Positions are now
-- sourced solely from the indexer-projected `positions` read model: a fresh invest appears within a
-- block + an index cycle (fast enough that the optimistic placeholder, and the convergence machinery
-- it required, weren't earning their complexity). The tx lifecycle keeps its PENDING->CONFIRMED
-- tracking in tx_status; only the position projection is simplified to one source of truth.
drop table if exists optimistic_positions;
