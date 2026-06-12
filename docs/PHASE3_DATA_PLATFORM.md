# Phase 3 — Origination Data Platform (Java/Spring Boot sidecar)

## Why

The chain holds the **tokenized deals**. An originator's real book is far larger. The data platform
models the **whole origination pipeline** (~10k loans), scores each loan for tokenization-worthiness
with a **transparent** model, and lets an operator **select a loan and tokenize it for real** —
deploying a new on-chain `CreditToken` that appears as the next loan in the Marketplace. The
warehouse is the funnel; the chain is the tip. It closes the loop: **data platform → decision →
on-chain action.**

## Architecture

- **`warehouse/` — Java 21 + Spring Boot (the brain).** Synthesizes + stores ~10k CRE bridge loans,
  computes a transparent weighted score, serves a ranked book (REST) and a live servicing feed (SSE).
  Owns its own tables in the **same Postgres instance** (`wh_*` tables). Port **47100**.
- **TS API (the hand).** Reads the ranked book; the `tokenizeLoan` mutation deploys a **real** new
  `CreditToken` via viem (forge artifacts + the existing signer), registers it, and marks the
  warehouse row tokenized. The **indexer becomes DB-driven** so the runtime-deployed loan is watched.
- **Web.** New top-level tab **"Origination"** beside Servicing/Health: ranked book with the
  score-breakdown columns, a per-row **Tokenize** button, book-level concentration analytics, and a
  live servicing ticker. Investor tabs (Marketplace, My positions) unchanged — the new loan simply
  appears as the next loan.

## Boundary / ownership

- **One Postgres instance, separate tables.** Java owns `wh_book`, `wh_loan_scores`,
  `wh_servicing_events`. TS keeps owning `loans`, `positions`, etc. They meet at exactly one seam:
  `tokenizeLoan` reads the selected `wh_book` row and writes the ledger `loans` row.
- **The existing seeded loans stay on-chain (TS, unchanged).** They also appear in `wh_book` flagged
  `tokenized=true` with matching attributes — the warehouse *knows about* the tokenized tip; it does
  not own it. Link = `loan_id` + `tokenized`. **No TS seed logic moves.**

## The score (transparent weighted composite)

Each feature normalized to 0–100, multiplied by a **visible weight**, summed to a 0–100 score. The
UI shows the per-feature contribution so "why does #1 rank above #2?" is answerable by pointing.

| Family | Features | Direction |
|---|---|---|
| Credit quality | LTV, DSCR | lower LTV / higher DSCR ↑ |
| Return | coupon spread vs benchmark | higher ↑ (risk-balanced) |
| Duration fit | maturity / remaining term | shorter ↑ (bridge self-liquidates) |
| Portfolio fit | geo / property-type / originator concentration vs the tokenized set | diversifying ↑ |

Portfolio-fit is **relative to what's already tokenized**, so the ranking shifts as you tokenize.

## Scope (headline = the tokenize loop; live feed included)

1. Java sidecar serving a ranked 10k book with score breakdown
2. New UI tab — ranked list, visible score columns, Tokenize button
3. **Real deploy:** click → new `CreditToken` on-chain → indexer watches it → **next loan in Marketplace**
4. Live servicing ticker (SSE) + book concentration analytics

## Releases & versioning (#77)

CI builds three independent surfaces — `forge` (contracts), `bun` (TS), `warehouse` (Gradle/Java,
against a Postgres service) — plus the `verify-matrix` e2e gate. Versioning is automatic via
semantic-release on push to `main`:

| Commit type | Version bump |
|---|---|
| `fix:` | patch (x.y.**z**) |
| `feat:` | minor (x.**y**.0) |
| `feat!:` / `BREAKING CHANGE:` | major (**x**.0.0) |
| `chore:` / `docs:` / `ci:` / `test:` / `refactor:` | no release |

Each push to `main` with release-worthy commits cuts a **git tag + GitHub Release + CHANGELOG entry**
(notes generated from the commits since the prior tag). **Convention: one release per completed
issue-block** — work the block's issues locally, then push the block as a unit so it lands as a
single coherent version.

## Ports

| Service | Port |
|---|---|
| Warehouse (Spring Boot) | **47100** |
| (existing) Postgres / anvil / API / Web | 55432 / 18545 / 41990 / 51730 |
