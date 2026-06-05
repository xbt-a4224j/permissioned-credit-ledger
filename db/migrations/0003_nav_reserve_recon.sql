-- Money/Seam Layer · NAV feed + reserve + reconciliation status · #15
-- nav_readings is the bounded off-chain NAV feed the gate (#17) writes (accepted/rejected);
-- reserve is the single-row mock-USDC balance recon conservation reads; recon_status is the
-- per-cycle verdict the marquee engine (#18) appends, carrying the typed HALT state + the
-- deterministic state_hash (#19) so live recon and a cold replay share one fingerprint.

-- #15 nav_readings: append-only NAV/servicing marks. accepted=false rows carry reject_reason
-- (the typed NavRejectReason). The gate (#17) compares against the last ACCEPTED row only.
create table if not exists nav_readings (
  id bigserial primary key,
  loan_id text references loans (id),
  nav_bps int not null,
  observed_at bigint not null,
  source text not null,
  accepted boolean not null,
  reject_reason text
);

-- #15 reserve: single-row (id=1) mock-USDC balance, numeric(78,0) base units.
create table if not exists reserve (
  id int primary key default 1 check (id = 1),
  balance numeric(78, 0) not null,
  updated_at bigint
);

-- #15 recon_status: one row per reconciliation cycle. ok=false rows name the failed
-- invariant + the typed engine state ('NavAnomaly' for I3, else 'ReconMismatch'). state_hash
-- is the replay fingerprint (#19); detail is the offending values (jsonb) for the UI.
create table if not exists recon_status (
  cycle_id bigserial primary key,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  state text check (state in ('NavAnomaly', 'ReconMismatch')),
  failed_invariant text,
  state_hash text not null,
  detail jsonb
);
