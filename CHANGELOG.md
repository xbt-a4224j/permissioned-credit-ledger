# [1.9.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.8.0...v1.9.0) (2026-06-13)


### Features

* **recon:** reserve as an append-only ledger of record ([#82](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/82)) ([85595d9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/85595d930eccc1ba39ff8ffbd3f80d2488811ebc))

# [1.8.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.7.0...v1.8.0) (2026-06-13)


### Features

* **warehouse:** tokenized-subset servicing drives the reserve, halt-gated ([#80](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/80)) ([27c34c6](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/27c34c606cf8c1ffb16c3f7311ee3846e7045375))

# [1.7.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.6.0...v1.7.0) (2026-06-13)


### Features

* **ui:** role-aware yield — net investor yield + expected distributions ([#81](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/81)) ([54550e8](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/54550e89baec340ba31819ebb98f75398eafc724))

# [1.6.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.5.0...v1.6.0) (2026-06-13)


### Features

* **ui:** origination tab — ranked book, one-click tokenize, analytics, live feed ([ba4815e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/ba4815ea2f99d4f943507abfc718eefa874c7199)), closes [#7](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/7) [#69](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/69) [#70](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/70) [#71](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/71) [#72](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/72)

# [1.5.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.4.0...v1.5.0) (2026-06-13)


### Features

* **api:** warehouse client + GraphQL book/analytics surface ([#63](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/63) [#64](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/64)) ([e39c4e1](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e39c4e14e1e41652bb1146b9053de186ef636d01))

# [1.4.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.3.0...v1.4.0) (2026-06-13)


### Features

* **api:** tokenizeLoan — real on-chain CreditToken deploy from the warehouse ([#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66) [#67](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/67) [#68](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/68)) ([eac0ee4](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/eac0ee43d3587f77350fb25313c772e283a7f8ae)), closes [#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75) [#7](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/7)
* **indexer:** db-driven watched-token set + runtime-token refresh ([#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75)) ([6fa8987](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6fa89871b6ff8f6a0558d59addca39a84a5532b9)), closes [#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66)

# [1.3.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.2.0...v1.3.0) (2026-06-12)


### Features

* **warehouse:** live servicing feed — generator, SSE stream, rolling KPIs ([#60](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/60) [#61](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/61) [#62](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/62)) ([2b73401](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/2b73401fecde4812a8b3fb06863c2f2aa931f4a9))

# [1.2.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.1.1...v1.2.0) (2026-06-12)


### Features

* **warehouse:** ranked book + analytics REST endpoints ([#57](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/57) [#58](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/58)) ([c8fee1d](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/c8fee1df57831c3d8034a16826cf3dcce922937f))
* **warehouse:** transparent weighted scoring engine ([#54](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/54) [#55](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/55) [#56](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/56)) ([173100a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/173100a23e7acb4666d796399a331a175d681547))

## [1.1.1](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.1.0...v1.1.1) (2026-06-12)


### Bug Fixes

* **ui:** badge accepts onClick prop + eslint-ignore warehouse build ([82e1173](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/82e11732b8a003164372c3fed185b07f50148af4))

# [1.1.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.0.1...v1.1.0) (2026-06-12)


### Features

* **warehouse:** deterministic ~10k CRE book generator ([#52](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/52)) ([f2cd5cb](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f2cd5cbdd18b5c4633b7c08e3edaa5537bf93f65))
* **warehouse:** mirror the on-chain loans into wh_book as the tokenized tip ([#53](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/53)) ([a8fc000](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a8fc0008629dbb9da02b4f95d961e155d60d5b55))
* **warehouse:** scaffold Spring Boot sidecar on 47100 + dev wiring ([#51](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/51)) ([e6ccf6f](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e6ccf6f24d4a8ea4df0042fe60389be06b0e3ef1))
* **warehouse:** wh_* read-model tables via Boot SQL init, shared pcl Postgres ([#74](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/74)) ([fc42858](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/fc42858882b691ac61c6842f41133f614da66e6e))

## [1.0.1](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.0.0...v1.0.1) (2026-06-12)


### Bug Fixes

* **contracts:** correct token symbol typo CRDTatus -> CRDT ([99445ec](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/99445ec57bc10c0586c351db37b86be6cecd147c))

# 1.0.0 (2026-06-12)


### Bug Fixes

* **api:** accrual ticker anchors on wall-clock, not block-number opened_at (was buried in $178k) ([66620c2](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/66620c268a29a53c7626ab08200fbb815bfc3e99))
* **api:** accrual ticker gates on PERFORMING, no phantom yield on a non-performing loan ([865e5a9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/865e5a9a25ebbe4d9810208cbaec8eabe1e612b1))
* **api:** add CORS header to /sse — browser at :51730 was silently blocked from :41990 ([39f68c1](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/39f68c1a25b7728f3070c70c1f917e1e5c9a1634))
* **api:** invest rejects over-subscription beyond a loan's principal ([f3b630a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f3b630a3558bca0e7ef920c3982eb09d5a4d6691))
* **api:** kyc verify mirrors the on-chain claim into the off-chain identities read-model ([518e27a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/518e27a73ad4bf38d5dbcc3999059c7d943574f1))
* **api:** reserve.totalClaimable reads the engine snapshot, not the dead accrued sum ([4356817](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/4356817155a8c8476e26ee40af5beb7741c18f8c))
* **contracts:** exclude halted window from resumed accrual ([158830e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/158830ec28c228beeb3929b358d446490882c76a))
* **contracts:** frozen holder = complete lockout — add sender-freeze to gauntlet ([74c88d5](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/74c88d5b330b4f94d208ea15f14bfa09e4aaedf5))
* **indexer:** ingest never crashes on a duplicate (block_number, log_index) ([89c362a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/89c362a8a1d53170bf53ce0b90069170be10cdf5))
* **recon:** make canonical replay fingerprint deployment-stable ([a4eb548](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a4eb54808d201472c1fc99d5813808ef25a4434d)), closes [#19](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/19)
* **recon:** make the running app demoable end-to-end ([#32](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/32)–[#37](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/37)) ([d825aaf](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/d825aaf4f72c16ea9b631acaf5148562d1383c33)), closes [#33](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/33) [#34](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/34) [#35](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/35) [#36](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/36)
* **recon:** merge fix/demo-readiness — demo-readiness fixes ([#32](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/32)–[#37](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/37)) ([72f4b5c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/72f4b5c31893c23e7fa4a068a0add67eb6361940))
* **recon:** seed reserve to mirror on-chain funding; 1s blocks; live block counter ([fa02ffb](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/fa02ffb0d64aa416cdb6663a24d79507c786abf9))
* **scripts:** bring infra up before the dev test gate ([781fd82](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/781fd8200a3658fb8303292a9bb1c736318a27d5)), closes [#31](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/31)
* **scripts:** prove SenderFrozen on-chain — stale ABIs + an unreachable row 4 ([f30469e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f30469e80e6b32bf7c9326d793e160549d932694))
* **scripts:** revert anvil --block-time (seeded accrual vs empty reserve auto-halted recon) ([4b4a0a7](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/4b4a0a79ca7e96fd58f6a3f02f3e03bd424892bc))
* **types:** senderFrozen joins the exhaustive ReasonCode switch ([92cc3db](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/92cc3dbc5bd28092517d94cba796380ddd226959))
* **ui:** demo polish — pre-select identity, bigger ticker, tagline, 4-decimal accrual ([6496f4b](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6496f4b31f58c7c4fb000c28633e993be6105b41))
* **ui:** health panel stuck on connecting — seed recon status via fetch, share one stream ([638c47f](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/638c47f378f0a44809d373a16fd26940e87cf77d))
* **ui:** invest dialog shows why it reverted, not a bare "Reverted" ([2cd7dc7](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/2cd7dc789093b15eb412d11f3b8e00882dcee758))
* **ui:** relabel signing phase to 'Submitting…' — server signs, no browser wallet ([1333950](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/133395092c6ee2890fff5350eca6c3a9ebc41a1c))
* **ui:** show 2 decimal places in fmtUsd6 so accrual ticker is visible ([bc36ff4](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/bc36ff426ca3e9674e573e017a8e837b9233fc9c))
* **ui:** skip ensureChain for demo (invest hang); 1s blocks; LTV/DSCR titles; README diagram ([16c9ba5](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/16c9ba57b5282dd64ba994bf31dc62f435af24eb))
* **ui:** sse CORS header; claimable resets after claim; remove mystery $0 from claim panel ([491caf8](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/491caf852f26df36932934c6177dcd4f2612332f))
* **ui:** sticky-footer layout so the lifecycle strip pins to the page bottom ([#40](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/40)) ([7ad5452](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/7ad54522dd3fd492561caa16b93386c43449cb57))
* **ui:** surface the clean GraphQL error message, not the ClientError JSON dump ([bf6c2ff](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/bf6c2ffeffe3e7ac6d561100a5c611ce2ca7f9df))


### Features

* **api:** add GraphQL schema (Pothos code-first) ([a92f98b](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a92f98b009537ef265027c53fd0cd5e942efabda)), closes [#20](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/20)
* **api:** add SSE live feed — accrual + recon status ([0874f0c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/0874f0ca41e41b7fd8af8f22b607fe6288e770af)), closes [#22](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/22)
* **api:** block investing into a matured (DEFAULT) loan + hide its invest button ([1294de8](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/1294de8601d2a44d4ea6a132ea77bae6ff8ed305)), closes [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46) [#5](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/5) [#48](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/48)
* **api:** kyc onboarding — mock provider, verdict writes on-chain claim ([#39](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/39)) ([1070b66](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/1070b666245a8228596be5c5ff03664136878272))
* **api:** loans ops view — navReadings query, submitNav/reportCash, LoanOpsCard ([#38](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/38)) ([0e27c2f](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/0e27c2fa654915eb5b56c2b2e497376617b9a1be))
* **api:** surface each series' unsubscribed capacity on the loan card ([c6f89f6](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/c6f89f6920abae41ca4a120368b7fbbbebebfe67)), closes [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46) [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46)
* **api:** tx-status tracking + optimistic position ([91fe14e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/91fe14eb1260d849d8fafc887d00af9b3a923212)), closes [#23](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/23)
* **api:** wire resolvers to chain + reconciliation ([49dc52a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/49dc52ad5e22b00c703455535b278f8d930db8b5)), closes [#21](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/21) [#16](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/16) [#18](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/18)
* **contracts:** accrual + reentrancy-safe claim ([c66bfa9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/c66bfa9dd567ade505dfeef5016d7c6ab0532a0b))
* **contracts:** add ComplianceRegistry — Reg D/S rules ([cd46c4c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/cd46c4c24dc78e582284d9aca5aed1778051a158))
* **contracts:** add CreditToken — ERC-3643-lite permissioned transfer ([4a667e3](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/4a667e38089a0062b2380258e221a3fa27428295))
* **contracts:** add IdentityRegistry — claims + eligibility ([1f12a48](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/1f12a48aa3edd61ecd5ca2954c266857fd1f1083))
* **contracts:** cap issuance at the loan principal on-chain (ExceedsPrincipal) ([4a22c0d](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/4a22c0d3064c2f85437e00bc4b9a56e4a0d5aa37)), closes [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46)
* **contracts:** interfaces + custom error taxonomy ([9197133](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/91971333312080f2f73e1c00416909137b1acc09))
* **db:** postgres read-model schema + numbered raw sql migrations ([2c818d9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/2c818d95516bbacba2fc82492897a4744567ea6a))
* **deploy:** add Deploy.s.sol + seed identities & mortgages ([8ac93c9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/8ac93c90c5ff8e22284c725cbc58daafdbd9883f))
* **indexer:** index IdentityRegistry ClaimsUpdated — KYC events in the feed ([ee5ad2c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/ee5ad2cd911542a9173bb6e757c8952acfbafb5c)), closes [#47](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/47)
* **indexer:** seed a par NAV baseline per loan in the live demo boot ([4a944ca](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/4a944ca2e416a14f7a3083fff63f9d521c298a22))
* **indexer:** viem CreditToken indexer with idempotent event projection ([6638921](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/66389212f3bfe8a24829e78406ad8ef3650a252c))
* merge build — all 31 tickets shipped, 53+117 tests green, 10/10 matrix ([2d35b76](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/2d35b760befe23fd46095daa5430ff260cbcde73))
* **nav:** a corrective NAV mark clears the freeze — no world reset needed ([f5db7c9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f5db7c907c294980c07c91e76b448e315f602d26)), closes [#49](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/49)
* **nav:** off-chain NAV feed + validation gate with NavAnomaly halt ([87ca10e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/87ca10e546da94085fcfba6b47159e4dc148f1fc))
* **recon:** deterministic replay + keccak state hash with interleaving property ([0f3b5d1](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/0f3b5d19244159aed5294119edf0404d95c1b5a1))
* **recon:** reconciliation engine with 4 invariants + ReconMismatch halt ([603ca89](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/603ca897cd1628b643d05c7257a346860a915b48))
* **scripts:** idempotent port-safe dev script (stop -> test -> start) ([a37458f](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a37458fbbbc3a1d10b9f933e3744cc25d453556c))
* **scripts:** live chain tailer — blocks + decoded events in the terminal ([3205f30](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/3205f3047899398ef13ef92543341ad9a47c5657))
* **scripts:** scenario-matrix verifier ([f4b3948](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f4b394887ebc7daac842307faf925a509f14e24e))
* **types:** shared domain types + zod schemas with branded ids ([c50c7b5](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/c50c7b5fba082ca8d988f2b7d607ea297bef5d75))
* **ui:** action log — log + display every user/product action; /log + /logs endpoints ([#39](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/39)) ([fa2e2f9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/fa2e2f9a714a7d05bca5e58eeb30d9f6a639352e))
* **ui:** chain activity panel — live block counter + event log; anvil block-time 2s ([#39](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/39)) ([e203b83](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e203b83b1174ccc9ae8a78bac09ce9b3af67ac97))
* **ui:** invest + claim flow with wallet ([47d319e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/47d319e031edcb67c78209f191a9f8c8a2ac5ac2))
* **ui:** lifecycle strip — end-to-end sequence footer on every view ([#40](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/40)) ([96bf28b](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/96bf28b28762ea8c831856093c6a9870c7804f78))
* **ui:** marketplace + position dashboard ([6ed336c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6ed336ca365c70d4704633064b8260f66fb81558))
* **ui:** poll reserve every 2s so the Claimable stat ticks live ([09be489](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/09be489b3de7f643e6a4213ff691ef7aeffadf21)), closes [#45](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/45)
* **ui:** reconciliation / health panel ([6bbeeac](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6bbeeac6798d88b04756b5222606fd5c25ed03b8))
* **ui:** tranche waterfall visualizer — additive structuring module ([#42](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/42)); fix stale web tests ([46f6622](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/46f6622723c9365eac92221b47635e15d579fee5))
