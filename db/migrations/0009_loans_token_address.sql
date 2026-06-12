-- #75 token_address on loans — the on-chain CreditToken address for each loan series. The indexer
-- reads its watched-token set from this column (not the static manifest) so a loan tokenized at
-- runtime (#66) is picked up live, without a restart. The seeded 6 are backfilled from the manifest.
alter table loans add column if not exists token_address text;
create index if not exists idx_loans_token_address on loans (token_address);
