-- #74 warehouse read models — the wh_* tables the Java sidecar owns. Share the TS stack's Postgres
-- instance (pcl), but a distinct prefix + Flyway history table (wh_flyway_history) so the two
-- migration systems never collide. Money as numeric(20,2); no ORM — raw SQL, like the TS side.

-- the originator's full loan book (~10k rows, #52). The 6 on-chain loans also appear here flagged
-- tokenized (#53) — the warehouse knows the tokenized tip; it does not own it.
create table if not exists wh_book (
    loan_id          text primary key,
    principal        numeric(20, 2) not null,
    ltv_bps          int            not null,
    dscr_bps         int            not null,
    coupon_bps       int            not null,
    origination_date date           not null,
    maturity_date    date           not null,
    state            text           not null, -- US state (concentration)
    msa              text           not null, -- metro area (concentration)
    property_type    text           not null, -- CRE subtype / RESIDENTIAL
    originator       text           not null,
    seasoning_months int            not null,
    tokenized        boolean        not null default false,
    token_address    text
);
create index if not exists idx_wh_book_state on wh_book (state);
create index if not exists idx_wh_book_tokenized on wh_book (tokenized);

-- #55 the transparent weighted score + its per-family contributions (so the UI can show what
-- informs the ranking). One row per loan, recomputed when weights or the tokenized set change.
create table if not exists wh_loan_scores (
    loan_id         text primary key references wh_book (loan_id) on delete cascade,
    score           numeric(6, 2)  not null, -- composite 0-100
    credit_score    numeric(6, 2)  not null,
    return_score    numeric(6, 2)  not null,
    duration_score  numeric(6, 2)  not null,
    portfolio_score numeric(6, 2)  not null,
    computed_at     timestamptz    not null default now()
);
create index if not exists idx_wh_scores_score on wh_loan_scores (score desc);

-- #60 the servicing event stream (payments, NAV marks, delinquency flips) across the whole book.
create table if not exists wh_servicing_events (
    id          bigserial primary key,
    loan_id     text         not null references wh_book (loan_id) on delete cascade,
    kind        text         not null,
    amount      numeric(20, 2),
    occurred_at timestamptz  not null default now(),
    payload     jsonb
);
create index if not exists idx_wh_events_occurred on wh_servicing_events (occurred_at desc);
