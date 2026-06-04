# tickets

Ordered ticket list for `permissioned-credit-ledger`. Mirrored as GitHub issues **#1–#31**
(issue number == ticket number, so every "Blocked by #X" reference resolves). Build in order.
**Every ticket inherits the build standards in `CLAUDE.md`** (tests with the feature, simplicity,
comments that cite the issue #, enterprise UI, demoable, fixed non-conflicting ports).

## Summary

| # | Title | Block | Blocked by | Est. |
|---|---|---|---|---|
| 1 | chore(repo): scaffold monorepo layout + .gitignore | 0 | — | 10m |
| 2 | build(deps): foundry + bun init + pinned deps + .env.example | 0 | #1 | 25m |
| 3 | ci(ci): forge + bun workflows, green on empty | 0 | #1, #2 | 20m |
| 4 | chore(release): conventional commits + semantic-release + pre-commit | 0 | #1 | 15m |
| 5 | feat(contracts): interfaces + custom error taxonomy | 1 | #2 | 30m |
| 6 | feat(contracts): IdentityRegistry — claims + eligibility | 1 | #5 | 40m |
| 7 | feat(contracts): ComplianceRegistry — Reg D/S rules | 1 | #5, #6 | 45m |
| 8 | feat(contracts): CreditToken — ERC-3643-lite permissioned transfer | 1 | #6, #7 | 55m |
| 9 | feat(contracts): accrual + reentrancy-safe claim | 1 | #8 | 50m |
| 10 | test(contracts): transfer-gauntlet reason-code coverage | 2 | #8, #9 | 45m |
| 11 | test(contracts): accrual fuzz + reserve invariant | 2 | #9 | 40m |
| 12 | feat(deploy): Deploy.s.sol + seed identities & mortgages | 2 | #8, #9 | 40m |
| 13 | ci(deploy): deploy-to-Fuji workflow + ABI export | 2 | #12 | 35m |
| 14 | feat(types): shared domain types + zod (mortgage-general) | 3 | #2 | 30m |
| 15 | feat(db): Postgres schema + raw SQL migrations | 3 | #14 | 40m |
| 16 | feat(indexer): viem Fuji event indexer → read models | 3 | #13, #14, #15 | 55m |
| 17 | feat(nav): NAV/servicing feed + validation gate | 3 | #14, #15 | 45m |
| 18 | feat(recon): reconciliation engine — invariants + HALT | 3 | #16, #17 | 60m |
| 19 | feat(recon): deterministic replay + state hash | 3 | #16, #18 | 40m |
| 20 | feat(api): GraphQL schema (Pothos code-first) | 4 | #14, #15 | 45m |
| 21 | feat(api): resolvers wired to chain + reconciliation | 4 | #8, #16, #18, #20 | 55m |
| 22 | feat(api): SSE live feed — accrual + recon status | 4 | #21 | 35m |
| 23 | feat(api): tx-status tracking + optimistic position | 4 | #21 | 35m |
| 24 | feat(ui): marketplace + position dashboard | 5 | #22 | 60m |
| 25 | feat(ui): invest + claim flow with wallet | 5 | #24 | 55m |
| 26 | feat(ui): reconciliation / health panel | 5 | #24 | 40m |
| 27 | feat(scripts): scenario-matrix verifier | 6 | #18, #21 | 50m |
| 28 | ci(ci): wire verify_matrix into CI on a local node | 6 | #27 | 35m |
| 29 | docs(docs): DESIGN.md + 4 architecture SVGs | 7 | #18 | 45m |
| 30 | docs(docs): README + DEMO.md + demo_reset | 7 | #27 | 35m |
| 31 | feat(scripts): idempotent port-safe dev script (stop → test → start) | 6 | #12, #15, #16, #21, #25 | 40m |

## Tickets

### #1 chore(repo): scaffold monorepo layout + .gitignore

**Block:** 0 · **Type:** chore · **Scope:** repo · **Estimate:** 10m · **Blocked by:** — · **Labels:** block-0, infra

**Why.** The whole thesis — a deterministic permissioned ledger whose marquee is an off-chain<->on-chain reconciliation engine — rests on a polyglot monorepo where Solidity contracts, a viem indexer, a Pothos API, and a React app share one ABI source of truth and one commit history. Every downstream ticket (#2 deps, #5 interfaces, #16 indexer, #18 recon) `blocked-by` this scaffold. Without a fixed directory contract, the `scripts/copy_abis.sh` export path (#13) and the `verify_matrix.ts` integration harness (#27) have nowhere to land. This is the root node (no `blocked-by`).

**What.** Create the canonical directory skeleton and root metadata — no code, just the contract.

Directories (each with a `.gitkeep` until its block lands):
- `contracts/` (Foundry root: `src/`, `test/`, `script/`, `lib/`)
- `indexer/` (Bun + viem event reader)
- `api/` (Bun + Pothos GraphQL + graphql-yoga)
- `web/` (Vite + React 18 + Tailwind)
- `db/migrations/` (numbered raw SQL, no ORM)
- `scripts/` (`verify_matrix.ts`, `copy_abis.sh`, `demo_reset`)
- `docs/architecture/` (DESIGN.md + 4 SVGs land in block 7)

Files to create:
- `.gitignore` — three concern groups, commented: Foundry (`out/`, `cache/`, `broadcast/`, `lib/` kept via submodules not ignored), Node/Bun (`node_modules/`, `dist/`, `.vite/`, `bun.lockb` NOT ignored), core (`.env`, `.env.local`, `.DS_Store`, `*.log`, `coverage/`, `lcov.info`)
- `LICENSE` — MIT, company-neutral copyright holder (no real name/JD/company)
- `README.md` — stub with: project one-liner (deterministic permissioned tokenized-credit ledger + reconciliation gate), the repo-layout tree, and a `## Status` heading reading `scaffold`. CI badge + quickstart deferred to #30.
- `.github/` directory created (workflows land in #3/#4)

Public surface: the directory tree itself is the contract every other ticket imports against. No source files, no functions.

**Acceptance criteria.**
- [ ] 1. All 7 top-level dirs (`contracts api indexer web db scripts docs`) exist; `git ls-files` shows a tracked `.gitkeep` in each empty leaf (`contracts/src`, `contracts/test`, `contracts/script`, `db/migrations`, `docs/architecture`).
- [ ] 2. `.gitignore` contains exactly 3 labeled sections (`# foundry`, `# node/bun`, `# core`); `git check-ignore -v out/ node_modules/ .env` resolves all three to a rule; `git check-ignore bun.lockb` exits non-zero (lockfile tracked).
- [ ] 3. `LICENSE` is MIT and contains zero occurrences of any real person/company name (grep for the company slug and JD terms returns 0 lines).
- [ ] 4. `README.md` renders the layout tree and contains the literal `scaffold` status token.
- [ ] 5. `git status --porcelain` is clean after commit; repo root contains no stray build artifacts.
- [ ] N/A fuzz/property: pure scaffolding, no executable logic to fuzz.

**Out of scope.**
- Any toolchain init (`forge init`, `bun init`, dependency installs) — that is ticket #2.
- Any CI/release config files (`ci.yml`, `.releaserc.json`, commitlint) — tickets #3 and #4.

**Notes.** Landmine: do NOT `.gitignore` `contracts/lib/` — OpenZeppelin/forge-std arrive as git submodules in #2 and must stay tracked; ignoring `lib/` silently breaks CI checkout. Keep `bun.lockb` and `foundry.lock` tracked for reproducible CI.

### #2 build(deps): foundry + bun init + pinned deps + .env.example

**Block:** 0 · **Type:** build · **Scope:** deps · **Estimate:** 25m · **Blocked by:** #1 · **Labels:** block-0, infra

**Why.** Reproducible, pinned toolchains are the precondition for the determinism the thesis sells: the same contracts, the same OZ v5 `_update` hook, the same viem/Pothos versions must compile identically in CI (#3) and on Fuji (#13). The shared `.env.example` (`FUJI_RPC`, `PRIVATE_KEY`, `DATABASE_URL`) defines the exact configuration surface the indexer (#16), deploy script (#12), and API signer (#21) consume. `blocked-by` #1 (needs the directory contract); blocks every implementation block.

**What.** Initialize all four toolchains against the #1 skeleton, pinning versions.

`contracts/` (Foundry):
- `forge init --no-commit` then add submodules: `forge install foundry-rs/forge-std` and `forge install OpenZeppelin/openzeppelin-contracts@v5.3.0` (v5 — the `_update` hook target).
- `contracts/foundry.toml`: `solc = "0.8.28"`, `optimizer = true`, `optimizer_runs = 200`, `remappings = ["@openzeppelin/=lib/openzeppelin-contracts/", "forge-std/=lib/forge-std/src/"]`, `[fuzz] runs = 256`, `[invariant] runs = 256, depth = 64`, and `[fmt]` block (line_length 120) so `forge fmt --check` is deterministic in #3.
- `contracts/remappings.txt` mirroring the toml.

Root + off-chain (Bun workspace):
- Root `package.json` via `bun init`: declare `workspaces: ["api", "indexer", "web", "scripts"]`; scripts `lint`, `typecheck`, `test`.
- `api/` deps: `@pothos/core`, `graphql`, `graphql-yoga`, `postgres` (porsager raw driver), `zod`, `viem`.
- `indexer/` deps: `viem`, `postgres`, `zod`.
- `web/`: scaffold Vite + React 18 + TS; add `tailwindcss postcss autoprefixer` + `tailwind.config.ts` + `postcss.config.js` + `src/index.css` with the three `@tailwind` directives.
- Dev deps (root): `vitest`, `fast-check`, `typescript`, `eslint` + `@typescript-eslint/*`, `@types/bun`.
- `tsconfig.base.json` at root (strict: true, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); per-package `tsconfig.json` extending it.
- `eslint.config.js` (flat config) at root.
- `.env.example` with documented keys: `FUJI_RPC=https://api.avax-test.network/ext/bc/C/rpc`, `PRIVATE_KEY=0x...` (placeholder), `DATABASE_URL=postgres://postgres:postgres@localhost:5432/pcl`, `LOCAL_RPC=http://127.0.0.1:8545`, `CHAIN_ID_FUJI=43113`.

Public surface: `bun run lint`, `bun run typecheck`, `bun run test`, `forge build`, `forge test` all execute (may be no-op green on empty project). No domain code.

**Acceptance criteria.**
- [ ] 1. `cd contracts && forge build` exits 0; `forge build --sizes` runs; `git submodule status` lists `forge-std` and `openzeppelin-contracts` pinned at the `v5.3.0` tag.
- [ ] 2. `forge fmt --check` exits 0 on the empty `src/`.
- [ ] 3. `bun install` resolves with `bun.lockb` written; `bun run typecheck` (tsc --noEmit across workspaces) exits 0.
- [ ] 4. `bun run lint` exits 0; `bun x vitest run` reports 0 failures (0 tests acceptable).
- [ ] 5. `web/` builds: `cd web && bun run build` produces `dist/`; Tailwind directives present in `src/index.css`.
- [ ] 6. `.env.example` contains all 5 keys; no real secret committed (the placeholder `PRIVATE_KEY` is an obvious zero/dummy, grep confirms no 64-hex live key).
- [ ] 7. `tsconfig.base.json` has `"strict": true`; CI (#3) can rely on it.
- [ ] N/A fuzz: config-only; the >=256 fuzz/invariant *runs* are wired here in `foundry.toml` but the actual property tests ship in #11/#19.

**Out of scope.**
- Writing any Solidity contract/interface or TS module — interfaces start at #5, types at #14.
- The CI workflow YAML that invokes these commands — that is #3.

**Notes.** Landmine: OpenZeppelin v5 removed `_beforeTokenTransfer`/`_afterTokenTransfer`; the permissioned gauntlet (#8) MUST hook `_update`. Pin OZ to a v5.x tag, never `master`, or the `_update` signature can drift. Keep `solc` pinned (0.8.28) so bytecode — and thus the deterministic state hash in #19 — is reproducible across CI and Fuji.

### #3 ci(ci): forge + bun workflows, green on empty

**Block:** 0 · **Type:** ci · **Scope:** ci · **Estimate:** 20m · **Blocked by:** #1, #2 · **Labels:** block-0, infra

**Why.** CI is the enforcement arm of the determinism thesis: it must prove the Foundry build/format/test and the Bun lint/typecheck/test stay green on every push before any feature lands, so regressions in the reconciliation invariants (#18) or the replay state hash (#19) get caught mechanically, not by eyeball. Green-on-empty-project is the baseline contract that later jobs (#13 deploy, #28 matrix) extend. `blocked-by` #1 (layout) and #2 (toolchains the jobs invoke).

**What.** One GitHub Actions workflow, two parallel jobs.

File to create: `.github/workflows/ci.yml`
- Triggers: `on: push: {branches: [main]}` and `on: pull_request:`.
- Job `forge` (runs-on ubuntu-latest):
  - `actions/checkout@v4` with `submodules: recursive` (forge-std + OZ).
  - `foundry-rs/foundry-toolchain@v1` pinned `version: stable`.
  - Steps (working-directory `contracts`): `forge fmt --check`, `forge build --sizes`, `forge test -vv`.
- Job `bun` (runs-on ubuntu-latest):
  - `actions/checkout@v4`.
  - `oven-sh/setup-bun@v2` pinned `bun-version: latest` (or a pinned semver).
  - `bun install --frozen-lockfile`.
  - Steps: `bun run lint`, `bun run typecheck`, `bun x vitest run`.
- Both jobs run on the same trigger; no `needs:` between them (parallel) for fast feedback.
- `concurrency:` group on `${{ github.ref }}` with `cancel-in-progress: true`.

Public surface: a `CI` workflow whose two job names (`forge`, `bun`) are the required status checks the README badge (#30) and branch protection reference.

**Acceptance criteria.**
- [ ] 1. `ci.yml` parses: `bun x --yes @action-validator/cli .github/workflows/ci.yml` (or `actionlint`) exits 0.
- [ ] 2. The `forge` job runs exactly `forge fmt --check`, `forge build --sizes`, `forge test -vv` in that order, working-directory `contracts`, with `submodules: recursive` on checkout.
- [ ] 3. The `bun` job runs `bun run lint`, `bun run typecheck`, `bun x vitest run` after `bun install --frozen-lockfile`.
- [ ] 4. On a pushed branch the workflow goes green end-to-end on the empty project (0 forge tests, 0 vitest tests both acceptable) — verified via `gh run watch` showing both jobs success.
- [ ] 5. Foundry toolchain pinned to a fixed `version:` (not floating `nightly`); Bun action pinned.
- [ ] 6. `concurrency` cancels superseded in-progress runs on the same ref.
- [ ] N/A fuzz: CI orchestration; the fuzz/invariant *executions* (`forge test` >=256 runs) are surfaced by this job once #11/#19 land, but no property test is authored here.

**Out of scope.**
- The manual-dispatch Fuji deploy workflow + `copy_abis.sh` — that is #13.
- Spinning a local EVM node + Postgres service to run `verify_matrix.ts` — that is #28.

**Notes.** Landmine: `forge fmt --check` fails CI on any unformatted file, so the `[fmt]` config in `foundry.toml` (#2) and the pre-commit hook (#4) must use identical settings or contributors get a green local / red CI mismatch. Use `--frozen-lockfile` so a drifted `bun.lockb` fails loudly instead of silently resolving new versions.

### #4 chore(release): conventional commits + semantic-release + pre-commit

**Block:** 0 · **Type:** chore · **Scope:** release · **Estimate:** 15m · **Blocked by:** #1 · **Labels:** block-0, infra

**Why.** The ticket map mandates conventional-commit titles and tests-inside-the-feature; automated commit linting + semantic-release turn that convention into an enforced, versioned release trail, which is what makes the demo (#30) and DESIGN.md (#29) able to point at tagged, reproducible cuts of the deterministic ledger. Pre-commit (`forge fmt` + eslint) stops unformatted code before it ever hits the CI format gate (#3), keeping feedback tight. `blocked-by` #1 (repo root).

**What.** Wire commit-message linting, a pre-commit formatter, and release automation.

Files to create:
- `commitlint.config.js` (or `.commitlintrc.json`) — extends `@commitlint/config-conventional`; `scope-enum` constrained to the project scopes (`repo, deps, ci, release, contracts, deploy, types, db, indexer, nav, recon, api, ui, scripts, docs`); `type-enum` includes `feat, fix, chore, build, ci, test, docs, refactor, perf`.
- `.husky/commit-msg` — runs `bun x commitlint --edit $1`.
- `.husky/pre-commit` — runs `forge fmt --check` in `contracts/` AND `bun x eslint` on staged TS/TSX (via `lint-staged`).
- `.lintstagedrc.json` — `"*.{ts,tsx}": "eslint --fix"`, `"contracts/**/*.sol": "forge fmt"`.
- `.releaserc.json` — semantic-release config: plugins `@semantic-release/commit-analyzer`, `@semantic-release/release-notes-generator`, `@semantic-release/changelog`, `@semantic-release/github`; `branches: ["main"]`.
- `.github/workflows/release.yml` — `on: push: {branches: [main]}`; job runs `bunx semantic-release` with `GITHUB_TOKEN`; `permissions: {contents: write, issues: write, pull-requests: write}`.
- `.github/workflows/commitlint.yml` — `on: pull_request`; lints the PR commit range with `wagoid/commitlint-github-action` (or `bunx commitlint --from origin/main --to HEAD`).
- Dev deps added to root `package.json`: `@commitlint/cli`, `@commitlint/config-conventional`, `husky`, `lint-staged`, `semantic-release`, `@semantic-release/changelog`, `@semantic-release/git`; `prepare` script = `husky`.

Public surface: the `feat(scope): ...` / `fix(scope): ...` commit grammar all tickets must follow, plus an automated `CHANGELOG.md` + GitHub releases on merge to `main`.

**Acceptance criteria.**
- [ ] 1. `echo 'feat(recon): add reconciliation gate' | bun x commitlint` exits 0; `echo 'added stuff' | bun x commitlint` exits non-zero; `echo 'feat(bogus): x' | bun x commitlint` exits non-zero (scope-enum enforced).
- [ ] 2. `bun run prepare` installs Husky; `.husky/commit-msg` and `.husky/pre-commit` exist and are executable (`test -x`).
- [ ] 3. Pre-commit blocks an unformatted `.sol` file and an eslint-erroring `.ts` file (staged), verified by an attempted commit that aborts non-zero.
- [ ] 4. `bunx semantic-release --dry-run` on `main` exits 0 and reports the next version derived from conventional commits (no publish in dry-run).
- [ ] 5. `release.yml` and `commitlint.yml` parse under `actionlint`/`@action-validator`; `release.yml` declares `contents: write` permission.
- [ ] 6. `type-enum` and `scope-enum` in the commitlint config exactly match the 9 conventional types and the 15 project scopes listed above.
- [ ] N/A fuzz: tooling config; no runtime logic to property-test.

**Out of scope.**
- The build/test CI workflow (`forge`/`bun` jobs) — that is #3; this ticket adds only release + commitlint workflows.
- Authoring the README CI badge / DEMO walkthrough that consume the release tags — that is #30.

**Notes.** Landmine: the pre-commit `forge fmt --check` and the CI `forge fmt --check` (#3) must read the same `[fmt]` block in `foundry.toml` — divergent settings produce a green-commit / red-CI loop that wastes reviewer time. semantic-release needs commits to reach `main` via merge/push with full history (`fetch-depth: 0` on the release-job checkout) or version inference silently degrades.

### #5 feat(contracts): interfaces + custom error taxonomy

**Block:** 1 · **Type:** feat · **Scope:** contracts · **Estimate:** 30m · **Blocked by:** #2 · **Labels:** block-1, contracts

**Why.** Every transfer in this ledger must pass a deterministic eligibility gauntlet whose outcomes are *typed*, not stringly. The whole matrix (rows 3-6, 8) asserts a specific `revert` selector per branch, the indexer maps on-chain errors to a TS discriminated union, and GraphQL surfaces them as typed error codes. That contract has to be pinned in ABI **before** any implementation so registries, token, indexer, and API all compile against one source of truth. This is the "interfaces/ABIs before implementations" rule made concrete, and it seeds the five reason codes the thesis is built on.

**What.**
Create (no logic, declarations only):
- `contracts/src/interfaces/IIdentityRegistry.sol`
  - `enum Jurisdiction { Unknown, US, NonUS }`
  - `struct Claims { bool verified; bool accredited; Jurisdiction jurisdiction; bool frozen; }`
  - `function isVerified(address account) external view returns (bool);`
  - `function isEligible(address account) external view returns (bool);`
  - `function isFrozen(address account) external view returns (bool);`
  - `function isAccredited(address account) external view returns (bool);`
  - `function jurisdictionOf(address account) external view returns (Jurisdiction);`
  - `function claimsOf(address account) external view returns (Claims memory);`
  - `event ClaimsUpdated(address indexed account, bool verified, bool accredited, Jurisdiction jurisdiction, bool frozen);`
- `contracts/src/interfaces/IComplianceRegistry.sol`
  - `enum Offering { RegD, RegS }`
  - `function canTransfer(address from, address to, uint256 amount) external view returns (bool);`
  - `function checkTransfer(address from, address to, uint256 amount) external view;` (reverts typed; non-view-callable variant for the gauntlet)
  - `function offering() external view returns (Offering);`
- `contracts/src/interfaces/ICreditToken.sol`
  - `event PositionOpened(address indexed holder, uint256 loanId, uint256 amount);`
  - `event InterestClaimed(address indexed holder, uint256 loanId, uint256 amount);`
  - `event AccrualFrozen(uint256 indexed loanId);`
  - `function claimable(address holder) external view returns (uint256);`
  - `function claim() external;`
  - `function mint(address to, uint256 loanId, uint256 amount) external;`
  - `function burn(address from, uint256 amount) external;`
- `contracts/src/Errors.sol` (shared `library` of custom errors so every contract imports one definition):
  - `error NotEligible(address account);`
  - `error ReceiverFrozen(address account);`
  - `error ReceiverNotVerified(address account);`
  - `error AccreditationRequired(address account);`
  - `error InsufficientReserve(uint256 requested, uint256 available);`
Define all five at file scope in `Errors.sol` (Solidity disallows errors inside a `library` body pre-0.8.x patterns differ; declare them at file level and import by name). Pin `pragma solidity ^0.8.24;` and `// SPDX-License-Identifier: MIT` in every file to match `foundry.toml` (`solc = "0.8.24"`).

**Acceptance criteria.**
- [ ] 1. `forge build --sizes` compiles all four interface/error files with 0 errors.
- [ ] 2. `forge fmt --check` passes on `contracts/src/interfaces/*` and `contracts/src/Errors.sol`.
- [ ] 3. All five custom errors (`NotEligible`, `ReceiverFrozen`, `ReceiverNotVerified`, `AccreditationRequired`, `InsufficientReserve`) are declared exactly once and resolvable from a second file via `import`.
- [ ] 4. A 1-test `contracts/test/Interfaces.t.sol` asserts `type(IIdentityRegistry).interfaceId != bytes4(0)` and references each error selector via `IIdentityRegistry`/`ICreditToken` (compile-time proof the surface exists); `forge test` = 1 test green.
- [ ] 5. CI `forge` job is green (fmt + build + test) on the branch.

**Out of scope.**
- No implementation bodies (IdentityRegistry/ComplianceRegistry/CreditToken are tickets 6-9).
- No accrual/NAV math or reserve mechanics — only the event/selector surface they will emit.

**Notes.** OZ v5 custom errors live in `draft-IERC6093`; do **not** redeclare ERC20 standard errors here. Engine states `NavAnomaly` / `ReconMismatch` are off-chain TS unions (ticket 14/17/18), **not** Solidity errors — keep them out of `Errors.sol`.

### #6 feat(contracts): IdentityRegistry — claims + eligibility

**Block:** 1 · **Type:** feat · **Scope:** contracts · **Estimate:** 40m · **Blocked by:** #5 · **Labels:** block-1, contracts

**Why.** The identity layer is the trust boundary the whole eligibility gauntlet reads from: who is verified, who is accredited, what jurisdiction, who is frozen. Matrix rows 1-5 all resolve against this registry's view functions, and the recon engine's invariant #4 (`identity-valid`) re-checks the same claims off-chain. Seeding deterministic identities here (2 accredited-US, 2 Reg-S non-US, 1 unverified, 1 frozen) is what makes the 10-scenario matrix reproducible on the local node.

**What.**
Create `contracts/src/IdentityRegistry.sol`:
- `contract IdentityRegistry is AccessControl, IIdentityRegistry`
- `bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");`
- `mapping(address => Claims) private _claims;`
- `constructor(address admin) { _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(ISSUER_ROLE, admin); }`
- Reads (hot path, called by `CreditToken._update`): `isVerified`, `isEligible` (= `verified && !frozen`), `isFrozen`, `isAccredited`, `jurisdictionOf`, `claimsOf` — all implementing `IIdentityRegistry`.
- Issuer-only setters (each `onlyRole(ISSUER_ROLE)`, each emits `ClaimsUpdated`):
  - `function setClaims(address account, Claims calldata claims) external;`
  - `function setVerified(address account, bool verified) external;`
  - `function setAccredited(address account, bool accredited) external;`
  - `function setJurisdiction(address account, Jurisdiction j) external;`
  - `function setFrozen(address account, bool frozen) external;`
- `isEligible(addr)` returns `c.verified && !c.frozen` (verification + not frozen; accreditation/jurisdiction are offering-specific and live in ComplianceRegistry, ticket 7).
Modify: `contracts/test/IdentityRegistry.t.sol` (new) for unit coverage below.

**Acceptance criteria.**
- [ ] 1. `forge build --sizes` compiles; contract implements every `IIdentityRegistry` member (compiler enforces).
- [ ] 2. `contracts/test/IdentityRegistry.t.sol`: >=8 tests green covering each setter, `ClaimsUpdated` emission (via `vm.expectEmit`), `isEligible` true for verified-unfrozen and false for frozen/unverified, and a non-issuer setter call reverts with OZ `AccessControlUnauthorizedAccount`.
- [ ] 3. `forge fmt --check` + CI `forge` job green.
- [ ] 4. A seed helper `seedSixIdentities(address[6])` (test util or internal-for-test) produces exactly: 2 `{verified, accredited, US}`, 2 `{verified, !accredited, NonUS}`, 1 `{!verified}`, 1 `{verified, frozen}`; a test asserts the resulting `isEligible`/`isAccredited`/`jurisdictionOf` for all six match the matrix actors.
- [ ] 5. `gas-snapshot` (or `forge test --gas-report`) shows `isVerified`/`isEligible` are `view` and called without state writes (hot-path proof).

**Out of scope.**
- No Reg D/Reg S transfer *decisioning* — that composes in ComplianceRegistry (ticket 7); this registry only stores/serves claims.
- No on-chain KYC document hashes or identity NFTs (ERC-3643 OnchainID is cut per DESIGN.md).

**Notes.** Keep `Jurisdiction.Unknown = 0` as the default so an un-set address is correctly *not* `NonUS`. `isEligible` deliberately excludes accreditation — folding accreditation in here would make row 6 (`AccreditationRequired`) unreachable as a distinct typed revert.

### #7 feat(contracts): ComplianceRegistry — Reg D/S rules

**Block:** 1 · **Type:** feat · **Scope:** contracts · **Estimate:** 45m · **Blocked by:** #5, #6 · **Labels:** block-1, contracts

**Why.** This is the modular rule engine that turns raw identity claims into a Reg D / Reg S transfer decision and produces the *typed* revert per matrix branch: row 4 `ReceiverFrozen`, row 5 `ReceiverNotVerified`, row 6 `AccreditationRequired`, row 3 `NotEligible`. Keeping rules modular (composable checks) mirrors ERC-3643's compliance-module pattern and lets the gauntlet's ordering be asserted deterministically. The recon engine's `identity-valid` invariant relies on `canTransfer` being a pure function of registry state.

**What.**
Create `contracts/src/ComplianceRegistry.sol`:
- `contract ComplianceRegistry is AccessControl, IComplianceRegistry`
- `bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");`
- `IIdentityRegistry public immutable identity;`
- `Offering public immutable offering;` (set once: `RegD` for the accredited-gated token)
- `constructor(address admin, address identityRegistry, Offering _offering)`
- `function checkTransfer(address from, address to, uint256 amount) public view` — runs the gauntlet **in fixed order**, reverting the first failing typed error:
  1. `if (identity.isFrozen(to)) revert ReceiverFrozen(to);`
  2. `if (!identity.isVerified(to)) revert ReceiverNotVerified(to);`
  3. `if (!identity.isEligible(to)) revert NotEligible(to);`
  4. Reg D path: `if (offering == Offering.RegD && !identity.isAccredited(to)) revert AccreditationRequired(to);`
  5. Reg S path: `if (offering == Offering.RegS && identity.jurisdictionOf(to) != Jurisdiction.NonUS) revert NotEligible(to);`
- `function canTransfer(address from, address to, uint256 amount) external view returns (bool)` — wraps `checkTransfer` in `try/catch`-free style by re-evaluating predicates and returning bool (no revert), for read-model/preflight use by the API.
Modify: `contracts/test/ComplianceRegistry.t.sol` (new).

**Acceptance criteria.**
- [ ] 1. `forge build --sizes` compiles; implements all `IComplianceRegistry` members.
- [ ] 2. `contracts/test/ComplianceRegistry.t.sol`: >=10 tests green — one per gauntlet branch asserting the exact selector via `vm.expectRevert(IdentityErrors.ReceiverFrozen.selector)` (and friends) for rows 3-6, plus happy-path `canTransfer == true` for an accredited-US receiver (row 1) and a Reg-S non-US receiver under a `RegS` instance (row 2).
- [ ] 3. Ordering test: an account that is BOTH frozen AND unverified reverts `ReceiverFrozen` (proves freeze precedes verification in the gauntlet).
- [ ] 4. `canTransfer` returns `false` (does not revert) for every failing case used in (2) — bool/revert parity asserted in a loop.
- [ ] 5. `forge fmt --check` + CI `forge` job green; `forge coverage` shows 100% line coverage of `checkTransfer`.

**Out of scope.**
- No transfer *execution* or balance movement — ComplianceRegistry is advisory/decisional; `CreditToken._update` (ticket 8) is the caller that enforces.
- No holding-period / Rule 144 lockups or investor-count caps (single-loan scope; cut in DESIGN.md).

**Notes.** `from`/`amount` are in the signature for module extensibility but the seeded ruleset only gates on `to`; keep them named to avoid `unused-parameter` warnings (or `/* amount */`). The Reg S branch reuses `NotEligible` deliberately — a US holder under Reg S is "not eligible," not "un-accredited."

### #8 feat(contracts): CreditToken — ERC-3643-lite permissioned transfer

**Block:** 1 · **Type:** feat · **Scope:** contracts · **Estimate:** 55m · **Blocked by:** #6, #7 · **Labels:** block-1, contracts

**Why.** The CreditToken is the on-chain claimable balance that the marquee reconciliation engine validates against off-chain servicing cash. Its `_update` hook is the single chokepoint where the freeze->verified->compliance gauntlet runs, emitting `PositionOpened` and reverting the typed errors that matrix rows 3-6 assert. Issuer-gated mint/burn is what lets `Deploy.s.sol` open the 6 loan positions deterministically. Using OZ v5's `_update` (not the removed `_beforeTokenTransfer`) keeps mint, burn, and transfer on one gauntlet.

**What.**
Create `contracts/src/CreditToken.sol`:
- `contract CreditToken is ERC20, AccessControl, ICreditToken`
- `bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");`
- `IIdentityRegistry public immutable identity;`
- `IComplianceRegistry public immutable compliance;`
- `mapping(address => uint256) public loanOf;` (holder -> loanId opened on mint)
- `constructor(address admin, address identityReg, address complianceReg) ERC20("Credit Token", "CRDT")`
- `function decimals() public pure override returns (uint8) { return 6; }` (match reserve/USDC 6dp)
- `function mint(address to, uint256 loanId, uint256 amount) external onlyRole(ISSUER_ROLE)` -> `_mint`, set `loanOf[to]=loanId`, `emit PositionOpened(to, loanId, amount)`.
- `function burn(address from, uint256 amount) external onlyRole(ISSUER_ROLE)` -> `_burn` (issuer clawback; bypasses gauntlet by design).
- `function _update(address from, address to, uint256 amount) internal override`:
  - Run gauntlet ONLY on holder-to-holder transfers (`from != address(0) && to != address(0)`): call `compliance.checkTransfer(from, to, amount)` which reverts the typed error; mint (`from==0`) checks `to` recipient eligibility via the same `checkTransfer`; burn (`to==0`) skips checks.
  - Then `super._update(from, to, amount);`
Modify: `contracts/test/CreditToken.t.sol` (new) — transfer-gauntlet branches; full happy/sad matrix coverage is ticket 10.

**Acceptance criteria.**
- [ ] 1. `forge build --sizes` compiles; `_update` overrides OZ v5 ERC20 (no `_beforeTokenTransfer`).
- [ ] 2. `contracts/test/CreditToken.t.sol`: >=8 tests green — mint-to-unverified reverts `NotEligible`/`ReceiverNotVerified`; transfer-to-frozen reverts `ReceiverFrozen`; transfer-to-unverified reverts `ReceiverNotVerified`; transfer to US-non-accredited under RegD reverts `AccreditationRequired`; happy mint emits `PositionOpened` (`vm.expectEmit`).
- [ ] 3. `mint`/`burn` by a non-issuer revert `AccessControlUnauthorizedAccount`; issuer mint sets `loanOf` and total supply correctly.
- [ ] 4. `decimals() == 6` asserted; clawback `burn` from a frozen holder succeeds (gauntlet bypass proven).
- [ ] 5. `forge fmt --check` + CI `forge` job green.

**Out of scope.**
- No accrual or `claim()` / reserve debit — that is ticket 9 (this ticket leaves `claimable`/`claim` as the inherited interface stubs or `revert`-not-implemented placeholders wired in 9).
- No `permit`/EIP-2612, pausing, or upgradeability proxies.

**Notes.** OZ v5 `_update` is the *only* transfer hook — overriding `transfer()` directly is unnecessary and risks bypassing `transferFrom`. Run the gauntlet on the recipient for mints too, else row 3 (unverified invest) won't revert at mint time. Keep `super._update` LAST so a reverting check never mutates balances.

### #9 feat(contracts): accrual + reentrancy-safe claim

**Block:** 1 · **Type:** feat · **Scope:** contracts · **Estimate:** 50m · **Blocked by:** #8 · **Labels:** block-1, contracts

**Why.** Accrual + `claim()` is where on-chain *claimable* value is created and settled against the mock-USDC reserve — exactly the quantity the marquee recon engine cross-checks against off-chain collected cash (invariant #2: `onchain claimable <= offchain collected`, and the fuzz invariant `sum(claimable) <= reserve balance`). Matrix row 7 (claim with funded reserve) and row 8 (`InsufficientReserve`) live or die here, and row 9's NAV HALT freezes accrual via the `AccrualFrozen` path. Reentrancy safety on `claim()` is non-negotiable since it makes an external token transfer.

**What.**
Modify `contracts/src/CreditToken.sol` (extends ticket 8):
- Import `ReentrancyGuard`, `IERC20`. Add `IERC20 public immutable reserve;` (mock-USDC) and `uint256 public ratePerSecond;` set per-loan at deploy (`principal*rate*elapsed` model).
- Per-holder accrual state: `struct Accrual { uint256 principal; uint64 lastAccruedAt; uint256 accrued; }` and `mapping(address => Accrual) public accruals;` `bool public accrualFrozen;` `mapping(uint256 => bool) public loanActive;`
- `function _settleAccrual(address holder) internal` — `if (accrualFrozen || !loanActive[loanOf[holder]]) return; uint256 elapsed = block.timestamp - last; accrued += principal*ratePerSecond*elapsed; last = block.timestamp;` Call from `_update` BEFORE balances move (snapshot) and at the top of `claim()`.
- `function claimable(address holder) public view returns (uint256)` — returns settled-as-of-now accrued (recompute elapsed in view).
- `function claim() external nonReentrant` — checks-effects-interactions: settle; `uint256 owed = accruals[msg.sender].accrued; uint256 bal = reserve.balanceOf(address(this)); if (owed > bal) revert InsufficientReserve(owed, bal);` then `accruals[msg.sender].accrued = 0;` (effect) then `reserve.safeTransfer(msg.sender, owed);` (interaction); `emit InterestClaimed(msg.sender, loanOf[msg.sender], owed);`
- `function freezeAccrual() external onlyRole(ISSUER_ROLE)` -> set `accrualFrozen=true`, `emit AccrualFrozen(loanId)` (NAV-anomaly hook, row 9).
Create `contracts/src/MockUSDC.sol` — minimal 6dp `ERC20` with open `mint` for tests/deploy.
Modify `contracts/test/CreditToken.t.sol` / add `contracts/test/Accrual.t.sol`.

**Acceptance criteria.**
- [ ] 1. `forge build --sizes` compiles; `claim()` carries `nonReentrant`.
- [ ] 2. >=8 tests green: claim with funded reserve emits `InterestClaimed`, debits reserve by `owed`, resets `accrued` to 0 (row 7); claim with underfunded reserve reverts `InsufficientReserve(owed, bal)` with exact args (row 8); `freezeAccrual` stops further accrual (`claimable` flat across `vm.warp`, row 9).
- [ ] 3. >=1 fuzz test: accrual monotonicity — for random `warp` deltas, `claimable(t2) >= claimable(t1)` when `t2 >= t1` and not frozen; >=256 runs (`foundry.toml` fuzz.runs=1000 satisfies).
- [ ] 4. >=1 invariant test: `invariant_claimableLeReserve` asserts `sum(claimable over holders) <= reserve.balanceOf(token)` across a handler doing random mint/warp/claim; invariant.runs>=256.
- [ ] 5. A reentrant `MaliciousReserve` (re-enters `claim` on transfer) is repelled — test asserts the second entry reverts; `forge fmt --check` + CI `forge` job green.

**Out of scope.**
- No real USDC, fiat ramp, or per-second oracle — reserve is `MockUSDC`, rate is a constructor/setter constant (DESIGN.md "what was cut").
- No multi-loan-per-holder accrual or tranching — one `loanOf[holder]`, single-loan scope.

**Notes.** Effects-before-interactions PLUS `nonReentrant` is belt-and-suspenders, but the invariant test is the real proof. Use `SafeERC20.safeTransfer` so a non-standard reserve token can't silently fail. `block.timestamp` accrual is fine on a local anvil node (controlled `vm.warp`); on Fuji it tracks wall-clock — keep the rate tiny so demo accrual is visible but the invariant headroom holds.

### #10 test(contracts): transfer-gauntlet reason-code coverage

**Block:** 2 · **Type:** test · **Scope:** contracts · **Estimate:** 45m · **Blocked by:** #8, #9 · **Labels:** block-2, contracts

**Why.** Block 1 shipped the transfer gauntlet (freeze -> verified -> compliance) and the accrual/claim path inside `CreditToken`, but a gauntlet whose branches aren't pinned to *typed* reverts is a string-revert in disguise — the indexer (#16) and the GraphQL error mapper (#21) decode by 4-byte selector, so every branch must terminate in the exact custom error the matrix expects. This ticket is the unit-level proof for matrix rows 3, 4, 5, 6, 8 (the typed-revert rows) plus the happy paths 1, 2, 7. It exists so that when `scripts/verify_matrix.ts` (#27) asserts `revert NotEligible` end-to-end against the local node, we already know the contract produces that selector and not a generic `ERC20`/`require` blob. This is the contract half of the thesis: deterministic, reason-coded rejection.

**What.**
- Files to create:
  - `contracts/test/CreditToken.t.sol` — the transfer-gauntlet + accrual/claim unit suite.
  - `contracts/test/helpers/SeedIdentities.sol` — a reusable `setUp` mixin that deploys `IdentityRegistry` + `ComplianceRegistry` + `CreditToken` + a mock reserve and seeds the 6 canonical identities (2 accredited-US, 2 Reg-S non-US, 1 unverified, 1 frozen) so this suite and #11 share one seed surface.
- Test contract surface (forge `Test`, one `setUp()` that deploys once; `test_*` mutate fresh state per run):
  - `setUp()` — deploy registries + token + `MockReserve`; grant `ISSUER_ROLE`; register the 6 identities via the helper; mint a starting position to the accredited-US holder.
  - Typed-revert branch tests (each asserts via `vm.expectRevert(abi.encodeWithSelector(ICreditToken.<Error>.selector, <args>))`):
    - `test_invest_unverified_revertsNotEligible()` — row 3.
    - `test_transfer_toFrozen_revertsReceiverFrozen()` — row 4.
    - `test_transfer_toUnverified_revertsReceiverNotVerified()` — row 5.
    - `test_transfer_usNonAccredited_revertsAccreditationRequired()` — row 6 (Reg-D token, US holder lacking the accredited claim).
    - `test_claim_underfunded_revertsInsufficientReserve()` — row 8 (reserve balance < accrued).
  - Happy-path tests (assert state + event via `vm.expectEmit`):
    - `test_invest_accreditedUS_emitsPositionOpened_andStartsAccrual()` — row 1.
    - `test_invest_regS_ok()` — row 2.
    - `test_claim_funded_emitsInterestClaimed_debitsReserve_resetsAccrued()` — row 7.
  - Gauntlet-ordering test: `test_gauntlet_frozenBeatsVerifiedBeatsCompliance()` — a frozen + unverified + non-compliant receiver reverts `ReceiverFrozen` first, proving the freeze->verified->compliance precedence is observable, not incidental.
  - Role-gate negative: `test_mint_roleGate_revertsUnauthorized()` — non-issuer mint reverts `AccessControlUnauthorizedAccount`.
- Public surface touched (consumed, not created here): `ICreditToken` custom errors `NotEligible`, `ReceiverFrozen`, `ReceiverNotVerified`, `AccreditationRequired`, `InsufficientReserve`; events `PositionOpened(address indexed holder, uint256 loanId, uint256 amount)`, `InterestClaimed(address indexed holder, uint256 amount)`.

**Acceptance criteria.**
- [ ] 1. `forge test --match-contract CreditTokenTest -vv` runs **14** test functions, all green (5 typed-revert + 3 happy + 1 ordering + 1 role-gate + 4 supporting assertions on balances/accrued/reserve).
- [ ] 2. Each of the 5 typed-revert tests asserts the **selector with decoded args** (e.g. `ReceiverFrozen(frozenAddr)`), not a bare `vm.expectRevert()` — grep proves zero argument-less `expectRevert` in the file.
- [ ] 3. Matrix rows 1,2,3,4,5,6,7,8 each have exactly one corresponding `test_*` whose name encodes the row; a comment `// matrix row N` annotates each.
- [ ] 4. `forge fmt --check contracts/test/CreditToken.t.sol contracts/test/helpers/SeedIdentities.sol` passes.
- [ ] 5. `forge build --sizes` green; the CI `contracts` job (#3) stays green on push.
- [ ] 6. Happy-path event assertions use `vm.expectEmit` with correct indexed-topic flags; `test_claim_funded...` asserts reserve debited by exactly `accrued` and `accrued` reset to 0 in the same tx.

**Out of scope.**
- Fuzz and invariant tests (those are #11 — this ticket is fixed-input branch coverage only).
- The off-chain selector->TS-union mapping and any indexer/GraphQL decoding (lands in #16/#21).

**Notes.** Landmine: with OZ v5 the gauntlet runs inside the `_update` hook, so `mint` (from == address(0)) and `burn` (to == address(0)) traverse it too — guard the issuer mint path so seeding an accredited holder doesn't trip `ReceiverNotVerified` on the zero address, and make sure the frozen check skips address(0). Use the same Anvil-style deterministic seed addresses the deploy script (#12) will use so test expectations and live-chain behavior line up.

### #11 test(contracts): accrual fuzz + reserve invariant

**Block:** 2 · **Type:** test · **Scope:** contracts · **Estimate:** 40m · **Blocked by:** #9 · **Labels:** block-2, contracts

**Why.** The marquee claim is that off-chain collected cash always covers on-chain claimable balances and the system *halts* otherwise (recon invariant 2, matrix row 10). The on-chain half of that guarantee has to hold unconditionally before the off-chain engine can trust it: `sum(holder claimable) <= reserve balance` must be a contract invariant, and accrual must be **monotonic in elapsed time** so the off-chain deterministic replay (#19) can reconstruct accrued interest from `(principal, rate, elapsed)` without surprises. This ticket proves both with randomized inputs at scale, so a future change to the accrual math or claim path that silently breaks reserve-backing fails CI instead of fooling the reconciliation engine. It is the property-test spine under matrix rows 7 and 8 and recon invariant 2.

**What.**
- Files to create:
  - `contracts/test/CreditTokenFuzz.t.sol` — fuzz of accrual monotonicity.
  - `contracts/test/CreditTokenInvariant.t.sol` — stateful invariant of reserve backing.
  - `contracts/test/handlers/ClaimHandler.sol` — invariant handler that drives `mint`/`warp`/`claim`/`fundReserve` under `targetContract`, bounding actors to the seeded identities.
- Fuzz surface (`CreditTokenFuzz.t.sol`):
  - `testFuzz_accrual_monotonicInTime(uint256 principal, uint256 ratePerSecond, uint256 elapsed)` — `bound(principal, 1e6, 1_000_000e6)`, `bound(ratePerSecond, 1, 1e12)`, `bound(elapsed, 1, 365 days)`; mint to an accredited holder, snapshot `accruedOf(holder)`, `vm.warp(block.timestamp + elapsed)`, assert `accruedOf(holder) >= snapshot` (`assertGe`).
  - `testFuzz_accrual_frozenLoanDoesNotAccrue(uint256 elapsed)` — when loan status is `Halted` (NAV-frozen, matrix row 9 precondition), accrued does not grow across a warp; pins the on-chain side of NavAnomaly accrual-freeze.
  - `testFuzz_claim_neverExceedsAccrued(uint256 principal, uint256 elapsed)` — a funded claim transfers exactly `accruedOf` and never more; post-claim `accruedOf == 0`.
- Invariant surface (`CreditTokenInvariant.t.sol`, extends `StdInvariant`):
  - `setUp()` deploys the stack + `MockReserve`, deploys `ClaimHandler`, `targetContract(address(handler))`, `targetSelector` limited to {`mint`, `warpTime`, `claim`, `fundReserve`}.
  - `invariant_claimableNeverExceedsReserve()` — `assertLe(token.totalClaimable(), reserve.balanceOf(address(token)))` (recon invariant 2 on-chain).
  - `invariant_sumAccruedEqualsTotalClaimable()` — the per-holder ghost sum maintained by the handler equals `token.totalClaimable()` (no claimable conjured from nothing).
- `ClaimHandler.sol` maintains `mapping(address => uint256) public ghostAccrued` and a `holders` array (the 6 seeded identities), uses `bound` on actor index + amounts, and only ever funds/claims through the real contract calls.
- Config: set `[profile.default.invariant] runs`, `depth`, and `[profile.default.fuzz] runs` in `contracts/foundry.toml` so both suites run **>=256 runs** (project default is already higher — assert the floor in a comment).

**Acceptance criteria.**
- [ ] 1. `forge test --match-path 'contracts/test/CreditToken{Fuzz,Invariant}.t.sol' -vv` green.
- [ ] 2. Fuzz runs **>=256** per property (`foundry.toml` `fuzz.runs >= 256`); the run count is visible in `-vv` output and not overridden below 256.
- [ ] 3. Invariant config `invariant.runs >= 256` with `depth >= 15`; `invariant_claimableNeverExceedsReserve` and `invariant_sumAccruedEqualsTotalClaimable` both pass.
- [ ] 4. At least **1 fuzz** test (`testFuzz_accrual_monotonicInTime`) and **1 invariant** test (`invariant_claimableNeverExceedsReserve`) are present and named as such — satisfies the fuzz/property requirement for this block.
- [ ] 5. `forge fmt --check` passes on all three new files; `forge build --sizes` green; CI `contracts` job green.
- [ ] 6. Every fuzzed numeric input is `bound(...)`/`vm.assume(...)` — grep proves no unbounded fuzz parameter reaches a state-changing call (prevents spurious revert-counted failures).

**Out of scope.**
- The off-chain deterministic-replay property over interleaved chain+NAV events (that fast-check property lives in #19; this ticket only guarantees the on-chain accrual/reserve invariants it leans on).
- NAV bounds/staleness logic itself (#17) — here a halted loan is set directly via the issuer/admin path to exercise the frozen-accrual branch.

**Notes.** Landmine: handler-based invariants silently pass if `targetContract`/`targetSelector` aren't set — the fuzzer then calls nothing and every invariant is trivially true. Assert in a `setUp` comment and add one `invariant_handlerActuallyRan()` that checks the handler's call counter `> 0`. Second landmine: integer accrual `principal * rate * elapsed / SCALE` truncates, so use `assertGe`/`assertLe` (monotonic, bounded) rather than equality, and pick `SCALE` consistent with the deploy script's rate convention so #12's seeded rate doesn't overflow at 365-day warps.

### #12 feat(deploy): Deploy.s.sol + seed identities & mortgages

**Block:** 2 · **Type:** feat · **Scope:** deploy · **Estimate:** 40m · **Blocked by:** #8, #9 · **Labels:** block-2, contracts

**Why.** Every downstream block needs one command that stands up a *known* world: the indexer (#16) backfills from it, the GraphQL resolvers (#21) send txs against it, and the 10-scenario verifier (#27) asserts OK/revert/HALT against exactly these 6 identities and 6 loans. The seeded identity mix (2 accredited-US, 2 Reg-S non-US, 1 unverified, 1 frozen) is what makes matrix rows 1-6 reproducible without manual setup — e.g. an unverified seed makes row 3 (`NotEligible`) fire out of the box, and a frozen seed makes row 4 (`ReceiverFrozen`) fire on the first transfer attempt. This script is the single source of deterministic genesis for both the local node (CI/tests) and Avalanche Fuji (the live demo), so the same `Deploy.s.sol` must run unmodified against both via an `--rpc-url` swap.

**What.**
- Files to create:
  - `contracts/script/Deploy.s.sol` — the deploy + seed script.
  - `contracts/script/config/Identities.sol` — a library exposing the 6 canonical seed addresses + their claim sets and the 6 loan params, imported by both the script and (optionally) tests, so addresses don't drift.
- Script surface (`contract Deploy is Script`):
  - Constants for the 6 identities using deterministic local-node addresses (Anvil/avalanche-local well-known accounts): `ACCREDITED_US_1`, `ACCREDITED_US_2`, `REGS_NONUS_1`, `REGS_NONUS_2`, `UNVERIFIED`, `FROZEN`; jurisdiction codes `US = 840`, and a non-US code (e.g. `KY = 136`) for the Reg-S holders.
  - `function run() external` wrapped in `vm.startBroadcast()` / `vm.stopBroadcast()`:
    1. Deploy `IdentityRegistry`, `ComplianceRegistry`, `MockReserve` (mock-USDC), `CreditToken(admin, identityRegistry, complianceRegistry, reserve)`.
    2. Grant `ISSUER_ROLE` on the token, `REGISTRAR_ROLE` on the identity registry, and reserve-funder role to the broadcaster (single-sender demo deploy; comment that prod seeds from per-role keys).
    3. Seed identities: register `ACCREDITED_US_*` as `{verified:true, accredited:true, jurisdiction:US, frozen:false}`; `REGS_NONUS_*` as `{verified:true, accredited:false, jurisdiction:nonUS, frozen:false}`; **leave `UNVERIFIED` unregistered**; register `FROZEN` then `freeze(FROZEN)`.
    4. Create the **6 loans** via `token.createLoan(loanId, principal, ratePerSecond, regime)` where `regime` distinguishes Reg-D (accreditation-gated) from Reg-S; set a sane per-second rate consistent with the accrual SCALE used in #9/#11.
    5. Fund the `MockReserve` with enough mock-USDC that row 7 (funded claim) succeeds and leave one loan's reserve intentionally underfunded so row 8 (`InsufficientReserve`) is reproducible.
    6. Open one starting position for `ACCREDITED_US_1` so the indexer has a `PositionOpened` to backfill.
  - `console.log` every deployed address (registries, token, reserve) at the end for capture by `copy_abis`/env wiring (#13).
- Public surface consumed: `CreditToken.createLoan`, `IdentityRegistry.register`, `IdentityRegistry.freeze`, `ComplianceRegistry` rule setters, `MockReserve.mint`/`fund`, `ISSUER_ROLE`/`REGISTRAR_ROLE`.

**Acceptance criteria.**
- [ ] 1. `forge script script/Deploy.s.sol --fork-url http://127.0.0.1:8545 --broadcast` (against a running local node) deploys 4 contracts and exits 0; broadcast logs show 6 `register`-or-skip outcomes and 6 `createLoan` calls.
- [ ] 2. A post-deploy assertion script/test confirms: `isVerified` is true for the 4 verified seeds and false for `UNVERIFIED`; `isFrozen(FROZEN)` is true; exactly 6 loans exist; reserve balance > 0.
- [ ] 3. Re-running the script against a fresh local node is **deterministic** — same 4 contract addresses and same seed state every run (nonce-ordered single sender).
- [ ] 4. The same script runs against Fuji unchanged: `forge script script/Deploy.s.sol --rpc-url $FUJI_RPC --broadcast` requires only env (`FUJI_RPC`, `PRIVATE_KEY`) — no source edits (verified by grep: no hardcoded RPC/chainId in the script).
- [ ] 5. `forge fmt --check` passes on both new files; `forge build --sizes` green; CI `contracts` job green.
- [ ] 6. Seed state directly enables matrix rows 1-8 with no manual steps: row 3 reverts because `UNVERIFIED` is unregistered, row 4 reverts because `FROZEN` is frozen, row 8 reverts because one loan's reserve is underfunded — each asserted by one line in the post-deploy check.

**Out of scope.**
- Exporting ABIs and the Fuji GitHub Actions dispatch workflow (those are #13).
- NAV feed seeding and reconciliation genesis state (off-chain; seeded by #17/#18 against their own tables, not by this on-chain script).

**Notes.** Landmine: in OZ v5 the `_update` gauntlet runs on mint, so opening the seed position for `ACCREDITED_US_1` must happen *after* that holder is registered/verified or the broadcast reverts `ReceiverNotVerified`. Order matters: register -> createLoan -> fundReserve -> openPosition -> freeze(FROZEN) last (freezing earlier is fine, but never mint to a frozen/unverified address). Fuji is chainId **43113**; don't bake it into the script — pass it via `--rpc-url`. Keep the Reg-S jurisdiction code non-US so row 6 (US-non-accredited holding a Reg-D token) is distinct from the Reg-S happy path (row 2).

---
**Mortgage modeling.** Seed the 6 loans as first-lien mortgages over seeded `Property` records: **5 CRE + 1 RESIDENTIAL** (the residential row proves collateral-generality — same rails, different asset). Vary LTV/DSCR across the set.

### #13 ci(deploy): deploy-to-Fuji workflow + ABI export

**Block:** 2 · **Type:** ci · **Scope:** deploy · **Estimate:** 35m · **Blocked by:** #12 · **Labels:** block-2, contracts

**Why.** Two seams have to exist before the off-chain stack can touch a real chain. First, the marquee demo is a *live* Avalanche Fuji deploy (DEMO.md, #30) — but a testnet deploy must be deliberate, never on every push, so it ships as a manually-dispatched workflow that runs the exact `Deploy.s.sol` from #12 against `$FUJI_RPC`. Second, the indexer (#16) and GraphQL API (#21) load the `CreditToken` ABI to decode events and encode txs; if those ABIs are copy-pasted they drift from the compiled contract and the typed-error decoding silently breaks. This ticket makes the ABI a build artifact copied from `contracts/out`, and gives the project its one-button path to a real Fuji deployment with the on-chain addresses captured for env wiring.

**What.**
- Files to create:
  - `.github/workflows/deploy-fuji.yml` — `workflow_dispatch`-only deploy to Fuji.
  - `scripts/copy_abis.sh` — export ABIs from `contracts/out` into `indexer/` and `api/`.
- `deploy-fuji.yml` surface:
  - Trigger: `on: workflow_dispatch` **only** (no `push`/`pull_request`) with an input `confirm` (string, must equal `deploy` to proceed — a guard against accidental runs).
  - Job `deploy` on `ubuntu-latest`:
    - `actions/checkout@v4`; `foundry-rs/foundry-toolchain@v1` (`version: stable`).
    - `forge install foundry-rs/forge-std --no-git` + `forge install OpenZeppelin/openzeppelin-contracts@v5.x --no-git` (working-directory `contracts`).
    - `forge build` then `forge script script/Deploy.s.sol --rpc-url $FUJI_RPC --broadcast --slow` with `FUJI_RPC` and `PRIVATE_KEY` injected from `secrets`.
    - Upload `contracts/broadcast/Deploy.s.sol/43113/run-latest.json` as a workflow artifact so the deployed addresses are recoverable for env wiring.
  - Env/secrets documented in the job: `FUJI_RPC` (secret), `PRIVATE_KEY` (secret). No secrets echoed.
- `copy_abis.sh` surface (mirrors the prior project's pattern, `set -euo pipefail`):
  - `REPO_ROOT` resolved from `BASH_SOURCE`; `OUT=$REPO_ROOT/contracts/out`.
  - For `contract in CreditToken IdentityRegistry ComplianceRegistry`: copy `$OUT/<C>.sol/<C>.json` to **both** `indexer/src/abi/<C>.json` and `api/src/abi/<C>.json`; hard-error with a clear message if the artifact is missing (`run 'forge build' first`).
  - `mkdir -p` both destinations; echo each copied file.
- Wiring: extend the existing CI `contracts` job (#3) to run `forge build` then `./scripts/copy_abis.sh` and fail if it leaves a non-empty `git diff` on the committed ABI snapshots (drift gate) — or, if ABIs are gitignored, just assert the script exits 0.

**Acceptance criteria.**
- [ ] 1. `deploy-fuji.yml` has `on: workflow_dispatch` and **no** push/PR triggers (grep proves it); `actionlint .github/workflows/deploy-fuji.yml` passes.
- [ ] 2. The deploy job invokes `forge script script/Deploy.s.sol --rpc-url $FUJI_RPC --broadcast` and reads `FUJI_RPC`/`PRIVATE_KEY` from `secrets`, not literals (grep proves no inline key/URL).
- [ ] 3. `bash scripts/copy_abis.sh` after a local `forge build` exits 0 and produces `CreditToken.json`, `IdentityRegistry.json`, `ComplianceRegistry.json` in **both** `indexer/src/abi/` and `api/src/abi/` (3 files x 2 dirs = 6 outputs).
- [ ] 4. `copy_abis.sh` exits non-zero with a readable error when `contracts/out` is empty (verified by running it before any build).
- [ ] 5. `shellcheck scripts/copy_abis.sh` clean; script is `chmod +x` and uses `set -euo pipefail`.
- [ ] 6. CI `contracts` job runs the copy step and the build stays green; the workflow uploads `broadcast/.../43113/run-latest.json` as an artifact (asserted by a step name + `actions/upload-artifact@v4`).

**Out of scope.**
- Generating TypeScript types from the ABI (the shared domain types + zod schemas live in #14; this ticket only moves the raw `.json` artifacts).
- Contract source verification on Snowtrace and any explorer-link automation (manual / DEMO.md follow-up, not wired here).

**Notes.** Landmine: Fuji's chainId is **43113**, so Foundry writes the broadcast manifest to `contracts/broadcast/Deploy.s.sol/43113/run-latest.json` — the upload path must use 43113, not 43114 (mainnet). Use `--slow` on Fuji to avoid nonce races from public-RPC latency, and consider a low fixed `--priority-gas-price` since faucet AVAX is scarce. Keep `copy_abis.sh` copying the **full Foundry artifact** (not just the `abi` field) so viem/the API can read `abi` and bytecode uniformly, matching how the indexer loads it.

### #14 feat(types): shared domain types + zod (mortgage-general)

**Block:** 3 · **Type:** feat · **Scope:** types · **Estimate:** 30m · **Blocked by:** #2 · **Labels:** block-3, offchain

**Why.** Everything off-chain (indexer, NAV gate, reconciliation engine, replay, GraphQL, UI) speaks one domain vocabulary or it drifts. This ticket lands that vocabulary as the single shared, ABI-derived source of truth so the marquee reconciliation invariants compare like-typed values (an on-chain `claimable` and an off-chain `collected` must be the same branded `Usdc6` type, never two loose `bigint`s). The reason taxonomy is a TS discriminated union mirroring the Solidity custom errors — typed reason codes, not strings — and it carries the engine-only states (`NavAnomaly`, `ReconMismatch`) that have no on-chain analog.

**What.**
- Files to create:
  - `packages/shared/package.json` — Bun workspace package `@pcl/shared`, `"type": "module"`, exports `./*`; deps: `zod`, `viem`; devDeps: `vitest`, `fast-check`.
  - `packages/shared/tsconfig.json` — extends root `tsconfig.base.json`, `composite: true`, `strict: true`.
  - `packages/shared/src/brand.ts` — `type Brand<K, T> = K & { readonly __brand: T }`; branded scalars `type LoanId = Brand<string, 'LoanId'>`, `IdentityAddr = Brand<\`0x${string}\`, 'IdentityAddr'>`, `PositionId = Brand<string, 'PositionId'>`, `EventId = Brand<string, 'EventId'>` (canonical `${txHash}:${logIndex}`), `Usdc6 = Brand<bigint, 'Usdc6'>` (6-decimal fixed point), `Bps = Brand<number, 'Bps'>`, `UnixSeconds = Brand<number, 'UnixSeconds'>`; smart constructors `loanId(raw)`, `usdc6(raw)`, `eventId(txHash, logIndex)`, `bps(raw)` that validate-and-brand.
  - `packages/shared/src/reasons.ts` — `type ReasonCode = 'NotEligible' | 'ReceiverFrozen' | 'ReceiverNotVerified' | 'AccreditationRequired' | 'InsufficientReserve'` (mirrors the 5 Solidity custom errors) and `type EngineState = 'NavAnomaly' | 'ReconMismatch'`; discriminated union `type DomainError = { kind: ReasonCode; ... } | { kind: EngineState; ... }` with a `kind` discriminant; `const SOLIDITY_ERROR_SELECTORS: Record<\`0x${string}\`, ReasonCode>` keyed by 4-byte selector (computed from imported ABI in ticket 21's mapper, declared here).
  - `packages/shared/src/schemas.ts` — zod schemas + inferred types for `Loan` (`{ id: LoanId; principal: Usdc6; rateBps: Bps; status: 'Active'|'Defaulted'|'Repaid'; startedAt: UnixSeconds }`), `Identity` (`{ addr: IdentityAddr; verified: boolean; accredited: boolean; jurisdiction: 'US'|'nonUS'; frozen: boolean }`), `Position` (`{ id: PositionId; loan: LoanId; holder: IdentityAddr; principal: Usdc6; accrued: Usdc6; openedAt: UnixSeconds }`), `ChainEvent` (discriminated on `name`: `PositionOpened|Transfer|InterestClaimed|LoanStatusChanged`, each with `id: EventId; blockNumber: bigint; logIndex: number; payload`), `NavReading` (`{ loan: LoanId; navBps: Bps; observedAt: UnixSeconds; source: string }`), `ReserveState` (`{ balance: Usdc6; updatedAt: UnixSeconds }`). zod `.transform()` applies the brand constructors so a parsed value is already branded.
  - `packages/shared/src/index.ts` — barrel re-export of `brand`, `reasons`, `schemas`.
  - `packages/shared/test/schemas.test.ts` + `packages/shared/test/brand.prop.test.ts` (Vitest + fast-check).
- Files to modify:
  - root `package.json` — add `packages/*` to `workspaces`.
  - root `tsconfig.base.json` — add `paths` mapping `@pcl/shared` -> `packages/shared/src/index.ts`.
- Public surface: `@pcl/shared` exports all branded types, smart constructors, `ReasonCode`/`EngineState`/`DomainError`, and every zod schema + inferred type.

**Acceptance criteria.**
- [ ] `bun run --filter @pcl/shared typecheck` (tsc `--noEmit`) green, 0 errors.
- [ ] `bun x eslint packages/shared` green, 0 warnings.
- [ ] `Usdc6`, `Bps`, `LoanId`, `IdentityAddr`, `EventId` are nominal: assigning a raw `bigint` to a `Usdc6` parameter is a compile error (1 negative-type fixture under `// @ts-expect-error` proves it).
- [ ] `bun test packages/shared` green with >= 8 unit assertions: every zod schema round-trips a valid fixture and rejects >= 1 malformed fixture per schema with a typed `ZodError`.
- [ ] 1 fast-check property (>= 256 runs): for arbitrary `(txHash, logIndex)`, `eventId(txHash, logIndex)` is deterministic and injective (distinct inputs -> distinct ids), proving event-id stability the indexer (16) and replay (19) depend on.
- [ ] `ReasonCode` union has exactly the 5 spec reason codes and `EngineState` exactly `NavAnomaly`/`ReconMismatch`; an exhaustive `switch` over `DomainError['kind']` with no `default` compiles (proves union closure).
- [ ] CI `bun` job runs the shared package's lint + typecheck + test.
- [ ] Commit: `feat(types): shared domain types + zod schemas with branded ids`.

**Out of scope.**
- Generating types directly from `contracts/out/*.json` via a codegen step — types are authored to match the ABI by hand here; abitype/codegen is a later refactor, not this ticket.
- Postgres row<->domain mappers and SQL — that is ticket 15.

**Notes.** Landmine: viem returns `uint256` as native `bigint` but JSON/SSE serialization silently coerces `bigint` to `number` and loses precision above 2^53. Never `JSON.stringify` a `Usdc6` directly — add `usdc6ToString`/`usdc6FromString` here and make every boundary (DB, GraphQL, SSE) go through them. A single lossy serialization will surface as a phantom `ReconMismatch` in ticket 18, which is the worst possible place to debug it.

---
**Mortgage modeling (collateral generality — minimal but meaningful).**
- Add a `Property` type: `{ id: PropertyId; addressLabel: string; appraisedValue: bigint; lienPosition: number }`.
- Extend `Loan` with `collateralType: 'CRE' | 'RESIDENTIAL'`, `propertyId: PropertyId`, `ltvBps: number`, `dscrBps: number`.
- A `Loan` is "a first-lien **mortgage** on a `Property`," CRE today, residential-ready. `collateralType` is the seam where residential plugs into the same rails.

### #15 feat(db): Postgres schema + raw SQL migrations

**Block:** 3 · **Type:** feat · **Scope:** db · **Estimate:** 40m · **Blocked by:** #14 · **Labels:** block-3, offchain

**Why.** The off-chain side is a set of Postgres read models that the indexer (16), NAV gate (17), and reconciliation engine (18) write and read. Schema is raw, numbered SQL applied on startup — no ORM — so the storage shape is auditable and the reconciliation engine can `SELECT` against tables whose columns map 1:1 to the `@pcl/shared` domain types. The `chain_events` and `nav_readings` tables are the canonical, append-only inputs that deterministic replay (19) folds, so their ordering keys and uniqueness constraints are load-bearing.

**What.**
- Files to create:
  - `db/migrations/0001_init.sql` — `loans` (`id text pk`, `principal numeric(78,0) not null`, `rate_bps int not null`, `status text not null check (status in ('Active','Defaulted','Repaid'))`, `started_at bigint not null`); `identities` (`addr text pk`, `verified bool`, `accredited bool`, `jurisdiction text check (jurisdiction in ('US','nonUS'))`, `frozen bool`).
  - `db/migrations/0002_positions_events.sql` — `positions` (`id text pk`, `loan_id text references loans(id)`, `holder text references identities(addr)`, `principal numeric(78,0)`, `accrued numeric(78,0) not null default 0`, `opened_at bigint`, `unique(loan_id, holder)`); `chain_events` (`id text pk` — canonical `txHash:logIndex`, `name text not null`, `block_number bigint not null`, `log_index int not null`, `payload jsonb not null`, `ingested_at timestamptz default now()`, `unique(block_number, log_index)`), index `idx_chain_events_order on chain_events(block_number, log_index)`.
  - `db/migrations/0003_nav_reserve_recon.sql` — `nav_readings` (`id bigserial pk`, `loan_id text references loans(id)`, `nav_bps int not null`, `observed_at bigint not null`, `source text not null`, `accepted bool not null`, `reject_reason text`); `reserve` (single-row: `id int pk default 1 check (id = 1)`, `balance numeric(78,0) not null`, `updated_at bigint`); `recon_status` (`cycle_id bigserial pk`, `ran_at timestamptz default now()`, `ok bool not null`, `state text` — null on OK, `'NavAnomaly'|'ReconMismatch'` on halt, `failed_invariant text`, `state_hash text not null`, `detail jsonb`).
  - `db/migrations/0004_idempotency.sql` — `applied_migrations` (`filename text pk`, `applied_at timestamptz default now()`, `checksum text not null`).
  - `packages/shared/src/db/migrate.ts` — `applyMigrations(sql: Sql): Promise<{ applied: string[] }>`: reads `db/migrations/*.sql` sorted lexicographically, wraps each file in a transaction, records `filename`+`sha256` checksum in `applied_migrations`, throws `MigrationChecksumMismatch` if a previously-applied file's bytes changed (no silent re-edit).
  - `packages/shared/src/db/client.ts` — `makeSql(databaseUrl: string)` returning a `postgres` (`postgres` lib) client configured with `{ types: { bigint: postgres.BigInt } }` so `numeric(78,0)` round-trips through `bigint`/`Usdc6` without precision loss.
  - `db/migrations/README.md` — numbering + immutability rule (never edit an applied migration; add a new one).
  - `packages/shared/test/migrate.test.ts` (Vitest, against a throwaway Postgres via `DATABASE_URL`).
- Files to modify: `.env.example` — confirm `DATABASE_URL` documented (added in ticket 2).
- Public surface: `makeSql`, `applyMigrations`, `MigrationChecksumMismatch`.

**Acceptance criteria.**
- [ ] `applyMigrations` on a fresh database creates exactly 7 tables (`loans`, `identities`, `positions`, `chain_events`, `nav_readings`, `reserve`, `recon_status`) + `applied_migrations`; assert via `information_schema.tables`.
- [ ] Re-running `applyMigrations` is idempotent: second run applies 0 files, leaves row counts unchanged (1 test asserts `applied.length === 0`).
- [ ] Editing an already-applied migration file then re-running throws `MigrationChecksumMismatch` (1 test with a checksum fixture).
- [ ] `numeric(78,0)` round-trips a value > 2^53 (e.g. `10n ** 24n`) inserted and re-`SELECT`ed as an identical `bigint` (1 precision test) — guards the recon engine against phantom mismatches.
- [ ] `chain_events` rejects a duplicate `(block_number, log_index)` with a unique-violation (1 test) — the DB-level idempotency the indexer relies on.
- [ ] `bun run --filter @pcl/shared typecheck` + `bun x eslint packages/shared/src/db` green, 0 warnings.
- [ ] CI `bun` job provisions a Postgres service, runs the migration test suite (>= 5 tests) green.
- [ ] Commit: `feat(db): postgres read-model schema + numbered raw sql migrations`.

**Out of scope.**
- The viem indexer that populates `chain_events`/`positions` — that is ticket 16.
- Any ORM, query builder, or migration framework (Prisma/Drizzle/Knex) — raw SQL + a checksum-tracking applier only.

**Notes.** Landmine: `numeric` without an explicit cast comes back from `node-postgres`/`postgres` as a JS `string` by default, and `BigInt('123.0')` throws. Pin `numeric(78,0)` (scale 0, integer base units) everywhere money lives and configure the client `bigint` parser, so the indexer and recon engine never see a decimal point. 78 digits covers `uint256` (max ~1.16e77).

---
**Mortgage modeling.** Add a `properties` table (`id, address_label, appraised_value, lien_position`); add `collateral_type` ('CRE'|'RESIDENTIAL'), `property_id`, `ltv_bps`, `dscr_bps` to `loans`; index `loans(collateral_type)`.

### #16 feat(indexer): viem Fuji event indexer → read models

**Block:** 3 · **Type:** feat · **Scope:** indexer · **Estimate:** 55m · **Blocked by:** #13, #14, #15 · **Labels:** block-3, offchain

**Why.** The reconciliation engine can only prove on-chain and off-chain agree if it has a faithful, gap-free on-chain read model. This indexer is that bridge: it subscribes to `CreditToken` events on Fuji (and the local node for deterministic CI), and projects them into the `positions` / balance / accrual read tables. Idempotency on the canonical event id (`txHash:logIndex`) means a reorg, a restart, or a double-delivered log re-projects to the identical state — the precondition the deterministic-replay property (19) and matrix row 10 (`inject cash != claimable`) both stand on.

**What.**
- Files to create:
  - `indexer/package.json` — `@pcl/indexer`, deps `viem`, `postgres`, `zod`, `@pcl/shared`; script `start`: `bun run src/main.ts`.
  - `indexer/src/abi.ts` — re-exports the `CreditToken` ABI copied by `scripts/copy_abis.sh` (ticket 13) into `indexer/abi/CreditToken.json`; `as const` for viem type inference.
  - `indexer/src/client.ts` — `makeChainClient(rpcUrl: string)` -> viem `PublicClient` (`http` transport for Fuji, `webSocket` optional for local); chain config for Avalanche Fuji (chainId 43113) and a local anvil chain (31337).
  - `indexer/src/decode.ts` — `decodeChainEvent(log): ChainEvent` mapping viem decoded logs to the `@pcl/shared` `ChainEvent` union (`PositionOpened`, `Transfer`, `InterestClaimed`, `LoanStatusChanged`); builds `EventId` via `eventId(log.transactionHash, log.logIndex)`.
  - `indexer/src/project.ts` — pure-ish projectors: `applyPositionOpened(sql, ev)`, `applyTransfer(sql, ev)` (debit/credit holder balances; create position on first receipt; enforce `unique(loan_id, holder)`), `applyInterestClaimed(sql, ev)` (debit `reserve.balance`, reset position `accrued`), `applyLoanStatusChanged(sql, ev)`; each runs inside the same transaction that inserts the `chain_events` row, so projection and event-record commit atomically.
  - `indexer/src/ingest.ts` — `ingestEvent(sql, ev)`: `INSERT ... ON CONFLICT (id) DO NOTHING` into `chain_events`; if `rowCount === 0` (already seen) skip projection and return `{ status: 'duplicate' }`; else project and return `{ status: 'applied' }`.
  - `indexer/src/cursor.ts` — `getCursor(sql)` / `setCursor(sql, blockNumber)` persisting the last fully-processed block (in a `reserve`-style single-row `indexer_cursor` table; add `db/migrations/0005_indexer_cursor.sql`); on boot, backfill via `getLogs` from `cursor` to `latest`, then `watchContractEvent` for the live tail.
  - `indexer/src/main.ts` — wire: `makeSql` + `applyMigrations` + `makeChainClient`, backfill, subscribe, graceful shutdown.
  - `indexer/test/ingest.idempotency.prop.test.ts`, `indexer/test/project.test.ts` (Vitest + fast-check, against local node fixtures / a test Postgres).
  - `db/migrations/0005_indexer_cursor.sql`.
- Files to modify: `.env.example` — `FUJI_RPC`, `LOCAL_RPC`, `CREDIT_TOKEN_ADDRESS`, `DATABASE_URL` (confirm present).
- Public surface: `ingestEvent`, `decodeChainEvent`, the four `apply*` projectors, `getCursor`/`setCursor`, `makeChainClient`.

**Acceptance criteria.**
- [ ] 1 fast-check property (>= 256 runs): for an arbitrary sequence of decoded events containing arbitrary duplicates and reordered redeliveries, replaying through `ingestEvent` yields byte-identical final `positions` + balance rows as replaying the deduped, in-order sequence (idempotent + order-stable per `(blockNumber, logIndex)`).
- [ ] `ingestEvent` returns `{ status: 'duplicate' }` and performs 0 balance mutations on a re-delivered `EventId` (1 unit test asserting `reserve.balance` unchanged).
- [ ] Against the local node + `Deploy.s.sol` seed (ticket 12), a matrix-row-1 accredited-US invest produces exactly 1 `PositionOpened` row and 1 `positions` row with `accrued = 0` and correct `principal` (1 integration test).
- [ ] A `Transfer` that the chain would revert never reaches the indexer (no event emitted) — assert the read model has 0 rows after a reverted tx fixture (1 test), proving the indexer trusts on-chain truth, not attempted txs.
- [ ] `bun run --filter @pcl/indexer typecheck` + `bun x eslint indexer` green, 0 warnings; viem log decoding is fully typed off the `as const` ABI (no `any`).
- [ ] CI `bun` job: spin local EVM node + Postgres, deploy, run indexer test suite (>= 6 tests incl. the property) green.
- [ ] Commit: `feat(indexer): viem CreditToken indexer with idempotent event projection`.

**Out of scope.**
- Deep reorg rollback / un-projecting orphaned blocks beyond cursor-rewind — single-confirmation read model is sufficient for the testnet demo; document the limitation in DESIGN.md (29).
- The NAV / servicing feed and any reconciliation assertion — those are tickets 17 and 18; the indexer only mirrors chain state.

**Notes.** Landmine: Fuji can re-deliver logs across a WebSocket reconnect and `getLogs` backfill windows overlap the live `watchContractEvent` tail — the same log will arrive twice. The `ON CONFLICT (id) DO NOTHING` + projection-skip is the only thing standing between that and double-counted balances. Do projection and the `chain_events` insert in one transaction; if they split, a crash between them corrupts the read model and every downstream invariant lies.

### #17 feat(nav): NAV/servicing feed + validation gate

**Block:** 3 · **Type:** feat · **Scope:** nav · **Estimate:** 45m · **Blocked by:** #14, #15 · **Labels:** block-3, offchain

**Why.** NAV is the off-chain truth the on-chain accrual is supposed to track, and matrix row 9 (`NAV feed pushes +40% out-of-bounds -> HALT NavAnomaly, accrual frozen`) is one of the two hard-fail demonstrations. This gate ingests NAV / servicing-payment readings and refuses to let a stale, out-of-bounds, or anomalous reading enter the accepted feed — it is the first of the two HALT mechanisms (the reconciliation engine in 18 is the second). A rejected reading is recorded with a typed reason and flips engine state to `NavAnomaly`, freezing accrual until cleared.

**What.**
- Files to create:
  - `api/src/nav/bounds.ts` — `const NAV_BOUNDS = { maxJumpBps: bps(2000), maxStalenessSec: 3600 as UnixSeconds }` (configurable via env); pure predicate `withinBounds(prev: NavReading | null, next: NavReading, now: UnixSeconds): { ok: true } | { ok: false; state: 'NavAnomaly'; reason: NavRejectReason }` where `type NavRejectReason = 'Stale' | 'OutOfBounds' | 'NonMonotonicTimestamp' | 'UnknownLoan'`.
  - `api/src/nav/gate.ts` — `ingestNav(sql, reading: NavReading, now: UnixSeconds): Promise<NavGateResult>`; loads the last accepted reading for `reading.loan`, runs `withinBounds`; on accept inserts `nav_readings` with `accepted = true` and returns `{ accepted: true; reading }`; on reject inserts `accepted = false, reject_reason`, writes a `recon_status` halt row with `state = 'NavAnomaly'`, and returns `{ accepted: false; state: 'NavAnomaly'; reason }`. The +40% row-9 reading (jump > `maxJumpBps`) deterministically maps to `OutOfBounds`.
  - `api/src/nav/accrualGate.ts` — `isAccrualFrozen(sql, loan: LoanId): Promise<boolean>` (true while the latest `recon_status` for the loan is a `NavAnomaly` halt) and `accrualMultiplier(...)` used by the engine/UI to freeze the ticker; the gate does not touch on-chain accrual math, it gates whether the off-chain engine advances accrued.
  - `api/src/nav/types.ts` — `type NavGateResult = { accepted: true; reading: NavReading } | { accepted: false; state: 'NavAnomaly'; reason: NavRejectReason }` (discriminated union; re-exports `NavRejectReason`).
  - `api/src/nav/feed.ts` — `simulateFeed(sql, scenario)` test/demo driver that pushes a scripted NAV series including the row-9 spike, so `scripts/verify_matrix.ts` (27) can trigger the HALT deterministically.
  - `api/test/nav.bounds.prop.test.ts`, `api/test/nav.gate.test.ts` (Vitest + fast-check).
- Files to modify: `.env.example` — `NAV_MAX_JUMP_BPS`, `NAV_MAX_STALENESS_SEC`.
- Public surface: `ingestNav`, `withinBounds`, `isAccrualFrozen`, `NavGateResult`, `NavRejectReason`, `NAV_BOUNDS`.

**Acceptance criteria.**
- [ ] Matrix row 9: a reading +40% (`+4000 bps`) over the last accepted NAV (bound `2000`) returns `{ accepted: false, state: 'NavAnomaly', reason: 'OutOfBounds' }`, writes 1 `recon_status` row with `state='NavAnomaly'`, and `isAccrualFrozen(loan)` becomes `true` (1 integration test asserting all three).
- [ ] A reading older than `maxStalenessSec` -> `reason: 'Stale'`; a reading with `observedAt <= last accepted observedAt` -> `reason: 'NonMonotonicTimestamp'`; a reading for an unseeded loan -> `reason: 'UnknownLoan'` (3 unit tests, one per branch).
- [ ] An in-bounds, fresh, monotonic reading -> `{ accepted: true }`, inserts `nav_readings.accepted = true`, writes 0 halt rows (1 test).
- [ ] 1 fast-check property (>= 256 runs): for any sequence of NAV deltas, every accepted reading is within `maxJumpBps` of its predecessor and strictly timestamp-monotonic, and any reading violating either is rejected — the gate never admits an out-of-bounds reading (no false negatives).
- [ ] `withinBounds` is pure (no I/O); calling it twice with identical args yields identical results (1 determinism assertion) — required so replay (19) can re-derive NAV acceptance.
- [ ] `bun run --filter @pcl/api typecheck` + `bun x eslint api/src/nav` green, 0 warnings; reason codes are union members, never strings compared by literal at call sites.
- [ ] CI `bun` job runs the NAV suite (>= 6 tests incl. the property) against a test Postgres, green.
- [ ] Commit: `feat(nav): off-chain NAV feed + validation gate with NavAnomaly halt`.

**Out of scope.**
- Pushing a NAV oracle on-chain or any contract interaction — NAV is off-chain truth; the on-chain accrual freeze is modeled by the engine/UI reading `isAccrualFrozen`, not by a tx (real oracle is in the DESIGN.md cut list).
- The 4-invariant reconciliation cycle and `ReconMismatch` — that is ticket 18; this ticket owns only the NAV-bounds HALT (row 9).

**Notes.** Landmine: bounds must compare against the last *accepted* reading, not the last *received* one — otherwise a single rejected spike becomes the new baseline and the next legitimate reading looks like a 40% drop, cascading false `NavAnomaly`s. The `gate` query filters `WHERE accepted = true ORDER BY observed_at DESC LIMIT 1`. Also clamp `now` to a `UnixSeconds` source the replay harness can inject, or staleness checks become non-deterministic and break ticket 19's property.

### #18 feat(recon): reconciliation engine — invariants + HALT

**Block:** 3 · **Type:** feat · **Scope:** recon · **Estimate:** 60m · **Blocked by:** #16, #17 · **Labels:** block-3, recon

**Why.** This is the marquee. The entire thesis is that off-chain servicing cash and on-chain claimable balances provably agree, and the system HALTS on mismatch rather than distributing against a broken book. Each reconciliation cycle asserts the 4 invariants and, on any break, refuses distribution and emits `ReconMismatch` — matrix row 10 (`inject cash != claimable -> HALT distribution ReconMismatch`). This is the gate the demo, the README narrative, and the interview all hang on; it consumes the indexer's on-chain read model (16) and the NAV gate's accepted feed (17).

**What.**
- Files to create:
  - `api/src/recon/invariants.ts` — the 4 invariants as pure predicates over a `ReconSnapshot`: `I1_supplyBacked` (`onchain CreditToken.totalSupply == sum(loans.principal backed)`), `I2_claimableCovered` (`sum(onchain claimable across holders) <= offchain collected cash`), `I3_navInBounds` (latest accepted NAV per active loan is non-anomalous), `I4_identityValid` (every current holder is `verified` and compliance-eligible per `identities`); each returns `{ ok: true } | { ok: false; failed: InvariantId; detail }` where `type InvariantId = 'SupplyBacked' | 'ClaimableCovered' | 'NavInBounds' | 'IdentityValid'`.
  - `api/src/recon/snapshot.ts` — `loadSnapshot(sql, chain): Promise<ReconSnapshot>` reading `positions`, `reserve`, accepted `nav_readings`, `identities`, and on-chain `totalSupply`/`claimable` via viem; all money as `Usdc6`.
  - `api/src/recon/engine.ts` — `runReconCycle(sql, chain, now): Promise<ReconResult>` evaluating `[I1, I2, I3, I4]` in order; on all-pass writes a `recon_status` row `{ ok: true, state: null, state_hash }` and returns `{ ok: true; stateHash }`; on first failure writes `{ ok: false, state: 'ReconMismatch' (or 'NavAnomaly' if I3), failed_invariant, detail, state_hash }`, sets a distribution-halt flag, and returns `{ ok: false; state; failed; detail }`. `type ReconResult = { ok: true; stateHash: string } | { ok: false; state: EngineState; failed: InvariantId; detail: unknown }`.
  - `api/src/recon/halt.ts` — `isDistributionHalted(sql): Promise<boolean>` (true while the latest `recon_status.ok = false`); `assertCanDistribute(sql)` throws a typed `DistributionHalted` used by the claim mutation (ticket 21) so a `ReconMismatch` actually blocks payouts, not just logs.
  - `api/src/recon/types.ts` — `ReconSnapshot`, `ReconResult`, `InvariantId`, `DistributionHalted` re-exports.
  - `api/test/recon.invariants.test.ts`, `api/test/recon.engine.row10.test.ts`, `api/test/recon.invariants.prop.test.ts` (Vitest + fast-check).
- Files to modify: `api/src/nav/gate.ts` reference only (engine reuses `isAccrualFrozen` for I3); no behavioral edit.
- Public surface: `runReconCycle`, the 4 `I*` predicates, `loadSnapshot`, `isDistributionHalted`, `assertCanDistribute`, `ReconResult`, `InvariantId`.

**Acceptance criteria.**
- [ ] Matrix row 10: injecting off-chain collected cash less than `sum(onchain claimable)` makes `runReconCycle` return `{ ok: false, state: 'ReconMismatch', failed: 'ClaimableCovered' }`, writes 1 halt `recon_status` row, and `isDistributionHalted()` becomes `true` (1 integration test asserting all three).
- [ ] Each of the 4 invariants fails independently under a targeted fixture and produces its own `InvariantId` (4 unit tests: supply!=backed -> `SupplyBacked`; over-claimable -> `ClaimableCovered`; anomalous NAV -> `NavInBounds` with `state='NavAnomaly'`; frozen/unverified holder -> `IdentityValid`).
- [ ] All-green snapshot -> `{ ok: true, stateHash }`, `recon_status.ok = true`, `isDistributionHalted()` false, 0 halt rows (1 test).
- [ ] `assertCanDistribute` throws `DistributionHalted` after a `ReconMismatch` and does not throw after a clean cycle (1 test) — proves the HALT blocks the claim path, not just reporting.
- [ ] 1 fast-check property (>= 256 runs): the conjunction `I1 && I2 && I3 && I4` over arbitrary snapshots equals `runReconCycle(...).ok`, and a single deliberately-broken invariant always yields `ok === false` with that invariant named (soundness: the cycle never reports OK while any invariant is violated).
- [ ] Invariant predicates are pure (snapshot in, verdict out, no I/O) so they are reusable inside replay (19) (1 determinism assertion).
- [ ] `bun run --filter @pcl/api typecheck` + `bun x eslint api/src/recon` green, 0 warnings.
- [ ] CI `bun` job: local EVM + Postgres + deploy + indexer, run recon suite (>= 8 tests incl. the property) green.
- [ ] Commit: `feat(recon): reconciliation engine with 4 invariants + ReconMismatch halt`.

**Out of scope.**
- Auto-remediation / un-halting after a mismatch (operator clears halt manually in the demo) — record the halt and block distribution only; recovery UX is out of the demo scope.
- The deterministic replay + state-hash equivalence proof — that is ticket 19, which reuses these pure invariants and `loadSnapshot`'s state shape.

**Notes.** Landmine: I2 must compare `Usdc6` to `Usdc6` in identical base units — the classic false `ReconMismatch` is an off-chain value stored as dollars (2 decimals) vs an on-chain value in 6-decimal base units, or a `bigint` silently widened through JSON. Pull both sides through `@pcl/shared` constructors and assert the same scale. Evaluate invariants in a fixed order and short-circuit on first failure so the recorded `failed_invariant` is deterministic; non-deterministic failure ordering would make matrix row 10 flaky in CI.

### #19 feat(recon): deterministic replay + state hash

**Block:** 3 · **Type:** feat · **Scope:** recon · **Estimate:** 40m · **Blocked by:** #16, #18 · **Labels:** block-3, recon

**Why.** A reconciliation gate is only trustworthy if the state it reconciles is itself deterministic. This ticket proves it: `replay(chain_events + nav_readings)` folds the canonical append-only inputs into a single deterministic state, `stateHash()` fingerprints it, and a fast-check property asserts that *any* valid interleaving of those events produces the identical `stateHash`. That is the formal backbone of the thesis (`+ property: replay(chainEvents+nav) -> identical stateHash for any interleaving`) and the strongest single claim in the demo — the book is reproducible from its inputs, byte-for-byte.

**What.**
- Files to create:
  - `api/src/replay/state.ts` — `type ReplayState = { positions: Map<PositionId, Position>; reserve: ReserveState; navByLoan: Map<LoanId, NavReading>; halted: { state: EngineState; failed?: InvariantId } | null }`; `emptyState(): ReplayState`.
  - `api/src/replay/fold.ts` — pure reducer `applyInput(s: ReplayState, input: ReplayInput): ReplayState` where `type ReplayInput = { kind: 'chain'; event: ChainEvent } | { kind: 'nav'; reading: NavReading }`; reuses the indexer projectors' logic (16) and the NAV `withinBounds` gate (17) and the recon invariants (18) so replay and live both run identical math. Inputs are totally ordered by a deterministic key `orderKey(input)` (chain: `(blockNumber, logIndex)`; nav: `(observedAt, id)`), so any input *set* has one canonical fold order regardless of arrival interleaving.
  - `api/src/replay/replay.ts` — `replay(inputs: ReplayInput[]): ReplayState` = sort by `orderKey` then `reduce(applyInput, emptyState())`; `loadInputs(sql): Promise<ReplayInput[]>` reading `chain_events` + `nav_readings` from Postgres.
  - `api/src/replay/hash.ts` — `stateHash(s: ReplayState): string`: canonical-serialize `ReplayState` (sorted map keys, `Usdc6`/`bigint` via `usdc6ToString`, stable field order) then `keccak256` (viem) -> `0x...`; `canonicalize(s)` exposed for debugging diffs.
  - `api/src/replay/types.ts` — `ReplayState`, `ReplayInput`, re-exports.
  - `api/test/replay.interleaving.prop.test.ts` — the headline fast-check property.
  - `api/test/replay.hash.test.ts`, `api/test/replay.golden.test.ts` (Vitest).
  - `api/src/replay/golden.json` — a recorded canonical state + hash for the matrix seed, regenerated by a script flag, so a logic change that alters state surfaces as a golden-hash diff.
- Files to modify: `api/src/recon/engine.ts` — have `runReconCycle` compute its `state_hash` via `stateHash(replay(loadInputs(...)))` so the live recon row and a cold replay share one fingerprint.
- Public surface: `replay`, `loadInputs`, `stateHash`, `applyInput`, `emptyState`, `ReplayState`, `ReplayInput`.

**Acceptance criteria.**
- [ ] Headline property (fast-check, >= 256 runs): for an arbitrary input set and an arbitrary permutation of it, `stateHash(replay(permA)) === stateHash(replay(permB))` — interleaving-invariant state. Uses `fc.shuffledSubarray`/permutation arbitraries over a generated input pool.
- [ ] 1 property (>= 256 runs): `applyInput` is a pure function — replaying the same canonical input list twice yields `===`-equal `stateHash` (referential transparency, no hidden clock/RNG).
- [ ] Golden test: `stateHash(replay(seedInputs))` equals the committed `golden.json` hash; a deliberate 1-base-unit perturbation of any input changes the hash (1 test asserting inequality) — proves the hash is sensitive, not vacuous.
- [ ] `replay` over inputs that include the row-9 NAV spike reaches `halted.state === 'NavAnomaly'`, and over the row-10 cash-shortfall reaches `halted.state === 'ReconMismatch'` — replay reproduces both HALT outcomes deterministically (2 assertions).
- [ ] The live `runReconCycle` `state_hash` (ticket 18) equals a cold `stateHash(replay(loadInputs(sql)))` for the same DB snapshot (1 integration test) — live and replay agree.
- [ ] `stateHash` is serialization-stable: re-running on a `ReplayState` rebuilt from `canonicalize` round-trip yields the identical hash (1 test); `bigint`/`Usdc6` never serialized lossily.
- [ ] `bun run --filter @pcl/api typecheck` + `bun x eslint api/src/replay` green, 0 warnings.
- [ ] CI `bun` job runs the replay suite (>= 6 tests incl. both properties) green; the interleaving property is the deterministic-replay invariant called out in the spec.
- [ ] Commit: `feat(recon): deterministic replay + keccak state hash with interleaving property`.

**Out of scope.**
- Snapshotting / incremental replay-from-checkpoint for performance — full replay-from-genesis over the capped fixture (6 loans, 10 scenarios) is fast enough; no checkpoint store.
- Persisting replayed state back as the authoritative read model — replay is a verification oracle that the indexer's live projection is checked against, not a writer (it shares projector logic but does not own `positions`).

**Notes.** Landmine: determinism dies on three things — `JSON.stringify` key order (non-deterministic across engines; sort keys explicitly), `bigint` serialization (must route through `usdc6ToString`, never the default thrower), and `Map`/`Set` iteration order (insertion-ordered, so sort entries before hashing). Any wall-clock or `Math.random` inside `applyInput` (e.g. NAV staleness using `Date.now()`) silently breaks the interleaving property — thread a deterministic `now` derived from the inputs (max `observedAt`) instead. Get this wrong and the property passes locally and flakes only in CI under a different V8 build.

### #20 feat(api): GraphQL schema (Pothos code-first)

**Block:** 4 · **Type:** feat · **Scope:** api · **Estimate:** 45m · **Blocked by:** #14, #15 · **Labels:** block-4, api

**Why.** The React app (block-5) and the matrix verifier (ticket 27) need one typed, code-first surface to read loans/positions/recon status and to drive the three write paths the thesis is built on: `invest`, `transfer`, `claim`. This ticket defines the GraphQL *schema only* (types, inputs, query/mutation field signatures, typed error-code enum) so resolvers (ticket 21), SSE (ticket 22), and tx-status (ticket 23) build against a frozen contract. Schema-before-implementation mirrors the repo rule "Interfaces/ABIs before implementations." It surfaces `reconciliationStatus` so the marquee reconciliation engine (ticket 18) is a first-class query, and exposes eligibility/HALT reason codes as a typed enum rather than strings, satisfying matrix rows 1-10 at the read layer.

**What.**
Files to create:
- `api/src/schema/builder.ts` — Pothos `SchemaBuilder` instance. Generic params wire scalars and the context type: `new SchemaBuilder<{ Scalars: { BigIntStr: { Input: string; Output: string }; DateTime: { Input: Date; Output: Date }; Address: { Input: string; Output: string } }; Context: ApiContext }>()`. Register plugins for simple-objects only (no resolver logic here).
- `api/src/schema/scalars.ts` — `BigIntStr` (uint256 wei as decimal string, never JS number), `Address` (0x EIP-55), `DateTime`. Validate with `zod` on parse.
- `api/src/schema/enums.ts` — `export const ReasonCode = builder.enumType('ReasonCode', { values: ['NotEligible','ReceiverFrozen','ReceiverNotVerified','AccreditationRequired','InsufficientReserve','NavAnomaly','ReconMismatch'] as const })`. `export const ReconState = builder.enumType('ReconState', { values: ['OK','HALTED'] as const })`. `LoanStatus` = `['Active','Frozen','Matured']`. `Jurisdiction` = `['US','NonUS']`. `TxState` = `['PENDING','CONFIRMED','REVERTED']`.
- `api/src/schema/types/loan.ts` — `objectRef` `Loan { id: ID!, principal: BigIntStr!, ratePerSecond: BigIntStr!, ltvBps: Int!, dscrBps: Int!, status: LoanStatus!, dataRoomUri: String }`. Source type = `Loan` from `@shared/types` (ticket 14).
- `api/src/schema/types/identity.ts` — `Identity { wallet: Address!, verified: Boolean!, accredited: Boolean!, jurisdiction: Jurisdiction!, frozen: Boolean! }`.
- `api/src/schema/types/position.ts` — `Position { id: ID!, holder: Address!, loanId: ID!, principal: BigIntStr!, accrued: BigIntStr!, claimable: BigIntStr!, lastAccrualAt: DateTime!, optimistic: Boolean! }` (the `optimistic` flag is populated by ticket 23; declare it here).
- `api/src/schema/types/reserve.ts` — `ReserveState { balance: BigIntStr!, totalClaimable: BigIntStr! }`.
- `api/src/schema/types/reconciliation.ts` — `ReconciliationStatus { state: ReconState!, cycle: Int!, checkedAt: DateTime!, invariants: [InvariantResult!]!, haltReason: ReasonCode }`; `InvariantResult { name: String!, ok: Boolean!, onchain: BigIntStr, offchain: BigIntStr, delta: BigIntStr }`. The four `name` values: `supplyBacked`, `claimableCovered`, `navInBounds`, `identityValid` (1:1 with ticket 18's four invariants).
- `api/src/schema/types/tx.ts` — `TxReceiptRef { hash: String!, state: TxState!, reasonCode: ReasonCode, blockNumber: BigIntStr, position: Position }`. This is the union-free mutation return shape used by ticket 23.
- `api/src/schema/inputs.ts` — `InvestInput { loanId: ID!, wallet: Address!, amount: BigIntStr! }`; `TransferInput { loanId: ID!, from: Address!, to: Address!, amount: BigIntStr! }`; `ClaimInput { loanId: ID!, wallet: Address! }`.
- `api/src/schema/query.ts` — `builder.queryType` with fields: `loans: [Loan!]!`, `loan(id: ID!): Loan`, `position(holder: Address!, loanId: ID!): Position`, `positions(holder: Address!): [Position!]!`, `reserve: ReserveState!`, `reconciliationStatus: ReconciliationStatus!`. Resolvers are `throw new Error('NOT_IMPLEMENTED')` stubs in this ticket (ticket 21 fills them).
- `api/src/schema/mutation.ts` — `builder.mutationType` with fields `invest(input: InvestInput!): TxReceiptRef!`, `transfer(input: TransferInput!): TxReceiptRef!`, `claim(input: ClaimInput!): TxReceiptRef!`. Stub resolvers throw `NOT_IMPLEMENTED`.
- `api/src/schema/index.ts` — imports every type module for side-effect registration, `export const schema = builder.toSchema()`.
- `api/src/context.ts` — `export interface ApiContext { db: Sql; chain: { publicClient: PublicClient; walletClient: WalletClient }; recon: ReconReader }` (concrete construction lands in ticket 21; declare the interface here).
- `api/scripts/print-schema.ts` — `printSchema(schema)` to stdout; writes `api/schema.graphql` snapshot.
- `api/test/schema.test.ts` — Vitest assertions over the built schema (see criteria).

Public surface added: the `schema` export, the `ApiContext` interface, the `ReasonCode`/`ReconState`/`TxState` enums, and the committed `api/schema.graphql` SDL snapshot.

**Acceptance criteria.**
- [ ] 1. `bun run api/scripts/print-schema.ts > api/schema.graphql` succeeds and the committed `api/schema.graphql` contains exactly these 3 mutation fields and 6 query fields named above (assert by snapshot diff == 0).
- [ ] 2. `ReasonCode` enum exposes exactly 7 values; `api/test/schema.test.ts` asserts the set equals `{NotEligible,ReceiverFrozen,ReceiverNotVerified,AccreditationRequired,InsufficientReserve,NavAnomaly,ReconMismatch}` (length === 7).
- [ ] 3. `ReconciliationStatus.invariants` resolves to a list whose 4 declared invariant names are `supplyBacked,claimableCovered,navInBounds,identityValid` — test asserts the enum/string set in the type config (count === 4).
- [ ] 4. `graphql.validateSchema(schema)` returns `[]` (no schema errors); test fails on any non-empty array.
- [ ] 5. `BigIntStr` scalar round-trips `'115792089237316195423570985008687907853269984665640564039457584007913129639935'` (uint256 max) without precision loss; a fast-check property test (`fc.bigUintN(256)`) over >=256 runs asserts `parse(serialize(x)) === x.toString()`.
- [ ] 6. `bun run lint` (eslint) and `bun run typecheck` (`tsc --noEmit`) exit 0; the bun CI job (ticket 3) stays green.
- [ ] 7. At least 8 Vitest assertions in `api/test/schema.test.ts` pass (`bun run test` reports 8+ green in this file).

**Out of scope.**
- Resolver bodies, on-chain signer wiring, and Postgres reads (all ticket 21 — stubs only here).
- Subscriptions/SSE field definitions — the live feed is delivered out-of-band over an SSE endpoint in ticket 22, not as a GraphQL `subscription` type.

**Notes.** Never type token amounts as GraphQL `Int`/`Float` — uint256 overflows IEEE-754 and silently corrupts balances; that is exactly the off-chain/on-chain drift the reconciliation engine exists to catch, so a typed-number bug here would mask the marquee. Keep every amount as `BigIntStr`. Generate the SDL snapshot in CI and diff it so an accidental schema change (e.g. a renamed reason code) fails the build.

### #21 feat(api): resolvers wired to chain + reconciliation

**Block:** 4 · **Type:** feat · **Scope:** api · **Estimate:** 55m · **Blocked by:** #8, #16, #18, #20 · **Labels:** block-4, api

**Why.** Resolvers are where the hybrid stack closes: mutations sign and broadcast real transactions to the Avalanche Fuji C-Chain (and the local node in CI/tests), and queries read the Postgres read models the indexer (ticket 16) and reconciliation engine (ticket 18) populate. This is the seam the matrix exercises end-to-end — rows 1-2 (invest OK), 3-6 (transfer/eligibility reverts), 7-8 (claim OK / InsufficientReserve) — so the on-chain `CreditToken` custom errors (ticket 8) MUST be decoded and surfaced as the typed `ReasonCode` enum (ticket 20), not as opaque RPC strings. The reconciliation gate is enforced *here*: when ticket 18 reports `HALTED`, `claim`/`invest` refuse to broadcast and return `ReconMismatch`/`NavAnomaly` (matrix rows 9-10), proving the HALT actually blocks distribution rather than just lighting a UI banner.

**What.**
Files to create/modify:
- `api/src/context.ts` (modify) — implement `createContext()`: build a viem `publicClient` + `walletClient` from `FUJI_RPC`/`PRIVATE_KEY` (falls back to the local node RPC when `CHAIN=local`), a `postgres` `Sql` pool from `DATABASE_URL`, and a `ReconReader` that reads `recon_status` (ticket 15 table, ticket 18 writer). Load `CreditToken` ABI/address from `api/src/chain/abis/` (exported by `scripts/copy_abis.sh`, ticket 13).
- `api/src/chain/credit-token.ts` — typed viem bindings: `getCreditToken(ctx): { read, write }` via `getContract({ abi, address, client })`. Export `INVEST_FN`, `TRANSFER_FN`, `CLAIM_FN` names.
- `api/src/chain/errors.ts` — `export function decodeReason(err: unknown): ReasonCode | null`. Use viem `BaseError.walk(e => e instanceof ContractFunctionRevertedError)` then match `data.errorName` against the 5 custom errors. `export function mapReasonToHttpCode(r: ReasonCode): string` for the GraphQL `extensions.code`.
- `api/src/resolvers/queries.ts` — implement the 6 query resolvers from ticket 20 as raw parameterized SQL against `loans`, `positions`, `reserve`, `recon_status`, `identities`. No ORM. e.g. `loans` -> `SELECT ... FROM loans ORDER BY id`; `reconciliationStatus` -> latest `recon_status` row + its 4 invariant rows. All `BigIntStr` columns are `numeric`/`text` -> returned as strings.
- `api/src/resolvers/mutations.ts` — implement `invest`, `transfer`, `claim`:
  - `async function broadcastGated(ctx, action, simulateFn)`: first read `reconciliationStatus`; if `state === 'HALTED'`, throw `ReconHaltError(ctx.recon.haltReason)` WITHOUT touching the chain. Else `publicClient.simulateContract(...)` (this reverts with the typed custom error pre-flight, cheap), then `walletClient.writeContract(...)`, return the tx hash for ticket 23 to track.
  - `invest` -> `simulate/write` token mint/position-open path; maps revert -> `NotEligible`/`AccreditationRequired`.
  - `transfer` -> maps -> `ReceiverFrozen`/`ReceiverNotVerified`/`NotEligible`.
  - `claim` -> maps -> `InsufficientReserve`.
  - On caught revert: `const code = decodeReason(e)` -> throw `GraphQLError(code, { extensions: { code, reasonCode: code } })`.
- `api/src/errors.ts` — typed error classes (discriminated, not strings): `class ReconHaltError extends GraphQLError` (carries `NavAnomaly|ReconMismatch`), `class ChainRevertError extends GraphQLError` (carries a `ReasonCode`). A `formatError` hook for graphql-yoga that guarantees `extensions.code` is always one of the 7 `ReasonCode`s or `INTERNAL`.
- `api/src/server.ts` — `createYoga({ schema, context: createContext })` on graphql-yoga; export the fetch handler; `Bun.serve` entry in `api/src/index.ts`.
- `api/test/resolvers.queries.test.ts`, `api/test/resolvers.mutations.test.ts` — Vitest with a mocked viem client + an ephemeral Postgres (or `pg-mem`/testcontainer) seeded from migrations.
- `api/test/errors.decode.test.ts` — feeds raw encoded revert data for all 5 custom errors through `decodeReason`.

Public surface: `createContext`, `decodeReason`, `mapReasonToHttpCode`, `broadcastGated`, the yoga server handler, and the typed error classes.

**Acceptance criteria.**
- [ ] 1. `decodeReason` correctly maps all 5 on-chain custom-error selectors to their `ReasonCode` — `api/test/errors.decode.test.ts` has 5 passing cases plus 1 case asserting an unknown selector returns `null` (6 green).
- [ ] 2. Query resolvers return read-model rows: with a seeded DB, `loans` returns 6 rows and `reconciliationStatus.invariants` returns 4 rows (asserted lengths 6 and 4).
- [ ] 3. Every `BigIntStr` field returned by a resolver `typeof === 'string'` (a test walks `invest`+`position` results and asserts no `number` amounts) — protects against the IEEE-754 landmine from ticket 20.
- [ ] 4. When `recon_status.state = 'HALTED'`, `claim` and `invest` throw with `extensions.code` in `{ReconMismatch,NavAnomaly}` and `publicClient.writeContract` is asserted NOT called (mock call-count === 0) — covers matrix rows 9-10 at the API layer.
- [ ] 5. A simulated `InsufficientReserve` revert from `claim` surfaces as a `GraphQLError` with `extensions.code === 'InsufficientReserve'` (matrix row 8).
- [ ] 6. `bun run lint`, `bun run typecheck`, and `bun run test` exit 0; bun CI job (ticket 3) green; >= 14 Vitest assertions across the three new test files.
- [ ] 7. A fast-check property test asserts `decodeReason` is total over arbitrary revert payloads — for any `fc.uint8Array()` revert `data`, it returns a value in the 7-member `ReasonCode` set or `null`, never throws (>=256 runs).

**Out of scope.**
- Confirmation polling / pending->confirmed lifecycle and optimistic position reconciliation (ticket 23 — this ticket returns the tx hash and stops).
- The reconciliation cycle computation itself (ticket 18); resolvers only *read* `recon_status` and gate on it.

**Notes.** Always `simulateContract` before `writeContract`: simulation surfaces the typed custom error for free (so eligibility reverts cost no gas and no broadcast) and gives a clean hash-less failure for matrix rows 3-6, 8. Use a single dedicated server signer key from `PRIVATE_KEY` for all writes (per-user wallet signing is the UI's job in ticket 25). The HALT check MUST precede simulation — gating after broadcast would let a mismatched distribution through and defeat the marquee.

### #22 feat(api): SSE live feed — accrual + recon status

**Block:** 4 · **Type:** feat · **Scope:** api · **Estimate:** 35m · **Blocked by:** #21 · **Labels:** block-4, api

**Why.** The position dashboard (ticket 24) shows a *live* accrual ticker and the health panel (ticket 26) shows live reconciliation state with HALT banners. Polling GraphQL for per-second accrual would hammer the API and lag the `NavAnomaly`/`ReconMismatch` HALT that the thesis is about catching *immediately*. This ticket delivers a server-sent-events push feed straight off the Postgres read models — accrual deltas and reconciliation status — so a HALT propagates to the UI within one cycle (matrix rows 9-10 become visible, not just enforced). SSE (not WebSockets, not GraphQL subscriptions) matches the spec's "SSE for live feeds."

**What.**
Files to create:
- `api/src/sse/bus.ts` — an in-process `EventBus` (typed `EventEmitter` wrapper). Event union (discriminated, not strings): `type FeedEvent = { type: 'accrual'; data: AccrualTick } | { type: 'recon'; data: ReconciliationStatus } | { type: 'tx'; data: TxReceiptRef } | { type: 'heartbeat'; data: { ts: string } }`. `AccrualTick { holder: Address; loanId: string; accrued: BigIntStr; claimable: BigIntStr; at: DateTime }`. Re-use the ticket-20 source types.
- `api/src/sse/sources.ts` — pollers that turn read-model changes into bus events without the *client* polling: `startAccrualSource(ctx, bus)` recomputes per-holder accrued from `positions` + loan `ratePerSecond` on a fixed tick (default 1000ms) and emits `accrual`; `startReconSource(ctx, bus)` watches `recon_status` (Postgres `LISTEN/NOTIFY` on a `recon_changed` channel, with a polling fallback) and emits `recon` on every new cycle or state transition. The DB trigger/NOTIFY is added as a migration delta in `db/migrations/` referencing ticket 15's `recon_status` table.
- `api/src/sse/handler.ts` — `export function sseHandler(req: Request, ctx, bus): Response`. Returns a `text/event-stream` `ReadableStream`. Writes `id:`/`event:`/`data:` frames; supports `Last-Event-ID` resume (replay from an in-memory ring buffer of the last N=128 events); emits a `heartbeat` comment every 15s to keep Fuji-latency-tolerant proxies open; tears down sources/listeners on `req.signal` abort. Optional `?holder=0x..` filter for the accrual stream.
- `api/src/server.ts` (modify) — mount `GET /sse` -> `sseHandler`; start `startAccrualSource`/`startReconSource` once at boot; share one `bus` across connections.
- `api/src/sse/serialize.ts` — frame encoder; guarantees every amount is `BigIntStr` (string), `JSON.stringify` with a bigint replacer.
- `api/test/sse.test.ts`, `api/test/sse.sources.test.ts` — Vitest: drive the bus, parse emitted frames, assert ordering/resume.

Public surface: `GET /sse` endpoint (`event: accrual|recon|tx|heartbeat`), the `FeedEvent` union, `EventBus`, `sseHandler`, `startAccrualSource`, `startReconSource`.

**Acceptance criteria.**
- [ ] 1. A test client connecting to `sseHandler` receives at least 3 `event: accrual` frames within 3.5s at a 1000ms tick, each with `accrued`/`claimable` as decimal strings (`typeof === 'string'`).
- [ ] 2. Emitting a `recon` event with `state: 'HALTED'` and `haltReason: 'NavAnomaly'` produces exactly one `event: recon` frame whose parsed `data.haltReason === 'NavAnomaly'` (matrix row 9 propagation).
- [ ] 3. Reconnecting with `Last-Event-ID: <n>` replays only events with id > n from the ring buffer (assert the first replayed id === n+1, no duplicates).
- [ ] 4. Aborting `req.signal` removes the bus listener and stops the source timer — test asserts listener count returns to its pre-connect baseline and no further writes occur (0 writes after abort).
- [ ] 5. A `heartbeat` comment/event is emitted within 15.5s of an idle connection (keep-alive verified).
- [ ] 6. `bun run lint`, `bun run typecheck`, `bun run test` exit 0; bun CI job (ticket 3) green; >= 10 Vitest assertions across the two SSE test files.
- [ ] 7. A fast-check property test feeds an arbitrary interleaving of `accrual`/`recon`/`tx` events through the bus->frame encoder and asserts every emitted frame parses back to a valid `FeedEvent` discriminant and monotonically increasing `id` (>=256 runs).

**Out of scope.**
- Producing the reconciliation cycles or accrual ground-truth on-chain (tickets 18/9) — this feed only *broadcasts* what the read models already hold.
- Client-side `EventSource` consumption, reconnect/backoff UI, and rendering (block-5 UI, tickets 24/26).

**Notes.** The accrual ticker is a *display projection* recomputed off `positions.principal * ratePerSecond * elapsed`; it is NOT a source of truth and must never be written back — the on-chain accrued value (ticket 9) and the reconciliation engine (ticket 18) remain authoritative, otherwise the ticker could drift the very numbers recon is meant to validate. Prefer Postgres `LISTEN/NOTIFY` for `recon` so a HALT is pushed the instant ticket 18 commits the row, with a short-interval poll only as a fallback when the listener connection drops.

### #23 feat(api): tx-status tracking + optimistic position

**Block:** 4 · **Type:** feat · **Scope:** api · **Estimate:** 35m · **Blocked by:** #21 · **Labels:** block-4, api

**Why.** Fuji confirmations take seconds, but `invest`/`transfer`/`claim` (ticket 21) return the instant the tx is broadcast. Without a lifecycle the UI (ticket 25) can't tell pending from confirmed from reverted, and an `invest` would show nothing until the indexer (ticket 16) catches up. This ticket tracks `PENDING -> CONFIRMED|REVERTED`, writes an *optimistic* position immediately, and then reconciles it against the indexer's canonical read model — making the optimistic row disappear/replace exactly when truth arrives. That handoff is a micro-instance of the project thesis (off-chain projection must converge to on-chain reality) and is what lets the demo feel live on a real testnet.

**What.**
Files to create/modify:
- `db/migrations/00NN_tx_tracking.sql` — new tables (extends ticket-15 schema, raw SQL, no ORM): `tx_status(hash text primary key, kind text check (kind in ('invest','transfer','claim')), state text check (state in ('PENDING','CONFIRMED','REVERTED')), reason_code text, holder text, loan_id text, submitted_at timestamptz, settled_at timestamptz, block_number numeric)`; `optimistic_positions(hash text primary key references tx_status(hash) on delete cascade, holder text, loan_id text, principal numeric, created_at timestamptz)`. Indexes on `(holder, loan_id)` and `(state)`.
- `api/src/tx/tracker.ts` — `recordPending(ctx, { hash, kind, holder, loanId, amount }): Promise<void>` (insert `PENDING` + optimistic row for `invest`); `startConfirmationWatcher(ctx, bus)` long-running loop: for each `PENDING` row, `publicClient.waitForTransactionReceipt({ hash })`; on `status: 'success'` set `CONFIRMED` + `block_number`; on `status: 'reverted'` set `REVERTED` and decode the on-chain reason via `decodeReason` (ticket 21) into `reason_code`. Emits a `tx` event on the SSE bus (ticket 22) at every transition.
- `api/src/tx/reconcile.ts` — `reconcileOptimistic(ctx)`: when the indexer (ticket 16) has projected the canonical `positions` row at/after `block_number` for a `CONFIRMED` tx, delete the matching `optimistic_positions` row so reads stop double-counting. Idempotent; keyed on `hash`.
- `api/src/resolvers/mutations.ts` (modify) — after `broadcastGated` returns a hash, `await recordPending(...)` and return `TxReceiptRef { hash, state: 'PENDING', position: <optimistic> }` (ticket-20 shape) instead of blocking on confirmation.
- `api/src/resolvers/queries.ts` (modify) — `position`/`positions` merge canonical `positions` with any un-reconciled `optimistic_positions` for the holder, setting `Position.optimistic = true` on synthesized rows (the flag declared in ticket 20).
- `api/src/schema/query.ts` (modify) — add `txStatus(hash: String!): TxReceiptRef` returning the tracked lifecycle row.
- `api/src/index.ts` (modify) — start `startConfirmationWatcher` and a periodic `reconcileOptimistic` at boot.
- `api/test/tx.tracker.test.ts`, `api/test/tx.reconcile.test.ts` — Vitest with mocked `waitForTransactionReceipt` (success + reverted) and a seeded indexer `positions` row.

Public surface: `recordPending`, `startConfirmationWatcher`, `reconcileOptimistic`, the `txStatus` query, the optimistic-merge behavior of `position(s)`, and `tx_status`/`optimistic_positions` tables.

**Acceptance criteria.**
- [ ] 1. `recordPending` inserts one `tx_status` row (`state='PENDING'`) and, for `kind='invest'`, one `optimistic_positions` row (asserted counts 1 and 1).
- [ ] 2. On a mocked `status:'success'` receipt, the watcher transitions the row to `CONFIRMED` with the receipt `block_number` set (non-null) and emits exactly one `tx` SSE event with `state:'CONFIRMED'`.
- [ ] 3. On a mocked `status:'reverted'` receipt, the row becomes `REVERTED` with `reason_code` decoded to a member of the 7 `ReasonCode`s (e.g. `InsufficientReserve` for a claim) — asserts the decoded code, not a raw string.
- [ ] 4. Before indexer catch-up, `positions(holder)` includes the optimistic row with `optimistic === true`; after a canonical `positions` row at >= `block_number` is present and `reconcileOptimistic` runs, the optimistic row is gone and `optimistic === false` (no double count: total position count returns to 1).
- [ ] 5. `reconcileOptimistic` is idempotent — running it twice over the same state yields the same row set (second run deletes 0).
- [ ] 6. `bun run lint`, `bun run typecheck`, `bun run test` exit 0; bun CI job (ticket 3) green; migrations apply cleanly on startup; >= 12 Vitest assertions across the two new test files.
- [ ] 7. A fast-check property test over arbitrary `submitted -> (confirmed|reverted) -> reconciled` event orderings asserts the lifecycle is monotonic (never returns to `PENDING` after settling) and that an optimistic row is never retained once its canonical counterpart exists, for any interleaving (>=256 runs).

**Out of scope.**
- The indexer event projection that produces canonical `positions` (ticket 16) — this ticket consumes its output and only deletes optimistic rows once it has landed.
- Frontend optimistic-UI rendering, spinners, and toast/tx-status components (ticket 25); this ticket exposes state via `txStatus` + the SSE `tx` event only.

**Notes.** The optimistic position is a UX convenience, never an input to reconciliation — exclude `optimistic_positions` from every reconciliation-engine query (ticket 18) and from the `claimable<=collected` invariant, or an un-settled optimistic invest could trip a false `ReconMismatch` and HALT the system on a tx that simply hasn't confirmed yet. Match optimistic->canonical strictly by `hash`/`block_number`, not by `(holder, loanId)` heuristics, so two rapid invests on the same loan reconcile independently.

### #24 feat(ui): marketplace + position dashboard

**Block:** 5 · **Type:** feat · **Scope:** ui · **Estimate:** 60m · **Blocked by:** #22 · **Labels:** block-5, ui

**Why.** The thesis is an off-chain<->on-chain reconciliation engine, but a reviewer needs a surface to *see* the system breathe: positions opening, interest accruing per-second, the chain and the read models in agreement. This ticket lands the React shell + the loan marketplace (LTV/DSCR/data-room cards) + a position dashboard whose accrual ticker is driven by the SSE feed from ticket #22 (not polling). It is the visual home for matrix row 1 (`accredited-US invest -> PositionOpened, accrual starts`) and the canvas onto which #25 (invest/claim) and #26 (recon/health) mount. No wallet, no tx-sending, no recon banners yet — this ticket is read-only rendering of GraphQL queries + the live SSE accrual stream.

**What.**

Files to create:
- `web/src/main.tsx` — React 18 `createRoot` entry; mounts `<App/>` inside `<QueryProvider/>`.
- `web/src/App.tsx` — `export function App(): JSX.Element` — shell with header (project name, network pill reading `import.meta.env.VITE_CHAIN_LABEL` => `"Fuji" | "Local"`), a `<Nav/>` switching between `<MarketplaceView/>` and `<PositionDashboardView/>` (the only two views this ticket ships; the <=4-view cap leaves room for #25 detail + #26 health).
- `web/src/lib/graphqlClient.ts` — `export const gqlClient: GraphQLClient` (graphql-request) pointed at `import.meta.env.VITE_API_URL`; `export async function gql<TData, TVars>(doc: string, vars?: TVars): Promise<TData>`.
- `web/src/lib/sse.ts` — `export function useAccrualStream(): Map<PositionId, AccrualTick>` — opens an `EventSource` to `${VITE_API_URL}/sse/accrual` (the #22 feed), parses `event: accrual` / `event: recon` frames, reconnects with backoff, returns a per-position tick map. `export interface AccrualTick { positionId: PositionId; accruedWei: bigint; rateBps: number; loanStatus: LoanStatus; asOf: number }`.
- `web/src/lib/format.ts` — `export function fmtUsd6(wei: bigint): string` (6-decimals, USDC convention), `export function fmtBps(bps: number): string`, `export function fmtLtv(n: number): string`, `export function fmtDscr(n: number): string`.
- `web/src/types.ts` — re-export branded domain types from the shared types package (#14): `Loan`, `Position`, `Identity`, `LoanStatus`, `PositionId`, `LoanId`. UI must consume the shared zod-derived types, NOT redeclare them.
- `web/src/views/MarketplaceView.tsx` — `export function MarketplaceView(): JSX.Element` — runs `LOANS_QUERY`, renders a grid of `<LoanCard/>`.
- `web/src/components/LoanCard.tsx` — `export function LoanCard(props: { loan: Loan }): JSX.Element` — shows principal, coupon (`fmtBps`), **LTV** badge, **DSCR** badge, `loanStatus`, and a collapsible data-room section (static doc list: appraisal, rent-roll, term sheet — labels only, no file fetch). Single-loan-per-tranche per scope; no tranche selector.
- `web/src/views/PositionDashboardView.tsx` — `export function PositionDashboardView(): JSX.Element` — runs `POSITIONS_QUERY`, renders `<PositionRow/>` per holder position, wires each to `useAccrualStream()` so accrued interest counts up live.
- `web/src/components/PositionRow.tsx` — `export function PositionRow(props: { position: Position; tick?: AccrualTick }): JSX.Element` — principal, accrued (live, `fmtUsd6`), rate, loan-status chip. When `tick.loanStatus !== 'Accruing'` the ticker visibly freezes (sets up the row-9 NavAnomaly freeze that #26 surfaces).
- `web/src/queries.ts` — `export const LOANS_QUERY` (`loans { id principalWei couponBps ltv dscr loanStatus }`), `export const POSITIONS_QUERY` (`positions { id loanId holder principalWei accruedWei rateBps loanStatus }`). Operation names/fields MUST match the Pothos schema from #20.
- `web/src/queries.test.ts` — Vitest: assert query docs are valid GraphQL (parse via `graphql`'s `parse`) and reference only fields present in the committed SDL snapshot from #20.
- `web/src/lib/sse.test.ts` — Vitest + a mock `EventSource`: feed synthetic `accrual` frames, assert `useAccrualStream` accumulates per-position ticks, coalesces by `positionId`, and that a malformed frame is dropped without throwing.
- `web/src/lib/format.test.ts` — Vitest + **fast-check** property test: for any `bigint` in `[0n, 10n**24n]`, `fmtUsd6` round-trips through a parse back to the same integer wei (no precision loss), and is monotonic (`a < b => parse(fmt(a)) < parse(fmt(b))`).
- `web/tailwind.config.ts`, `web/postcss.config.js`, `web/index.html` — Tailwind wiring + Vite mount point (only if not already created by scaffold #2; otherwise modify).

Files to modify:
- `web/package.json` — add `graphql`, `graphql-request`; add `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint ."` scripts if missing.
- `web/.env.example` — add `VITE_API_URL`, `VITE_CHAIN_LABEL`.

Public surface: `App`, `MarketplaceView`, `PositionDashboardView`, `LoanCard`, `PositionRow`, `useAccrualStream`, `AccrualTick`, `gql`, `fmtUsd6`/`fmtBps`/`fmtLtv`/`fmtDscr`.

**Acceptance criteria.**
- [ ] `bun run --cwd web typecheck` passes (0 errors); no `any` in component props — props typed via shared branded types from #14.
- [ ] `bun run --cwd web lint` passes (0 errors, 0 warnings).
- [ ] `bun run --cwd web build` (`vite build`) succeeds and emits `web/dist/index.html`.
- [ ] `bun run --cwd web test` green: exactly 3 test files (`queries.test.ts`, `sse.test.ts`, `format.test.ts`), >=8 assertions total.
- [ ] >=1 **fast-check** property test (`format.test.ts`) runs >=100 cases (default) and passes — `fmtUsd6` round-trip + monotonicity.
- [ ] `MarketplaceView` renders >=6 `<LoanCard>`s against a mocked `LOANS_QUERY` response (component test or RTL render) with visible **LTV** and **DSCR** values.
- [ ] `PositionDashboardView` accrued value updates when a mock `accrual` SSE frame is dispatched (asserted via RTL `findByText`), and freezes when `loanStatus !== 'Accruing'`.
- [ ] CI `bun` job (#3) runs `web` lint+typecheck+test and is green.

**Out of scope.**
- Wallet connection and any on-chain tx submission (invest/claim) — that is ticket #25.
- Reconciliation/health panel, HALT banners, and on-chain-vs-off-chain delta rendering — that is ticket #26.

**Notes.** The accrual ticker must derive its count-up from the SSE `asOf` + `rateBps` + `principalWei`, not a client-side `setInterval` guessing — otherwise the displayed number drifts from the engine's deterministic state and silently contradicts the reconciliation thesis. Render `bigint` wei directly; never coerce balances through JS `number` (precision loss above 2^53). Build `EventSource` reconnect with capped backoff so a paused API in CI doesn't wedge the test.

---
**Mortgage modeling.** Marketplace cards show a `collateralType` badge (CRE / RESIDENTIAL) next to LTV/DSCR and the data-room, so the generality is visible in the UI.

---
**Enterprise / bank-grade UX (sets the visual system for #24–#26).** Establish a restrained institutional design language here: neutral/navy palette, generous whitespace, calm data-dense tables, **tabular-figure numerics** for money, subtle borders over heavy shadows, `Inter`/system type — NO playful or crypto-gradient styling. Define design tokens (`web/src/theme.ts`: colors, spacing, radii, type scale) and a small reused primitive set (`Card`, `StatPill`, `DataTable`, `Badge`, `Banner`). Money formatted with fixed decimals + currency. Every view is demoable on seeded data with clean **empty / loading / error** states.

### #25 feat(ui): invest + claim flow with wallet

**Block:** 5 · **Type:** feat · **Scope:** ui · **Estimate:** 55m · **Blocked by:** #24 · **Labels:** block-5, ui

**Why.** The eligibility gauntlet is the compliance heart of the token, but a reviewer only believes it when a *real wallet* hits a *real Fuji tx* and gets back a *typed* reason code rendered as a badge — not a stringly error toast. This ticket adds wallet-connect + the invest and claim flows (sending Fuji/local txs through the #21 resolvers), maps on-chain custom errors to reason-code badges, and shows the pending->confirmed tx lifecycle from #23. It makes the following matrix rows visible and clickable: row 1/2 (invest OK), row 3 (`revert NotEligible`), row 4 (`ReceiverFrozen`), row 5 (`ReceiverNotVerified`), row 6 (`AccreditationRequired`), row 7 (claim OK -> `InterestClaimed`), row 8 (`revert InsufficientReserve`). Mounts on the #24 shell.

**What.**

Files to create:
- `web/src/lib/wallet.ts` — viem + `window.ethereum`. `export function useWallet(): { address?: Address; chainId?: number; connect(): Promise<void>; ensureChain(): Promise<void> }` — connects, and `ensureChain` switches/adds the target chain (Fuji `0xa869` or local `0x7a69`) read from `import.meta.env.VITE_CHAIN_ID`.
- `web/src/lib/reasonCodes.ts` — the typed bridge. `export type ReasonCode = 'NotEligible' | 'ReceiverFrozen' | 'ReceiverNotVerified' | 'AccreditationRequired' | 'InsufficientReserve' | 'NavAnomaly' | 'ReconMismatch'`. `export const REASON_META: Record<ReasonCode, { label: string; blurb: string; tone: 'block' | 'halt' }>`. `export function isReasonCode(x: string): x is ReasonCode`. These strings MUST equal the GraphQL error `code` enum emitted by #21 (which itself maps the Solidity custom-error selectors) — this file is a discriminated union, never free text.
- `web/src/components/ReasonBadge.tsx` — `export function ReasonBadge(props: { code: ReasonCode }): JSX.Element` — pill colored by `REASON_META[code].tone`, tooltip = `blurb`.
- `web/src/lib/mutations.ts` — `export const INVEST_MUTATION`, `export const TRANSFER_MUTATION`, `export const CLAIM_MUTATION`; `export type MutationResult<T> = { ok: true; data: T; txHash: Hex } | { ok: false; code: ReasonCode; message: string }`. Operation names/inputs MUST match the Pothos mutations from #20/#21.
- `web/src/lib/txStatus.ts` — `export type TxPhase = 'idle' | 'signing' | 'pending' | 'confirmed' | 'reverted'`. `export function useTxLifecycle(): { phase: TxPhase; txHash?: Hex; reason?: ReasonCode; run(send: () => Promise<MutationResult<unknown>>): Promise<void> }` — drives signing->pending->confirmed using the #23 tx-status tracking (subscribes to the tx-status SSE/poll channel so an *optimistic* position shows until the indexer catches up, then reconciles).
- `web/src/components/InvestDialog.tsx` — `export function InvestDialog(props: { loan: Loan; onClose(): void }): JSX.Element` — amount input (wei, 6-dec aware), `Invest` button gated on `useWallet().address`; calls `INVEST_MUTATION` via `useTxLifecycle`; on `{ ok: false }` renders `<ReasonBadge code={result.code}/>` inline (rows 3/6 land here for the invest path); shows `<TxStatusInline/>`.
- `web/src/components/ClaimPanel.tsx` — `export function ClaimPanel(props: { position: Position }): JSX.Element` — shows `claimableWei`, `Claim` button; on success renders `InterestClaimed` confirmation + the debited-reserve hint (row 7); on `InsufficientReserve` renders the badge and leaves accrued intact (row 8).
- `web/src/components/TransferDialog.tsx` — `export function TransferDialog(props: { position: Position; onClose(): void }): JSX.Element` — recipient address + amount; surfaces `ReceiverFrozen` (row 4) / `ReceiverNotVerified` (row 5) badges from the revert.
- `web/src/components/TxStatusInline.tsx` — `export function TxStatusInline(props: { phase: TxPhase; txHash?: Hex }): JSX.Element` — phase chip + explorer link (`${VITE_EXPLORER_URL}/tx/${txHash}` for Fuji; suppressed for local).
- `web/src/views/PositionDashboardView.tsx` — **modify** (from #24): mount `<ClaimPanel/>` + a `Transfer` button per row.
- `web/src/components/LoanCard.tsx` — **modify** (from #24): add an `Invest` button opening `<InvestDialog/>`, disabled with a tooltip when no wallet.

Test files:
- `web/src/lib/reasonCodes.test.ts` — Vitest: assert `REASON_META` has an entry for **every** member of `ReasonCode` (exhaustiveness), that all 5 transfer/claim codes are `tone: 'block'` and `NavAnomaly`/`ReconMismatch` are `tone: 'halt'`, and that `isReasonCode` rejects an unknown string. **Cross-check**: assert the `ReasonCode` union string set is a superset of the matrix reason codes and equals the committed GraphQL error-code enum snapshot from #21 (fail the build if they drift).
- `web/src/lib/txStatus.test.ts` — Vitest + fake timers: drive `useTxLifecycle` through `signing -> pending -> confirmed`; a mocked resolver returning `{ ok: false, code: 'InsufficientReserve' }` lands `phase === 'reverted'` with `reason` set; assert the optimistic position is rolled back on revert.
- `web/src/components/ReasonBadge.test.tsx` — RTL: render every `ReasonCode`, assert label + tone class.
- `web/src/flows.test.tsx` — RTL property/table test over a mocked resolver: a **fast-check** (or table) generator picks a `(scenarioRow in {3,4,5,6,8})` and asserts the matching `<ReasonBadge>` appears and **no** success state renders; for rows {1,2,7} asserts a confirmed tx chip and no badge. This is the UI mirror of `scripts/verify_matrix.ts`.

Public surface: `useWallet`, `useTxLifecycle`, `ReasonCode`, `REASON_META`, `isReasonCode`, `ReasonBadge`, `InvestDialog`, `ClaimPanel`, `TransferDialog`, `TxStatusInline`, `INVEST_MUTATION`/`TRANSFER_MUTATION`/`CLAIM_MUTATION`, `MutationResult`, `TxPhase`.

**Acceptance criteria.**
- [ ] `bun run --cwd web typecheck` passes (0 errors); `ReasonCode` is a discriminated union — **no** raw error strings rendered anywhere (grep asserts no `"NotEligible"`-style literals outside `reasonCodes.ts`).
- [ ] `bun run --cwd web lint` passes (0 errors, 0 warnings); `bun run --cwd web build` succeeds.
- [ ] `bun run --cwd web test` green: 4 new test files, >=12 assertions total.
- [ ] >=1 fast-check (or exhaustive table) property test in `flows.test.tsx` covering matrix rows {1,2,3,4,5,6,7,8} maps each to {confirmed | correct `ReasonBadge`}, >=8 cases.
- [ ] `reasonCodes.test.ts` proves exhaustiveness over all 7 `ReasonCode` members AND equality with the #21 GraphQL error-code enum snapshot.
- [ ] On a mocked `InsufficientReserve` claim revert, the accrued value is **not** reset in the UI (row 8 fidelity), asserted in `txStatus.test.ts`.
- [ ] Invest/transfer/claim buttons are disabled (with tooltip) until `useWallet().address` is set, asserted in RTL.
- [ ] CI `bun` job (#3) runs and is green; no console errors during the RTL flow test.

**Out of scope.**
- Reconciliation/health panel and `NavAnomaly`/`ReconMismatch` HALT banners (rows 9/10) — that is ticket #26 (this ticket only *defines* the two halt-tone codes for shared use).
- Server-side signing, nonce management, and the on-chain custom-error->GraphQL-code mapping itself — that lives in resolvers #21; the UI consumes the typed `code` only.

**Notes.** The wallet send path must call `ensureChain()` before every mutation or a user on Ethereum mainnet will broadcast an invest tx to the wrong network and the indexer will never see it — silent divergence. Map the revert at the *GraphQL error* boundary (`extensions.code`), not by string-matching `error.message`; viem/RPC error text is unstable across providers. Treat `claimableWei`/amounts as `bigint` end-to-end; a `Number()` coercion here will desync the optimistic position from the reconciled one.

### #26 feat(ui): reconciliation / health panel

**Block:** 5 · **Type:** feat · **Scope:** ui · **Estimate:** 40m · **Blocked by:** #24 · **Labels:** block-5, recon

**Why.** This is the marquee made visible. The reconciliation engine (#18) and replay/state-hash (#19) prove off-chain servicing cash and on-chain claimable balances agree and HALT on mismatch — but the demo only sells if a reviewer watches the health turn red. This panel renders live recon status, raises a HALT banner for **NavAnomaly** (matrix row 9: NAV +40% out-of-bounds -> accrual frozen) and **ReconMismatch** (matrix row 10: injected cash != claimable -> distribution halted), and shows the on-chain-vs-off-chain balance deltas that justify the halt. It is the fourth and final view (respecting the <=4-view cap) and the payoff screen of the whole project. Mounts on the #24 shell; reuses the halt-tone reason codes defined in #25.

**What.**

Files to create:
- `web/src/lib/reconStream.ts` — `export interface ReconStatus { state: 'OK' | 'HALTED'; haltCode?: 'NavAnomaly' | 'ReconMismatch'; cycle: number; stateHash: Hex; invariants: InvariantResult[]; deltas: BalanceDelta[]; asOf: number }`. `export interface InvariantResult { name: 'SupplyBacked' | 'ClaimableLeCollected' | 'NavInBounds' | 'IdentityValid'; ok: boolean; detail: string }`. `export interface BalanceDelta { holder: Address; onChainClaimableWei: bigint; offChainCollectedWei: bigint; deltaWei: bigint }`. `export function useReconStream(): ReconStatus | undefined` — subscribes to the `recon` SSE channel from #22 (same `EventSource` infra as #24's `useAccrualStream`; do not open a second polling loop). The four `InvariantResult.name` values MUST be exactly the 4 invariants asserted by engine #18.
- `web/src/views/HealthView.tsx` — `export function HealthView(): JSX.Element` — top-level `<HaltBanner/>` (when `state === 'HALTED'`), a `<InvariantGrid/>` (4 invariant rows w/ pass/fail), a `<DeltaTable/>` (per-holder on-chain vs off-chain), and a `stateHash` + `cycle` footer proving determinism.
- `web/src/components/HaltBanner.tsx` — `export function HaltBanner(props: { code: 'NavAnomaly' | 'ReconMismatch' }): JSX.Element` — full-width red banner; copy keyed off `REASON_META[code]` (from #25) so wording is single-sourced; explicitly states accrual/distribution is frozen.
- `web/src/components/InvariantGrid.tsx` — `export function InvariantGrid(props: { invariants: InvariantResult[] }): JSX.Element` — renders all 4; a failing invariant row is highlighted and shows `detail`.
- `web/src/components/DeltaTable.tsx` — `export function DeltaTable(props: { deltas: BalanceDelta[] }): JSX.Element` — columns: holder, on-chain claimable (`fmtUsd6`), off-chain collected (`fmtUsd6`), delta; any non-zero delta row flagged. Reuses `fmtUsd6` from #24.
- `web/src/App.tsx` — **modify** (from #24): add `Health` to `<Nav/>` and a global header recon pill (green `OK` / red `HALTED`) sourced from `useReconStream()` so the halt is visible from every view; this is the 4th view.
- `web/src/views/PositionDashboardView.tsx` — **modify**: when `useReconStream().state === 'HALTED'` with `haltCode === 'NavAnomaly'`, freeze the accrual ticker rows (row-9 behavior, reusing #24's freeze path) and show an inline halt hint.

Test files:
- `web/src/lib/reconStream.test.ts` — Vitest + mock `EventSource`: feed an `OK` frame then a `ReconMismatch` frame; assert `state` flips to `HALTED`, `haltCode === 'ReconMismatch'`, and the offending `BalanceDelta` (non-zero `deltaWei`) is present. Feed a `NavAnomaly` frame; assert `haltCode === 'NavAnomaly'` and the `NavInBounds` invariant is `ok: false`.
- `web/src/components/HaltBanner.test.tsx` — RTL: render both halt codes; assert the banner text and red tone, and that it states accrual/distribution is frozen.
- `web/src/components/DeltaTable.test.tsx` — RTL + **fast-check** property test: for an arbitrary array of `BalanceDelta`, assert (a) `deltaWei` rendering equals `onChainClaimableWei - offChainCollectedWei` for every row (the UI never recomputes a different delta than the engine), and (b) every row whose `deltaWei !== 0n` carries the flagged class while `deltaWei === 0n` rows do not. >=100 cases.
- `web/src/views/HealthView.test.tsx` — RTL: `OK` status renders 4 green invariants, no banner; a `HALTED`/`ReconMismatch` status renders the banner + the flagged invariant + the flagged delta row (UI mirror of matrix row 10).

Public surface: `useReconStream`, `ReconStatus`, `InvariantResult`, `BalanceDelta`, `HealthView`, `HaltBanner`, `InvariantGrid`, `DeltaTable`.

**Acceptance criteria.**
- [ ] `bun run --cwd web typecheck` passes (0 errors); `haltCode` typed as the halt-tone union (`'NavAnomaly' | 'ReconMismatch'`) imported from #25's `ReasonCode`, not a string.
- [ ] `bun run --cwd web lint` passes (0 errors, 0 warnings); `bun run --cwd web build` succeeds.
- [ ] `bun run --cwd web test` green: 4 new test files, >=12 assertions total.
- [ ] >=1 **fast-check** property test (`DeltaTable.test.tsx`) >=100 cases proving rendered `deltaWei == onChainClaimableWei - offChainCollectedWei` and the non-zero-row flag invariant.
- [ ] A `NavAnomaly` recon frame raises the HALT banner AND freezes the position accrual ticker (row 9), asserted across `reconStream.test.ts` + `HealthView`/dashboard RTL.
- [ ] A `ReconMismatch` recon frame raises the HALT banner AND highlights the offending non-zero `BalanceDelta` row (row 10), asserted in `HealthView.test.tsx`.
- [ ] `InvariantGrid` always renders exactly 4 invariants matching the engine #18 names; a snapshot/assertion guards the name set against drift.
- [ ] Header recon pill reflects `OK`/`HALTED` and is visible from all 4 views; CI `bun` job (#3) green, no console errors.

**Out of scope.**
- The reconciliation logic, invariant evaluation, NAV bounds, and state-hash computation themselves — those are owned by engine #18 and replay #19; this ticket only renders their already-emitted SSE status.
- Operator controls to clear/override a HALT or re-run a cycle — read-only health surface; no resume/acknowledge action.

**Notes.** A HALT must be impossible to miss from any view, so the header pill subscribes to the same single `useReconStream()` source as the panel — do not let the marketplace/position views keep rendering a cheery green accrual ticker while the engine is halted; that contradiction is exactly the failure the thesis claims to prevent. The `DeltaTable` must display the engine's `deltaWei` as delivered, never a client-recomputed subtraction in `number` space — recompute-in-JS risks showing a different delta than the one that triggered the halt. Drive HALT detection off the typed `haltCode`, never by parsing banner copy.

### #27 feat(scripts): scenario-matrix verifier

**Block:** 6 · **Type:** feat · **Scope:** scripts · **Estimate:** 50m · **Blocked by:** #18, #21 · **Labels:** block-6, infra

**Why.** This is the falsifiable proof that the whole system behaves as specified. The 10-scenario matrix in `CLAUDE.md` is the contract: every eligibility gate (rows 3-6), every reserve/claim path (rows 7-8), and — most importantly — both HALT conditions of the marquee reconciliation engine (row 9 `NavAnomaly`, row 10 `ReconMismatch`) get exercised end-to-end against a **real local EVM node** (not a forge unit harness, not a mock chain). It ties the on-chain custom errors, the off-chain NAV gate (#17), and the reconciliation engine (#18) together through the same GraphQL surface (#21) a real client would use. If any row's actual outcome (OK / typed-revert / HALT) diverges from expected, this script exits non-zero and the build is red.

**What.**
- Files to create:
  - `scripts/verify_matrix.ts` — the end-to-end verifier (Bun + viem, run via `bun run scripts/verify_matrix.ts`).
  - `scripts/lib/harness.ts` — bring-up/teardown helpers: `startLocalNode(): Promise<{ rpcUrl: string; stop: () => Promise<void> }>` (spawns anvil/avalanche local), `deployFixture(rpcUrl): Promise<DeployedAddresses>` (runs `Deploy.s.sol` from #12 via `forge script`, parses broadcast JSON for registry/token/reserve addresses), `applyMigrations(databaseUrl)` (invokes the raw-SQL migrator from #15), `startApiServer(env): Promise<{ url: string; stop: () => Promise<void> }>` (boots the graphql-yoga server from #21), `startIndexer(env)` + `waitForIndexer(positionId, blockNumber)` (the viem indexer from #16, polled until the read model catches the tx's block).
  - `scripts/lib/scenarios.ts` — the typed scenario table.
- Named types / signatures (typed reason codes, NOT strings — discriminated unions mirroring the Solidity custom errors):
  - `type Expected =\n    | { kind: 'ok'; event: 'PositionOpened' | 'InterestClaimed' }\n    | { kind: 'revert'; reason: ReasonCode }\n    | { kind: 'halt'; state: EngineState }`
  - `type ReasonCode = 'NotEligible' | 'ReceiverFrozen' | 'ReceiverNotVerified' | 'AccreditationRequired' | 'InsufficientReserve'` (import from the shared domain types in #14, do not re-declare).
  - `type EngineState = 'NavAnomaly' | 'ReconMismatch'`.
  - `interface Scenario { row: number; name: string; actor: SeededIdentity; run: (ctx: MatrixContext) => Promise<Actual>; expect: Expected }`
  - `interface MatrixContext { apiUrl: string; rpcUrl: string; addresses: DeployedAddresses; gql: <T>(query: string, vars?: Record<string, unknown>) => Promise<T> }`
  - `type Actual = Expected` (the verifier asserts `deepEqual(actual, scenario.expect)`).
  - `async function runMatrix(ctx: MatrixContext): Promise<MatrixReport>` where `interface MatrixReport { passed: number; total: number; failures: { row: number; name: string; expected: Expected; actual: Actual }[] }`.
- Public surface / behavior:
  - `main()` orchestrates: `startLocalNode` -> `applyMigrations` -> `deployFixture` (seeds the 6 identities + 6 loans) -> `startApiServer` + `startIndexer` -> `runMatrix` -> pretty-print `N/10 scenarios passed` -> `process.exit(report.failures.length === 0 ? 0 : 1)`. A `finally` block tears down node/api/indexer even on throw.
  - Each of the 10 rows drives the system **through the GraphQL mutations** (`invest`, `transfer`, `claim` from #20/#21) and the recon/nav surface, never by calling contracts directly, so the test exercises the real error-mapping seam:
    - Rows 1-2 (accredited-US, Reg-S invest) -> assert `{kind:'ok', event:'PositionOpened'}`, then poll the indexer until the position read model shows `accrualStartedAt`.
    - Row 3 unverified invest -> assert `{kind:'revert', reason:'NotEligible'}` (GraphQL error `extensions.code`).
    - Row 4 transfer to frozen -> `ReceiverFrozen`; Row 5 transfer to unverified -> `ReceiverNotVerified`; Row 6 US-non-accredited holds Reg-D -> `AccreditationRequired`.
    - Row 7 claim with funded reserve -> `{kind:'ok', event:'InterestClaimed'}`, then assert via GraphQL `reserveState` that reserve debited and `accrued` reset to 0.
    - Row 8 claim against underfunded reserve -> `{kind:'revert', reason:'InsufficientReserve'}`.
    - Row 9 push a NAV reading +40% out-of-bounds through the NAV feed -> assert `{kind:'halt', state:'NavAnomaly'}` and that `reconciliationStatus.accrualFrozen === true`.
    - Row 10 inject off-chain collected cash != on-chain claimable, run a recon cycle -> assert `{kind:'halt', state:'ReconMismatch'}` and that distribution is blocked.
  - A precise predicate per row (the matched event name, the exact `ReasonCode`, the exact `EngineState`) — never a bare "did not throw".
- Modify:
  - `package.json` -> add script `"verify:matrix": "bun run scripts/verify_matrix.ts"`.
  - `.env.example` -> document `LOCAL_RPC_URL`, `DATABASE_URL`, `MATRIX_KEEP_ALIVE` (skip teardown for debugging).

**Acceptance criteria.**
- [ ] 10/10 scenarios pass locally via `bun run scripts/verify_matrix.ts` against a freshly-spawned local node + fresh Postgres.
- [ ] Exit code is `0` on full pass and `1` on any single mismatch (assert: deliberately corrupt one expected row, confirm exit `1` and a printed expected-vs-actual diff, then revert).
- [ ] All 5 `ReasonCode`s and both `EngineState`s appear as an asserted expectation across the 10 rows (grep the scenario table: 7 distinct typed outcomes present).
- [ ] Each row asserts a precise predicate (matched event / exact reason code / exact engine state), verified by `deepEqual(actual, expected)` — 0 rows assert only "no error".
- [ ] Rows 1, 2, 7 round-trip through the indexer: the position/reserve read model reflects the tx before the row is marked pass (no race; uses `waitForIndexer`, not a fixed sleep).
- [ ] `bun run lint` and `bun run typecheck` green on the new files; no `any`, no string-literal reason codes (reason codes come from the #14 union).
- [ ] Property check included: a fast-check property (>=64 runs) asserting that for any permutation of the matrix row order, `runMatrix` yields the same per-row pass/fail set (matrix outcomes are order-independent given fresh fixture per run).

**Out of scope.**
- Running against Avalanche Fuji (this verifier targets the LOCAL node only for determinism/CI speed; the Fuji deploy path is #13, and the live-Fuji demo walkthrough is #30).
- The deterministic-replay `stateHash` interleaving property — that property ships with the replay engine in #19, not here; this script only asserts the row-10 `ReconMismatch` HALT, not replay equivalence.

**Notes.** Landmine: do not assert accrual/reserve effects with a fixed `sleep` after a tx — the indexer is eventually-consistent. Capture the tx's `blockNumber` from the viem `waitForTransactionReceipt` result and have `waitForIndexer` poll the read model until `indexed_block >= blockNumber`, with a bounded timeout that fails loudly. Reuse a single funded local-node signer for the server's tx submission so nonce management stays linear; the 6 seeded identities are the actors, the server signer is the sender.

### #28 ci(ci): wire verify_matrix into CI on a local node

**Block:** 6 · **Type:** ci · **Scope:** ci · **Estimate:** 35m · **Blocked by:** #27 · **Labels:** block-6, infra

**Why.** The matrix verifier (#27) is only a safety net if it runs on every change. This ticket makes scenario regressions a hard build failure: CI spins a real local EVM node and a real Postgres, deploys the contracts via `Deploy.s.sol` (#12), boots the api + indexer, runs `scripts/verify_matrix.ts`, and fails the build on any mismatch. This is the gate that keeps every later commit honest about all four reconciliation invariants and both HALT states — the marquee claim of the project is only credible if its proof is wired into CI and visible (green badge) to a reviewer.

**What.**
- Files to create/modify:
  - `.github/workflows/verify-matrix.yml` (new dedicated workflow, or a new `verify-matrix` job appended to the existing CI from #3 — keep it a separate job so the forge/bun unit jobs stay fast and the heavier e2e job gates merge independently).
- Job shape (`verify-matrix`, `runs-on: ubuntu-latest`, `needs: [forge, bun]` so it runs after the #3 unit jobs are green):
  - `services.postgres`: `image: postgres:16-alpine`, env `POSTGRES_DB/USER/PASSWORD`, `ports: 5432:5432`, with the standard `pg_isready` healthcheck (interval 10s, retries 5).
  - `env`: `DATABASE_URL: postgres://postgres:postgres@localhost:5432/ledger_test`, `LOCAL_RPC_URL: http://127.0.0.1:8545`.
  - Steps, in order:
    1. `actions/checkout@v4` with `submodules: recursive` (forge-std + OpenZeppelin v5 submodules from #2 are needed to build the contracts).
    2. `foundry-rs/foundry-toolchain@v1` (provides `forge` + `anvil`).
    3. `oven-sh/setup-bun@v2` (Bun runtime for indexer/api/verifier).
    4. `bun install --frozen-lockfile`.
    5. `forge build --sizes` (compile contracts; produces the ABIs the indexer/api consume).
    6. `bash scripts/copy_abis.sh` (the ABI export from #13 — copy `contracts/out/*.json` into `indexer/`/`api/`).
    7. Start the local node in the background: `anvil --host 0.0.0.0 --port 8545 &` then a bounded readiness poll against `eth_blockNumber` (loop with timeout, fail if the node never answers — do NOT use a fixed sleep).
    8. Run the verifier: `bun run scripts/verify_matrix.ts` (it internally applies migrations against the service Postgres, runs `Deploy.s.sol` against `LOCAL_RPC_URL`, boots api+indexer, and runs all 10 rows).
  - The verifier's own non-zero exit (any row mismatch) fails the step and therefore the job.
- Triggers: `push` to `main` and `pull_request`.
- Modify: `README.md` (in #30) will reference the resulting CI badge; this ticket adds the badge URL pointing at `verify-matrix.yml`.

**Acceptance criteria.**
- [ ] `verify-matrix` job is green on a clean push (all 10 scenarios pass in CI).
- [ ] A deliberately broken row (temporary commit flipping one expected outcome) turns the `verify-matrix` job red and the PR un-mergeable; reverting restores green (demonstrated once, then reverted).
- [ ] The job uses a REAL local EVM node (anvil) and the REAL `postgres:16-alpine` service — 0 mocked chain, 0 mocked DB in this job.
- [ ] Node readiness is gated by a bounded `eth_blockNumber` poll (max ~30s) that fails the build if the node never comes up — no fixed `sleep` as the readiness mechanism (grep the workflow: no bare `sleep` standing in for a healthcheck).
- [ ] `forge build --sizes` and `scripts/copy_abis.sh` run before the verifier so ABIs are present; job fails clearly if an ABI is missing.
- [ ] Workflow YAML passes `actionlint` (run `actionlint .github/workflows/verify-matrix.yml` locally; 0 findings).
- [ ] `verify-matrix` is added to branch-protection required checks (documented in the ticket close-out), so a failing matrix blocks merge.

**Out of scope.**
- A scheduled/cron Fuji-testnet smoke run (the Fuji deploy is manual-dispatch only, #13; this CI gate targets the deterministic local node).
- Caching the foundry/bun toolchains or contract artifacts for speed (correctness first; cache tuning can land later and is not required for the gate to be valid).

**Notes.** Landmine: `forge script` writes broadcast/deployment JSON under `contracts/broadcast/` — ensure `Deploy.s.sol` is invoked with a deterministic local mnemonic so the 6 seeded identity addresses are stable run-to-run and the verifier can hardcode the actor set. If the anvil background process is started with `&` in one `run:` step, the local node must be launched in the SAME step that (or before a step that) keeps the shell alive long enough; prefer launching it inside the verifier-invoking step's preamble, or use a dedicated background-start step plus the readiness poll, so the node is still alive when `verify_matrix.ts` connects.

### #29 docs(docs): DESIGN.md + 4 architecture SVGs

**Block:** 7 · **Type:** docs · **Scope:** docs · **Estimate:** 45m · **Blocked by:** #18 · **Labels:** block-7, docs

**Why.** The thesis is a permissioned tokenized-credit ledger whose marquee is an off-chain<->on-chain reconciliation engine that *proves* servicing cash and on-chain claimable balances agree and HALTs on mismatch. A reviewer's first question is "why these decisions, and what did you knowingly not build?" `DESIGN.md` is where that argument lives: the recon-HALT philosophy (fail-closed, not fail-open), why ERC-3643-lite over full ERC-3643, why a deterministic event-replay + state hash is the integrity primitive, and the mandatory "what was cut" section so the scope caps read as deliberate engineering, not gaps. The four architecture SVGs make the trust boundaries and the reconciliation data-flow legible at a glance. Blocked by #18 because the recon-HALT philosophy cannot be written honestly until the engine (the four invariants + ReconMismatch HALT) actually exists.

**What.**

Files to create:
- `docs/architecture/DESIGN.md` — the decisions doc.
- `docs/architecture/01-topology.svg` — system topology: Fuji C-Chain + local node -> viem indexer -> Postgres read models -> Pothos/yoga GraphQL + SSE -> React/Vite; the server signer; the NAV feed ingest.
- `docs/architecture/02-trust-boundaries.svg` — eligibility / trust boundaries: wallet -> `IdentityRegistry` (verified/accredited/jurisdiction/frozen) -> `ComplianceRegistry` (Reg D / Reg S rules) -> `CreditToken._update` gauntlet; which actor is trusted for what (issuer-role vs holder vs server signer).
- `docs/architecture/03-transfer-lifecycle.svg` — transfer-lifecycle sequence: `transfer()` -> `_update` -> freeze check -> verified check -> compliance check -> typed revert OR balance mutation + event -> indexer projection -> read model.
- `docs/architecture/04-reconciliation.svg` — the marquee: off-chain servicing cash + NAV readings vs on-chain supply/claimable; the 4 invariants; NAV validation gate; deterministic replay -> `stateHash`; the HALT gates (`NavAnomaly`, `ReconMismatch`).

`DESIGN.md` required sections (in order):
1. `## What this is` — one-paragraph product framing (permissioned tokenized-credit ledger; reconciliation engine is the marquee), company-neutral.
2. `## Architecture` — an ASCII topology block mirroring `01-topology.svg`, plus inline references to each SVG by filename.
3. `## Key decisions and trade-offs` — at minimum: (a) ERC-3643-lite permissioned token vs full ERC-3643 / ERC-1400; (b) typed reason codes — Solidity custom errors + TS discriminated unions, **not** strings — listing all 5 transfer codes (`NotEligible`, `ReceiverFrozen`, `ReceiverNotVerified`, `AccreditationRequired`, `InsufficientReserve`) and the 2 engine states (`NavAnomaly`, `ReconMismatch`); (c) deterministic event-replay + `stateHash()` as the integrity primitive and why interleaving-independence matters; (d) hybrid real-chain (Avalanche Fuji testnet for the real deploy, local node for deterministic CI); (e) server-signed txs (identities seeded; no auth/login) and why; (f) raw SQL migrations, no ORM.
4. `## The recon-HALT philosophy` — the load-bearing section: fail-closed semantics, the 4 invariants (on-chain supply == backed; on-chain claimable <= off-chain collected; NAV in-bounds; identity-valid), what HALT actually stops (distribution/claim), why a halted-but-correct ledger beats a live-but-drifting one, and how `NavAnomaly` (matrix row 9) differs from `ReconMismatch` (matrix row 10).
5. `## What was cut` (mandatory) — real fiat ramp + real USDC (mock reserve); account-abstraction onboarding (identities seeded); secondary-market / ATS matching; multi-tranche securitization (single-loan only); auth/login. Each with a one-line "production story".
6. `## Production gaps` — priority-ordered: no static analysis (Slither/Mythril) in CI; mock reserve not a real custody/settlement rail; single server signer (no HSM/KMS); NAV feed is a seeded source, not a real servicer/oracle adapter.
7. `## Verification` — point to `forge test`, the fast-check replay property (#19), and `scripts/verify_matrix.ts` (#27).

SVG requirements: hand-authored or exported static `.svg` (no external font/CDN refs), each <= ~40KB, legible at 100% zoom, company-neutral labels only (no "Profitr", no JD framing). The four files must be referenceable from `README.md` (#30) by relative path.

**Acceptance criteria.**
- [ ] 1. `docs/architecture/DESIGN.md` exists with all 7 required `##` sections present (grep each heading).
- [ ] 2. `## What was cut` lists exactly the 5 cut items above, each with a one-line production story.
- [ ] 3. `## Key decisions and trade-offs` enumerates all 7 reason/state codes by their exact identifiers (`NotEligible`, `ReceiverFrozen`, `ReceiverNotVerified`, `AccreditationRequired`, `InsufficientReserve`, `NavAnomaly`, `ReconMismatch`).
- [ ] 4. `## The recon-HALT philosophy` names all 4 invariants and distinguishes `NavAnomaly` (row 9) from `ReconMismatch` (row 10).
- [ ] 5. All 4 SVGs exist at `docs/architecture/0{1,2,3,4}-*.svg`; each is well-formed XML (`xmllint --noout` exits 0) and contains zero `http://` / `https://` external resource refs (grep returns nothing).
- [ ] 6. Each SVG is <= 50KB on disk.
- [ ] 7. `rg -i 'profitr|job description|interview' docs/architecture/` returns no matches (company-neutral rule).
- [ ] 8. Every relative path named in `DESIGN.md` that points into the repo resolves to an existing file or a file created by an earlier ticket (link check script or manual: no dangling repo-relative links).
- [ ] 9. Markdown lints clean under the repo's markdown config (or `markdownlint docs/architecture/DESIGN.md` exits 0 if configured); CI doc job (if present) is green.
- [ ] 10. N/A for fuzz/property tests (docs-only ticket); criterion satisfied by #19's replay property being *referenced* from the Verification section, not authored here.

**Out of scope.**
- Authoring or modifying the reconciliation engine, replay, or any runtime code — this ticket only documents behavior delivered by #17/#18/#19.
- The README, DEMO.md, CI badge, and `scripts/demo_reset` — those belong to #30.

**Notes.** Landmine: do not write the recon-HALT section from the spec alone — read the actual #18 invariant assertions and #17 NAV-gate bounds so the doc matches shipped behavior (drift between DESIGN.md and the engine is the most embarrassing failure here). Keep SVGs free of embedded web fonts; convert text to paths or use a generic `font-family` so they render identically in GitHub's renderer and a local viewer. Use deterministic, neutral entity labels (e.g. `accredited-US`, `RegS-nonUS`, `unverified`, `frozen`) consistent with the seed in #12 so 02/03 match the matrix.

### #30 docs(docs): README + DEMO.md + demo_reset

**Block:** 7 · **Type:** docs · **Scope:** docs · **Estimate:** 35m · **Blocked by:** #27 · **Labels:** block-7, docs

**Why.** The README is the front door: it has to land the narrative (permissioned tokenized-credit ledger; the reconciliation engine that HALTs on mismatch is the marquee), show a green CI badge, and give a quickstart that takes a reader from clone to a running local node + deployed contracts + the 10-scenario verifier in a handful of commands. `DEMO.md` is the live-walkthrough script — the artifact that lets the whole stack be demoed end-to-end, including a real Avalanche Fuji deploy and a deliberately-triggered `NavAnomaly` HALT (matrix row 9), without improvising. `scripts/demo_reset` makes the demo idempotent: tear down, redeploy to the local node, reseed the 6 identities + 6 loans, so a fumbled run is recoverable in seconds. Blocked by #27 because both docs reference `scripts/verify_matrix.ts` and its `10/10` output, which must exist first.

**What.**

Files to create:
- `README.md` (repo root) — narrative + CI badge + quickstart + layout + test-suite section.
- `docs/DEMO.md` — the timed 10-scenario live walkthrough.
- `scripts/demo_reset.ts` (Bun) — kill local node, restart, redeploy via `Deploy.s.sol`, reseed, re-run migrations; `scripts/demo_reset` thin wrapper if a no-extension entrypoint is desired.

`README.md` required content:
1. Title (company-neutral slug-derived, e.g. `# permissioned-credit-ledger`) + one-line subtitle naming the reconciliation engine as the marquee.
2. CI badge line: `[![CI](.../actions/workflows/ci.yml/badge.svg)](.../actions/workflows/ci.yml)` pointing at the #3 workflow.
3. `## What it is` — 2-3 sentences; ERC-3643-lite permissioned security token + viem indexer + Pothos GraphQL + Postgres read models + React/Vite; off-chain<->on-chain reconciliation with fail-closed HALT.
4. `## Quick start` — copy-pasteable: `cp .env.example .env`; `bun install`; start local node; `forge script script/Deploy.s.sol --rpc-url <local>` ; apply migrations; start `api` (graphql-yoga) and `web` (vite) ; `bun run scripts/verify_matrix.ts` expecting `10/10`. Reference at least one architecture SVG (from #29) inline.
5. `## Layout` — the repo map: `contracts/` (foundry src/test/script), `indexer/`, `api/`, `web/`, `db/migrations/`, `scripts/`, `docs/architecture/`.
6. `## Test suite` — `forge test -vv` (unit + fuzz + invariant); `bun test` / `vitest` (incl. the fast-check replay property #19); `bun run scripts/verify_matrix.ts` (the 10-scenario integration suite #27).
7. Link to `docs/architecture/DESIGN.md` and `docs/DEMO.md`.

`docs/DEMO.md` required content:
1. `## Pre-run checklist` — bring up Postgres + local node; `scripts/demo_reset.ts`; start api + web; confirm `verify_matrix.ts` prints `10/10` before going live; abort rule if any step fails.
2. `## Script` — a timed walkthrough hitting all 10 matrix rows in order: (1) accredited-US invest -> `PositionOpened`; (2) Reg-S non-US invest -> OK; (3) unverified invest -> revert `NotEligible`; (4) transfer to frozen -> revert `ReceiverFrozen`; (5) transfer to unverified -> revert `ReceiverNotVerified`; (6) US non-accredited holds Reg-D -> revert `AccreditationRequired`; (7) claim, reserve funded -> `InterestClaimed`, reserve debited, accrued reset; (8) claim, reserve underfunded -> revert `InsufficientReserve`; (9) NAV feed +40% out-of-bounds -> HALT `NavAnomaly`, accrual frozen; (10) inject cash != claimable -> HALT distribution `ReconMismatch`. Each cell: the action, the expected typed code/event, and the UI/SSE signal (reason-code badge or HALT banner).
3. `## Fuji deploy` — a section that does a real `forge script ... --rpc-url <FUJI_RPC> --broadcast`, copies ABIs (#13), points the indexer at Fuji, and shows a Snowtrace explorer link for the deployed `CreditToken`.
4. `## Backup combinations` — Plan-B per fragile scenario (table), mirroring the established pattern.
5. `## If something breaks live` — recovery commands, the chief one being `bun run scripts/demo_reset.ts`.

`scripts/demo_reset.ts` public surface:
- `async function demoReset(opts?: { rpcUrl?: string }): Promise<void>` — kill+restart local node, redeploy, reseed 6 identities (2 accredited-US, 2 Reg-S, 1 unverified, 1 frozen) + 6 loans, re-apply `db/migrations` to a clean schema. Exits non-zero on any sub-step failure with a typed reason (no silent partial reset).
- Runnable as `bun run scripts/demo_reset.ts`; completes from cold in a bounded time the README states (target < 30s on the local node).

**Acceptance criteria.**
- [ ] 1. `README.md` exists with all 7 required sections (grep each `##` heading) and the CI badge line pointing at `.github/workflows/ci.yml`.
- [ ] 2. `docs/DEMO.md` `## Script` references all 10 matrix rows by their exact typed identifiers (the 5 reason codes + `NavAnomaly` + `ReconMismatch` + events `PositionOpened` / `InterestClaimed`); a grep for each identifier hits.
- [ ] 3. `docs/DEMO.md` has a `## Fuji deploy` section containing a `--rpc-url` + `--broadcast` invocation and a Snowtrace explorer reference.
- [ ] 4. `scripts/demo_reset.ts` exists, is executable via `bun run`, and `bun run scripts/demo_reset.ts` exits 0 against a running local node (or the README documents its prerequisites and it exits with a typed non-zero on missing prereqs — no silent success).
- [ ] 5. Quickstart commands in `README.md` are internally consistent with actual file paths (`script/Deploy.s.sol`, `scripts/verify_matrix.ts`, `db/migrations/`) — every referenced path exists.
- [ ] 6. Both docs state the verifier's expected output as the literal `10/10` (not vague "tests pass").
- [ ] 7. `rg -i 'profitr|job description|interview' README.md docs/DEMO.md scripts/demo_reset.ts` returns no matches.
- [ ] 8. `tsc --noEmit` (or `bun run typecheck`) is clean for `scripts/demo_reset.ts`; eslint clean; CI bun job green.
- [ ] 9. At least one architecture SVG from #29 is referenced by relative path in `README.md` and the path resolves.
- [ ] 10. N/A for new fuzz/property tests (docs + reset-script ticket); the criterion is met by README's `## Test suite` *invoking* the existing fast-check replay property (#19) as part of the documented `vitest` run, verified by that command being present and the path it names existing.

**Out of scope.**
- Implementing or altering `scripts/verify_matrix.ts` or the 10 scenarios themselves — owned by #27; this ticket consumes its `10/10` output.
- Authoring `DESIGN.md` or the architecture SVGs — owned by #29; README only links to them.

**Notes.** Landmine: the Fuji walkthrough depends on `FUJI_RPC` + `PRIVATE_KEY` in `.env` and a faucet-funded deployer — `demo_reset.ts` must target the **local** node, never Fuji, or a fumbled live reset could broadcast real testnet txs and burn the faucet balance mid-demo; guard the reset so a missing/explicit local RPC is required and a Fuji RPC is refused. Keep the CI badge URL and the workflow filename (`ci.yml`) in exact sync with #3, or the badge renders broken. State the local-node reset budget as a number the demo can rely on, consistent with the sibling project's sub-30s discipline.

---
**The README must LAND + every feature demoable.** README opens with a one-line value prop + a hero diagram (the off-chain↔on-chain reconciliation), a 60-second quickstart that actually works (`bun run dev` brings the whole stack up — #31), a screenshot/GIF of the marketplace + the reconciliation HALT banner, and a "Run the 10 scenarios" section. `DEMO.md` is a click-by-click script where **every** feature is reachable from the running app: invest (eligible + rejected-with-reason-badge), live accrual ticker, claim, a `NavAnomaly` HALT, a `ReconMismatch` HALT. If a feature can't be shown from the UI or `verify_matrix`, it's out of scope.

### #31 feat(scripts): idempotent port-safe dev script (stop → test → start)

**Block:** 6 · **Type:** feat · **Scope:** scripts · **Estimate:** 40m · **Blocked by:** #12, #15, #16, #21, #25 · **Labels:** block-6, infra

**Why.** A one-command, re-runnable dev experience is what makes the whole thing demoable on demand (#30) and keeps CI honest (#28). It must be **idempotent** — safe to run repeatedly — and never collide with already-running services, because a flaky "it won't start" kills a live demo.

**What.**
- Files to create: `scripts/dev.sh` (executable), `scripts/stop.sh`, `scripts/lib/ports.sh` (the fixed port map + helpers); add `"dev": "./scripts/dev.sh"` and `"stop": "./scripts/stop.sh"` to root `package.json`. Pidfiles in `.dev/` (gitignored).
- **Fixed, non-default ports** (override via `.env`): Postgres `55432`, local EVM node (anvil) `18545`, GraphQL API `41990`, web (Vite) `51730` — chosen to avoid common dev ports (3000 / 5173 / 5432 / 8545 / 8080).
- `dev.sh` flow, `set -euo pipefail`, with an `EXIT` trap that tears down background procs:
  1. **STOP (idempotent):** free each of the 4 ports (`lsof -ti tcp:$PORT | xargs -r kill -9`), `docker compose -p pcl down -v --remove-orphans`, kill stale anvil/indexer/api/web by pidfile. Two runs back-to-back both succeed.
  2. **TEST:** `(cd contracts && forge test -vv)` then `bun test` — abort start on failure. `--no-test` skips for fast restarts.
  3. **START:** Postgres (compose) on `55432`; `anvil --port 18545`; `wait-on` both; run SQL migrations; `forge script Deploy.s.sol --rpc-url localhost:18545 --broadcast` (seed identities + mortgages); start indexer, api, web (pidfiles in `.dev/`); `wait-on http://localhost:41990/health` + the web port.
  4. Print a banner: API GraphQL URL, web URL, seeded demo accounts.
- Flags: `--reset` (wipe Postgres volume + redeploy via `scripts/demo_reset` from #30), `--no-test`.

**Acceptance criteria.**
- [ ] `./scripts/dev.sh` run **twice consecutively** both end stack-healthy (idempotency); a check asserts the 4 ports are owned by our procs.
- [ ] With a foreign process squatting one of the 4 ports, `dev.sh` frees it and still comes up green (no port conflict).
- [ ] forge + bun tests run and must pass before any service starts; `--no-test` skips.
- [ ] `wait-on` health gates pass (API `/health` 200 + web reachable) before the banner prints.
- [ ] `Ctrl-C` (EXIT trap) stops every background process and frees all 4 ports.
- [ ] `bun run dev` / `bun run stop` aliases work.

**Out of scope.**
- Production process management (pm2 / systemd) — dev/demo orchestrator only.
- Multi-OS support beyond macOS/Linux (the dev + CI targets).

**Notes.** POSIX-bash + `lsof` + `wait-on`; no heavy task runner. `scripts/verify_matrix.ts` (#27) and CI (#28) reuse this to bring the stack up deterministically.

