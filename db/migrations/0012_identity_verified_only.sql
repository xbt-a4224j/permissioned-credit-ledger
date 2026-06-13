-- #66 collapse the identity read model to verified-only. The compliance model dropped the
-- accreditation / jurisdiction / sanctions-freeze claims (the ComplianceRegistry is gone); the
-- recon I4 invariant now reads `verified` alone, and the ClaimsUpdated event carries only `verified`.
-- Drop the now-unused columns so the read model matches the on-chain claim set exactly.
alter table identities drop column if exists accredited;
alter table identities drop column if exists jurisdiction;
alter table identities drop column if exists frozen;
