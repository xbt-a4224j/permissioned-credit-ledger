-- #82 reserve_ledger — the reserve as an append-only ledger of record. Every credit (servicing
-- collections in, initial funding) and debit (interest claims out) is a row; reserve.balance is kept
-- as a maintained cache equal to the running sum, so the recon read path (snapshot.ts reads
-- reserve.balance) is unchanged and the matrix is unaffected. This makes "show me every dollar in and
-- out of the reserve" a query, and aligns the reserve with the repo's event-sourced model (chain
-- events + replay) instead of a single mutable balance.
create table if not exists reserve_ledger (
    id         bigserial primary key,
    entry_type text           not null check (entry_type in ('credit', 'debit')),
    amount     numeric(78, 0) not null check (amount >= 0), -- base units (USDC e6); signed by entry_type
    reason     text           not null,                     -- 'initial funding' | 'interest claim' | 'servicing collection' | 'operator report'
    loan_id    text,                                         -- the loan a servicing/claim entry relates to (null for global ops)
    balance_after numeric(78, 0),                            -- the running balance after this entry, for a readable audit trail
    created_at timestamptz    not null default now()
);
create index if not exists idx_reserve_ledger_created on reserve_ledger (created_at desc);
