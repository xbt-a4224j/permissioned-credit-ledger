-- Asset Layer · loan-tape + identity read models · #15
-- The off-chain mirror of the on-chain world: loans (first-lien MORTGAGES) and the
-- identities the eligibility gauntlet (#7) and recon I4 (#18) read. Money is
-- numeric(78,0) integer base units (uint256-wide, scale 0) so it round-trips through
-- bigint/Usdc6 (#14) without a decimal point ever appearing. status/jurisdiction
-- checks mirror the on-chain enums exactly (CreditToken.LoanStatus, Jurisdiction).

-- #15 properties: the first-lien collateral a loan is a mortgage on. The mortgage-general
-- seam — CRE today, residential-ready (collateral_type lives on loans).
create table if not exists properties (
  id text primary key,
  address_label text not null,
  appraised_value numeric(78, 0) not null,
  lien_position int not null
);

-- #15 loans: principal+rate_bps drive on-chain accrual; collateral_type/property_id/
-- ltv_bps/dscr_bps are the mortgage modeling. status mirrors CreditToken.LoanStatus.
create table if not exists loans (
  id text primary key,
  principal numeric(78, 0) not null,
  rate_bps int not null,
  status text not null check (status in ('PERFORMING', 'DELINQUENT', 'DEFAULT')),
  started_at bigint not null,
  collateral_type text not null check (collateral_type in ('CRE', 'RESIDENTIAL')),
  property_id text references properties (id),
  ltv_bps int not null,
  dscr_bps int not null
);

-- #15 (mortgage modeling) query loans by collateral generality.
create index if not exists idx_loans_collateral_type on loans (collateral_type);

-- #15 identities: the claims the recon identity-valid invariant (I4, #18) re-checks.
create table if not exists identities (
  addr text primary key,
  verified boolean not null,
  accredited boolean not null,
  jurisdiction text not null check (jurisdiction in ('US', 'nonUS')),
  frozen boolean not null
);
