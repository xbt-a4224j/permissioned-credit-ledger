## [1.11.6](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.11.5...v1.11.6) (2026-06-16)


### Bug Fixes

* **ci:** row 7 reads claimable at the warped instant, not the stale cursor block ([f191e88](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f191e88883525cec0c1112a99945af7546f17b68)), closes [#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66) [#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66)

# 1.0.0 (2026-06-16)


### Bug Fixes

* **api:** accrual ticker anchors on wall-clock, not block-number opened_at (was buried in $178k) ([7347093](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/7347093f33c43992f5e3e45bed76a9da37720b03))
* **api:** accrual ticker gates on PERFORMING, no phantom yield on a non-performing loan ([5ab4bb1](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/5ab4bb1b189bc53b25af6c87daa8c381b9cb3713))
* **api:** accrue delinquent loans in the display ticker (match the chain) ([0986414](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/09864140c4160051b7a8a8290fd433b7458dd5a6))
* **api:** add CORS header to /sse — browser at :51730 was silently blocked from :41990 ([08b473f](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/08b473f5d3c8f5e30e87938ea2f8e79ec0dfd9dc))
* **api:** correct display for runtime-tokenized loans ([e814255](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e8142550337aaf1de2d3b23dccfc2d78af00b307)), closes [#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75)
* **api:** fail KYC when the on-chain claim write reverts ([6670da7](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6670da7f5d63b154e6889765a2fe5bb17d7106e2))
* **api:** invest rejects over-subscription beyond a loan's principal ([e7d3a99](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e7d3a99c7ecad63eb3b9c3a3329cc08493b52931))
* **api:** kyc verify mirrors the on-chain claim into the off-chain identities read-model ([b9677aa](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/b9677aafe7d674690519658a437c32f95ae863ce))
* **api:** reserve.totalClaimable reads the engine snapshot, not the dead accrued sum ([a9d0ce4](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a9d0ce406e4cb0f0c836c0df138e602390606624))
* **api:** surface tokenization in the chain-events feed ([6eded5a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6eded5a9326dd1beff7294cc3f87b27a5bbf8170)), closes [#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75)
* **contracts:** correct token symbol typo CRDTatus -> CRDT ([205c1e3](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/205c1e3d969644dff9f81ee8234fbf309d03763a))
* **contracts:** exclude halted window from resumed accrual ([85efc79](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/85efc7922fece4d533280dde97a91fcbddf07809))
* **contracts:** frozen holder = complete lockout — add sender-freeze to gauntlet ([aadab98](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/aadab9811fd7c97705669f57866a2eee6bb245d5))
* **db:** serialize concurrent migrations with an advisory lock ([cf355a9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/cf355a9858e846c0d403a2d7556712d94aaaa448))
* **indexer:** ingest never crashes on a duplicate (block_number, log_index) ([7e118ba](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/7e118bad6d09896033cb46dbe0ee1b9e27698500))
* keep the chain-activity feed visibly live ([f8be288](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f8be288f25df383e447236904c18e66ad3c28013))
* **recon:** make canonical replay fingerprint deployment-stable ([79d6c47](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/79d6c47bf5186b9c6c06c9f9d6a36383d53ce9a7)), closes [#19](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/19)
* **recon:** make the running app demoable end-to-end ([#32](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/32)–[#37](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/37)) ([4f96889](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/4f9688921c3589db94cc897c1d1262a8e22dbf8c)), closes [#33](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/33) [#34](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/34) [#35](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/35) [#36](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/36)
* **recon:** merge fix/demo-readiness — demo-readiness fixes ([#32](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/32)–[#37](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/37)) ([e914dc0](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e914dc07b332a3637ff648fc273f21c719d38887))
* **recon:** seed reserve to mirror on-chain funding; 1s blocks; live block counter ([c764914](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/c764914476b611c260a76eaf00726680651dd819))
* **scripts:** bring infra up before the dev test gate ([e0aba91](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e0aba915932e4b5002de65f5be17c3e194046f6b)), closes [#31](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/31)
* **scripts:** prove SenderFrozen on-chain — stale ABIs + an unreachable row 4 ([92712bc](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/92712bc034e0220bc9e42f1284930d262ddac46f))
* **scripts:** revert anvil --block-time (seeded accrual vs empty reserve auto-halted recon) ([6fd3b4e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6fd3b4e4712e2941908c88a49436c9a629efe650))
* **types:** senderFrozen joins the exhaustive ReasonCode switch ([84d691c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/84d691c2b072e89f4750093da504a9ac4d8e93b2))
* **ui:** badge accepts onClick prop + eslint-ignore warehouse build ([df27bae](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/df27baec26c3707812631aa1595ece8574a2da7f))
* **ui:** demo polish — pre-select identity, bigger ticker, tagline, 4-decimal accrual ([dbb8431](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/dbb84313bf23fa8c55b00a2788cfcd2cc90819d4))
* **ui:** health panel stuck on connecting — seed recon status via fetch, share one stream ([b656bac](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/b656bacec2f3a48c6ff00a0f40f3c660391b5375))
* **ui:** invest dialog shows why it reverted, not a bare "Reverted" ([61f9fc6](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/61f9fc6fcfc03d57a54f2daa8fdf4e3f1060b335))
* **ui:** relabel signing phase to 'Submitting…' — server signs, no browser wallet ([a8f2fd2](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a8f2fd28c18ace4a7f48a1a84742d40b09c6a5c9))
* **ui:** show 2 decimal places in fmtUsd6 so accrual ticker is visible ([dce9d09](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/dce9d09f1992db32181a5e792deba0cb232a1402))
* **ui:** skip ensureChain for demo (invest hang); 1s blocks; LTV/DSCR titles; README diagram ([0a0c669](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/0a0c6692ea65e308fa0115c5de857aa32c4f28ab))
* **ui:** sse CORS header; claimable resets after claim; remove mystery $0 from claim panel ([252b210](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/252b210c9751809458bc716e5745eb1e5e2f2597))
* **ui:** sticky-footer layout so the lifecycle strip pins to the page bottom ([#40](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/40)) ([e990a61](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e990a61117d83a6f667faad987d037c22fc33318))
* **ui:** surface the clean GraphQL error message, not the ClientError JSON dump ([a27346a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a27346ad3efcbe88804d7abbe903dc5924c3454c))


### Features

* **api:** add GraphQL schema (Pothos code-first) ([3b04e66](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/3b04e665e5d0a259f60206e974f7ce3f7e514960)), closes [#20](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/20)
* **api:** add SSE live feed — accrual + recon status ([a98539c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a98539cce72ba9ed80dc7315dbb10b2a726088e4)), closes [#22](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/22)
* **api:** block investing into a matured (DEFAULT) loan + hide its invest button ([dfd0028](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/dfd00281876c4764126f180ab5573ea6e267628f)), closes [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46) [#5](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/5) [#48](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/48)
* **api:** kyc onboarding — mock provider, verdict writes on-chain claim ([#39](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/39)) ([14afe6d](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/14afe6d91ee8aad471252e3e74963b888e0fe8d3))
* **api:** loans ops view — navReadings query, submitNav/reportCash, LoanOpsCard ([#38](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/38)) ([7b5eb7a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/7b5eb7a49d2df8e1741c6c232ea49f38b8c6f039))
* **api:** surface each series' unsubscribed capacity on the loan card ([f5677a8](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f5677a8a7b47186ea49bdceda2302df779f35d06)), closes [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46) [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46)
* **api:** tokenizeLoan — real on-chain CreditToken deploy from the warehouse ([#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66) [#67](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/67) [#68](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/68)) ([cc35494](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/cc354946cca9b2a66e1a8bec1af772ace02b12f4)), closes [#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75) [#7](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/7)
* **api:** tx-status tracking + optimistic position ([904b0b7](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/904b0b71fc03eb6e6bf860fa02e9fd1b7076c39a)), closes [#23](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/23)
* **api:** warehouse client + GraphQL book/analytics surface ([#63](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/63) [#64](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/64)) ([21bd77e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/21bd77e3e0f658e4a4a75c2a886a2f819b9d51bb))
* **api:** wire resolvers to chain + reconciliation ([1ba387d](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/1ba387d646b3485943b7fcd492451c64a5af6c34)), closes [#21](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/21) [#16](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/16) [#18](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/18)
* **contracts:** accrual + reentrancy-safe claim ([f837d90](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/f837d9060d9b4a068b0146b3fb3745d2155f5780))
* **contracts:** add ComplianceRegistry — Reg D/S rules ([2aae4ff](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/2aae4ff29091587acdc3fb05d5a0a7ab55a7de94))
* **contracts:** add CreditToken — ERC-3643-lite permissioned transfer ([ebf84c4](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/ebf84c471338057133a08d7f5c202cf72ccc2f16))
* **contracts:** add IdentityRegistry — claims + eligibility ([2c488fe](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/2c488fe17619f4d24491110f85710b51902502c8))
* **contracts:** cap issuance at the loan principal on-chain (ExceedsPrincipal) ([832252b](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/832252b66f61bd1b9ddea85797fb3d5467683377)), closes [#46](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/46)
* **contracts:** interfaces + custom error taxonomy ([5b936c6](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/5b936c671b6506e86caec834d8ed83962ca4a06f))
* **db:** postgres read-model schema + numbered raw sql migrations ([15ea1de](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/15ea1de1ba3c6c3558f154a0f44de816414d8f2c))
* **deploy:** add Deploy.s.sol + seed identities & mortgages ([e58096e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e58096e7d1bb7ca178fe59cee293b990c7814e67))
* **indexer:** db-driven watched-token set + runtime-token refresh ([#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75)) ([6e3d2ab](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6e3d2abb7cc1368f6660b893dce31d6c492b58c3)), closes [#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66)
* **indexer:** index IdentityRegistry ClaimsUpdated — KYC events in the feed ([94338f0](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/94338f0bf334302baffab4b7b1b6b4c5df6dd8a9)), closes [#47](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/47)
* **indexer:** seed a par NAV baseline per loan in the live demo boot ([38b8a90](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/38b8a9087916a2db60cda15bcb0df815a2235ccb))
* **indexer:** viem CreditToken indexer with idempotent event projection ([1083956](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/1083956655ab0c936b7c03d22137babe9b3313a8))
* merge build — all 31 tickets shipped, 53+117 tests green, 10/10 matrix ([005de62](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/005de629c571a9d1b0a694afe53c086b89b122ef))
* **nav:** a corrective NAV mark clears the freeze — no world reset needed ([628b445](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/628b4456006bddf0166f505f8f41729b640420e3)), closes [#49](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/49)
* **nav:** off-chain NAV feed + validation gate with NavAnomaly halt ([387c49c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/387c49c30ca1d43d5468e59ec2967bcc32437a85))
* **recon:** deterministic replay + keccak state hash with interleaving property ([a193910](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a19391050fef1a6dcb15374b5a313328c7989ab2))
* **recon:** reconciliation engine with 4 invariants + ReconMismatch halt ([3c70e03](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/3c70e0326625e7b51956cda26895a65eb932a291))
* **recon:** reserve as an append-only ledger of record ([#82](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/82)) ([e4f2b27](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e4f2b279ed939bfe50bdf1809e9f74ccd38ca20c))
* **recon:** tokenized loans first-class + reconcile at indexer cursor ([#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66)) ([936e4fd](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/936e4fdfe4c8b9ab761b870033ee622cdbd43b12))
* **scripts:** idempotent port-safe dev script (stop -> test -> start) ([92c9846](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/92c9846c295e6a026689ddf6074893c4bcc2a986))
* **scripts:** live chain tailer — blocks + decoded events in the terminal ([3638e7f](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/3638e7fe0e17110be576a3274a86ece7dcc148c0))
* **scripts:** scenario-matrix verifier ([4778d1e](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/4778d1e4ef961ce98fa220bb61e8eeaceb3cdc94))
* **types:** shared domain types + zod schemas with branded ids ([7975bda](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/7975bdac950f10ac44d039952c16b93211b6ae31))
* **ui:** action log — log + display every user/product action; /log + /logs endpoints ([#39](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/39)) ([c013283](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/c013283ee9992044b265ca856dc5a3a65dde2d77))
* **ui:** chain activity panel — live block counter + event log; anvil block-time 2s ([#39](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/39)) ([8e96f6c](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/8e96f6c7a2a7a797717d4021a414d95a27765f5a))
* **ui:** column-labelled data tables for the servicing feed + reserve activity ([0768ff9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/0768ff98af10113a01d5e2a89833c7726def8dfb)), closes [#24](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/24)
* **ui:** invest + claim flow with wallet ([3ad8335](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/3ad83358b68e74b13489d85ae112f4c57f502d64))
* **ui:** lifecycle strip — end-to-end sequence footer on every view ([#40](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/40)) ([b426294](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/b42629425e1f6499d6af874f0a5d1f29254db97b))
* **ui:** marketplace + position dashboard ([dfa3fad](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/dfa3fadc024e5e7dab072f1bd10cb37edae376e4))
* **ui:** origination tab — ranked book, one-click tokenize, analytics, live feed ([39f6acd](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/39f6acd58751b9e9ff6f98df91b294ef0bb5e4b9)), closes [#7](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/7) [#69](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/69) [#70](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/70) [#71](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/71) [#72](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/72)
* **ui:** poll reserve every 2s so the Claimable stat ticks live ([3e2e0f1](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/3e2e0f18f7a0d24a14523debd5b6fab7f71ea6c7)), closes [#45](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/45)
* **ui:** reconciliation / health panel ([2b80ed2](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/2b80ed2f4ae4c3020fa65f0bbc1334bc4683640b))
* **ui:** role-aware yield — net investor yield + expected distributions ([#81](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/81)) ([d7a30d9](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/d7a30d9e12d843c7cc0a7073999cc9439cfd6a25))
* **ui:** tranche waterfall visualizer — additive structuring module ([#42](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/42)); fix stale web tests ([7787ad4](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/7787ad44eeffd258f93249ceacaa248c9ce30f20))
* **warehouse:** deterministic ~10k CRE book generator ([#52](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/52)) ([52124d5](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/52124d5e61595bb830a0a2b4eb9cc2b0c8150c15))
* **warehouse:** live servicing feed — generator, SSE stream, rolling KPIs ([#60](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/60) [#61](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/61) [#62](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/62)) ([67f45d5](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/67f45d500ebc1793c3afdd2823d80661ff6d76be))
* **warehouse:** mirror the on-chain loans into wh_book as the tokenized tip ([#53](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/53)) ([e7c890d](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/e7c890d0ec6e7ee1a41d446c8b291a9a73c6dcfc))
* **warehouse:** ranked book + analytics REST endpoints ([#57](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/57) [#58](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/58)) ([bccad9d](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/bccad9d6cb5f0d92c0378661a17c4072eaa41be6))
* **warehouse:** scaffold Spring Boot sidecar on 47100 + dev wiring ([#51](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/51)) ([9dcb092](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/9dcb0920b5adc7419790882af8b1a38d9b7089de))
* **warehouse:** tokenized-subset servicing drives the reserve, halt-gated ([#80](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/80)) ([a213cec](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/a213cec9931a03ad4fc39e28c25ae93ac7b7c06f))
* **warehouse:** transparent weighted scoring engine ([#54](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/54) [#55](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/55) [#56](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/56)) ([3c1e33f](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/3c1e33fa27e71c26d51714d2a9ae26c8fec04c42))
* **warehouse:** wh_* read-model tables via Boot SQL init, shared pcl Postgres ([#74](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/74)) ([4326201](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/432620134ec149ceacac7e23330f4b03fc35edf6))

## [1.11.5](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.11.4...v1.11.5) (2026-06-14)


### Bug Fixes

* **api:** accrue delinquent loans in the display ticker (match the chain) ([016a082](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/016a08238aa797d58a2f9bf0db9945a4e7220b16))

## [1.11.4](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.11.3...v1.11.4) (2026-06-13)


### Bug Fixes

* keep the chain-activity feed visibly live ([6fe6728](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6fe67281c8fb89e7e2f6c337824a220541bb8703))

## [1.11.3](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.11.2...v1.11.3) (2026-06-13)


### Bug Fixes

* **api:** correct display for runtime-tokenized loans ([bf74cfb](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/bf74cfb17551e31127d5990e58b99a5d3f907f37)), closes [#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75)

## [1.11.2](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.11.1...v1.11.2) (2026-06-13)


### Bug Fixes

* **api:** surface tokenization in the chain-events feed ([9dafc57](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/9dafc57effe79113ec49c1e9e3defd17ec7c998d)), closes [#75](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/75)

## [1.11.1](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.11.0...v1.11.1) (2026-06-13)


### Bug Fixes

* **api:** fail KYC when the on-chain claim write reverts ([afafcc6](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/afafcc6696c34e114373a6d5b0dfafc55883d35a))
* **db:** serialize concurrent migrations with an advisory lock ([cc712f5](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/cc712f5f6269521a3c3f6e21deb166770734ff22))

# [1.11.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.10.0...v1.11.0) (2026-06-13)


### Features

* **ui:** column-labelled data tables for the servicing feed + reserve activity ([1f1a432](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/1f1a432ec3179ac8c167a2e3a33f338204f6a5db)), closes [#24](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/24)

# [1.10.0](https://github.com/xbt-a4224j/permissioned-credit-ledger/compare/v1.9.0...v1.10.0) (2026-06-13)


### Features

* **recon:** tokenized loans first-class + reconcile at indexer cursor ([#66](https://github.com/xbt-a4224j/permissioned-credit-ledger/issues/66)) ([6bb515a](https://github.com/xbt-a4224j/permissioned-credit-ledger/commit/6bb515a55d41151d335d024606cd448e17280c93))

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
