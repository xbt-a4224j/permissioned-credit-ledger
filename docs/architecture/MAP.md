# System Map — classes, modules, and entities

A whiteboard-ready reference: how the major pieces interrelate, in five views.

1. [System component graph](#1-system-component-graph) — the 30,000-ft topology
2. [On-chain class diagram](#2-on-chain-class-diagram-l1--l2) — the Solidity contracts
3. [Off-chain module dependency graph](#3-off-chain-module-dependency-graph) — the TS packages
4. [Entity-relationship diagram](#4-entity-relationship-diagram-postgres) — the Postgres read models
5. [End-to-end data flow](#5-end-to-end-data-flow) — invest → accrue → reconcile → halt

> All diagrams are Mermaid; they render inline in the WebStorm/GitHub preview pane.

---

## 1. System component graph

The four runtimes and what crosses between them. The **reconciliation engine** is the load-bearing piece: it folds the chain event log back into expected state and gates distribution.

```mermaid
flowchart LR
  subgraph CHAIN["⛓️ On-chain (Avalanche / anvil)"]
    direction TB
    IR[IdentityRegistry]
    CT[CreditToken]
    USDC[MockUSDC reserve]
    CT -->|"verified? (_update)"| IR
    CT -->|claim pays| USDC
  end

  subgraph IDX["🔌 Indexer (Bun + viem)"]
    direction TB
    READER[event reader]
    PROJECT[projector]
    READER --> PROJECT
  end

  subgraph DB["🗄️ Postgres read models"]
    direction TB
    RM[("loans · positions · identities<br/>chain_events · nav_readings<br/>reserve · recon_status · tx_status")]
  end

  subgraph API["🧩 API (Bun · Pothos GraphQL · SSE)"]
    direction TB
    RESOLVERS[resolvers]
    RECON[reconciliation engine]
    NAVGATE[NAV gate]
    SSE[SSE feeds]
  end

  subgraph WEB["🖥️ Web (React + Vite)"]
    direction TB
    VIEWS[Marketplace · Positions<br/>Servicing · Health]
  end

  CT -. "CreditToken events" .-> READER
  PROJECT -->|upsert| RM
  RECON -->|"read claimable()"| CT
  RECON -->|verdict row| RM
  RESOLVERS -->|read| RM
  RESOLVERS -->|"writeContract"| CT
  NAVGATE --> RM
  RM -. "NOTIFY recon_changed" .-> SSE
  WEB <-->|GraphQL| RESOLVERS
  WEB <-. "live SSE" .- SSE

  classDef keystone fill:#1e293b,stroke:#38bdf8,color:#e2e8f0,stroke-width:2px;
  class RECON keystone;
```

---

## 2. On-chain class diagram (L1 + L2)

Verified-only permissioned token: every transfer routes through `_update`, which reverts if the receiver is not verified (#66). Reverts are **typed custom errors**, never strings.

```mermaid
classDiagram
  direction LR

  class IIdentityRegistry {
    <<interface>>
    +isVerified(addr) bool
    +setVerified(addr, bool)
  }
  class ICreditToken {
    <<interface>>
    +claimable(addr) uint256
    +claim()
    +freezeAccrual()
    +mint(to, amount)
  }

  class IdentityRegistry {
    +mapping~addr→bool~ _verified
    +setVerified()
  }
  class CreditToken {
    +IIdentityRegistry identity
    +IERC20 reserve
    +uint256 ratePerSecond
    +mapping~addr→Accrual~ _accrual
    +_update(from,to,amount) hook
    +_settleAccrual() / claimable()
  }
  class MockUSDC {
    +mint(to, amount)
  }
  class Errors {
    <<library>>
    ReceiverNotVerified
    InsufficientReserve · ExceedsPrincipal
  }

  AccessControl <|-- IdentityRegistry
  AccessControl <|-- CreditToken
  ERC20 <|-- CreditToken
  ERC20 <|-- MockUSDC
  ReentrancyGuard <|-- CreditToken

  IIdentityRegistry <|.. IdentityRegistry
  ICreditToken <|.. CreditToken

  CreditToken --> IIdentityRegistry : verified check on _update
  CreditToken --> MockUSDC : claim() debits reserve
  CreditToken ..> Errors : reverts
```

**The permissioning check (in `_update`, first failure reverts):**

```mermaid
flowchart TB
  A[transfer/mint] --> S2{receiver verified?}
  S2 -- no --> E2([revert ReceiverNotVerified])
  S2 -- yes --> OK([transfer proceeds])

  classDef rev fill:#7f1d1d,stroke:#fca5a5,color:#fee2e2;
  class E2 rev;
```

---

## 3. Off-chain module dependency graph

Arrows point **toward the dependency** (A → B means "A imports/uses B"). `@pcl/shared` (brand · reasons · schemas · db) is the common vocabulary every package builds on.

```mermaid
flowchart TB
  subgraph SHARED["@pcl/shared"]
    BRAND[brand.ts<br/>Usdc6·Bps·LoanId]
    REASONS[reasons.ts<br/>ReasonCode·EngineState]
    SCHEMAS[schemas.ts<br/>Loan·Identity·Position]
    SDB[db driver]
  end

  subgraph INDEXER["indexer/"]
    IMAIN[main.ts] --> ICLIENT[client.ts]
    IMAIN --> IMANIFEST[manifest.ts]
    IMAIN --> ISEED[seed.ts]
    IMAIN --> IINGEST[ingest.ts]
    IINGEST --> IPROJECT[project.ts]
    IINGEST --> ICURSOR[cursor.ts]
    IINGEST --> IDECODE[decode.ts]
    IDECODE --> IABI[abi.ts]
  end

  subgraph API["api/"]
    SERVER[server.ts] --> CONTEXT[context.ts]
    SERVER --> SCHEMA[schema/index.ts]
    SERVER --> DRIVER[recon/driver.ts]
    SERVER --> SSEH[sse/handler.ts]

    SCHEMA --> QUERY[schema/query.ts]
    SCHEMA --> MUT[schema/mutation.ts]
    SCHEMA --> SCALARS[schema/scalars.ts]
    SCHEMA --> TYPES[schema/types/*]

    QUERY --> RQUERIES[resolvers/queries.ts]
    QUERY --> RTXQ[resolvers/tx-queries.ts]
    MUT --> RMUT[resolvers/mutations.ts]
    MUT --> ROPS[resolvers/ops.ts]
    MUT --> KYCR[kyc/resolve.ts]
    KYCR --> KYCP[kyc/provider.ts]

    RMUT --> CCT[chain/credit-token.ts]
    RMUT --> CERR[chain/errors.ts]
    RMUT --> TXT[tx/tracker.ts]
    RMUT --> TXREC[tx/reconcile.ts]
    RMUT --> HALT[recon/halt.ts]
    CCT --> CABI[chain/abi.ts]

    DRIVER --> ENGINE[recon/engine.ts]
    ENGINE --> SNAP[recon/snapshot.ts]
    ENGINE --> INV[recon/invariants.ts]
    ENGINE --> REPLAY[replay/replay.ts]
    ENGINE --> HALT
    REPLAY --> FOLD[replay/fold.ts]
    REPLAY --> HASH[replay/hash.ts]
    FOLD --> RSTATE[replay/state.ts]
    FOLD --> NBOUNDS[nav/bounds.ts]

    NGATE[nav/gate.ts] --> NBOUNDS
    NGATE --> NFEED[nav/feed.ts]
    AGATE[nav/accrualGate.ts]

    SSEH --> BUS[sse/bus.ts]
    SSESRC[sse/sources.ts] --> BUS
    SSESRC --> SER[sse/serialize.ts]
    RREADER[recon-reader.ts]
  end

  subgraph WEB["web/"]
    APP[App.tsx] --> WVIEWS[views/*]
    WVIEWS --> WQ[queries.ts]
    WVIEWS --> WUQ[lib/useQuery.ts]
    WVIEWS --> WRECON[lib/reconStream.ts]
    WVIEWS --> WMUT[lib/mutations.ts]
    WMUT --> WRUN[lib/runMutation.ts]
    WRUN --> WGQL[lib/graphqlClient.ts]
    WRECON --> WSSE[lib/sse.ts]
    WVIEWS --> WREASON[lib/reasonCodes.ts]
    WVIEWS --> WFMT[lib/format.ts]
  end

  INDEXER --> SHARED
  API --> SHARED
  WEB -. "GraphQL / SSE wire" .-> API
  IPROJECT -->|writes| SDB
  RQUERIES -->|reads| SDB
  SNAP -->|reads| SDB
  HALT -->|writes| SDB

  classDef shared fill:#0f172a,stroke:#64748b,color:#cbd5e1;
  class BRAND,REASONS,SCHEMAS,SDB shared;
  classDef keystone fill:#1e293b,stroke:#38bdf8,color:#e2e8f0,stroke-width:2px;
  class ENGINE,REPLAY keystone;
```

---

## 4. Entity-relationship diagram (Postgres)

Eleven read-model tables (plus `applied_migrations`). `properties → loans → positions` is the asset spine; `tx_status → optimistic_positions` is the pending-write overlay; `recon_status`, `reserve`, `indexer_cursor` are singletons/append-only ledgers.

```mermaid
erDiagram
  PROPERTIES  ||--o{ LOANS            : "secures"
  LOANS       ||--o{ POSITIONS        : "tokenized as"
  IDENTITIES  ||--o{ POSITIONS        : "held by"
  LOANS       ||--o{ NAV_READINGS     : "marked by"
  TX_STATUS   ||--o| OPTIMISTIC_POSITIONS : "spawns (cascade)"

  PROPERTIES {
    text     id PK
    text     address_label
    numeric  appraised_value
  }
  LOANS {
    text     id PK
    numeric  principal
    text     status "PERFORMING|DELINQUENT|DEFAULT"
    bigint   started_at
    text     collateral_type "CRE|RESIDENTIAL"
    text     property_id FK
  }
  IDENTITIES {
    text     addr PK
    boolean  verified
  }
  POSITIONS {
    text     id PK
    text     loan_id FK
    text     holder FK
    numeric  principal
    numeric  accrued
    bigint   opened_at
  }
  CHAIN_EVENTS {
    text     id PK "txHash:logIndex"
    text     name
    bigint   block_number
    int      log_index
    jsonb    payload
    timestamptz ingested_at
  }
  NAV_READINGS {
    bigserial id PK
    text     loan_id FK
    int      nav_bps
    bigint   observed_at
    text     source
    boolean  accepted
    text     reject_reason
  }
  RESERVE {
    int      id PK "always 1"
    numeric  balance
    bigint   updated_at
  }
  RECON_STATUS {
    bigserial cycle_id PK
    timestamptz ran_at
    boolean  ok
    text     state "NavAnomaly|ReconMismatch"
    text     failed_invariant
    text     state_hash
    jsonb    detail
  }
  INDEXER_CURSOR {
    int      id PK "always 1"
    bigint   block_number
    timestamptz updated_at
  }
  TX_STATUS {
    text     hash PK
    text     kind "invest|transfer|claim"
    text     state "PENDING|CONFIRMED|REVERTED"
    text     reason_code
    text     holder
    text     loan_id
    timestamptz submitted_at
    timestamptz settled_at
    numeric  block_number
  }
  OPTIMISTIC_POSITIONS {
    text     hash PK "FK to tx_status, cascade"
    text     holder
    text     loan_id
    numeric  principal
    timestamptz created_at
  }
```

> `chain_events`, `recon_status`, `indexer_cursor` carry no FK edges by design — they're the append-only event log, the verdict ledger, and the resume cursor. `chain_events.id = txHash:logIndex` is the idempotency key; `(block_number, log_index)` is the separate replay-ordering key.

---

## 5. End-to-end data flow

One invest, one accrual tick, one reconciliation cycle, and a halt — the whole heartbeat in one sequence.

```mermaid
sequenceDiagram
  autonumber
  actor U as Investor (web)
  participant API as GraphQL API
  participant CT as CreditToken (chain)
  participant IDX as Indexer
  participant DB as Postgres
  participant RE as Recon engine
  participant SSE as SSE feed

  Note over U,SSE: invest
  U->>API: mutation invest(loan, amount)
  API->>API: assertCanDistribute (read latest recon_status)
  API->>CT: writeContract mint(to, amount)
  CT->>CT: _update → receiver verified?
  CT-->>API: tx hash (PENDING)
  API->>DB: tx_status + optimistic_position
  CT-->>IDX: PositionOpened + Transfer events
  IDX->>DB: upsert positions / chain_events (idempotent)

  Note over RE,SSE: heartbeat (every 2s)
  loop runReconCycle
    RE->>DB: load snapshot (positions, reserve, nav)
    RE->>CT: read claimable(holder) per holder
    RE->>RE: replay(chainEvents+nav) → stateHash
    RE->>RE: I1 SupplyBacked · I2 ClaimableCovered<br/>I3 NavInBounds · I4 IdentityValid
    alt all invariants hold
      RE->>DB: recon_status(ok=true)
    else violation
      RE->>DB: recon_status(ok=false, ReconMismatch) — HALT
    end
    DB-->>SSE: NOTIFY recon_changed
    SSE-->>U: live Health panel update
  end

  Note over U,SSE: bad NAV mark
  U->>API: submitNav(loan, 14000 bps)
  API->>API: withinBounds() → OutOfBounds
  API->>DB: nav_readings(accepted=false) + recon_status(NavAnomaly) — freeze accrual
  DB-->>SSE: NOTIFY → UI shows NavAnomaly
```

---

### How to read these together

- **Diagram 2** is what the chain enforces (the "can't lie" layer).
- **Diagram 3** is what recomputes and checks it off-chain (the "prove it" layer).
- **Diagram 4** is where the recomputed truth lands.
- **Diagram 5** is the loop that ties them — and the two ways it halts.

The single most important edge in the whole system: **Recon engine → `read claimable()` on CreditToken**, compared against **`reserve.balance` in Postgres**. That comparison is invariant **I2 ClaimableCovered** — the solvency gate. Everything else exists to make that comparison trustworthy and reproducible.

---

# Part II — Deep dives

The five views above are the map. The seven below are the territory: each takes one mechanism and explains it at the depth you'd need to defend it at a whiteboard. Order roughly follows the data: reconcile → replay → halt → accrue → gate → settle the pending write → feed it back.

## 6. The reconciliation cycle (the heartbeat, internally)

```mermaid
flowchart TB
  T["setTimeout tick — every 2s, chained"] --> SNAP["build ReconSnapshot"]
  subgraph SNAPSHOT["snapshot = off-chain books + on-chain reads, one instant"]
    direction TB
    S1["positions, identities — Postgres"]
    S2["reserve.balance — Postgres (offchainCollected)"]
    S3["latest ACCEPTED nav per loan — Postgres"]
    S4["totalSupply() + claimable(holder) — chain reads (viem)"]
  end
  SNAP --> SNAPSHOT
  SNAPSHOT --> REPLAY["replay(chainEvents + nav) → stateHash"]
  REPLAY --> I1{"I1 SupplyBacked?<br/>onchainTotalSupply == offchainBackedPrincipal"}
  I1 -- no --> H1[["ReconMismatch · SupplyBacked"]]
  I1 -- yes --> I2{"I2 ClaimableCovered?<br/>sum claimable ≤ offchainCollected"}
  I2 -- no --> H2[["ReconMismatch · ClaimableCovered"]]
  I2 -- yes --> I3{"I3 NavInBounds?<br/>no loan under NavAnomaly"}
  I3 -- no --> H3[["NavAnomaly · NavInBounds"]]
  I3 -- yes --> I4{"I4 IdentityValid?<br/>every holder verified"}
  I4 -- no --> H4[["ReconMismatch · IdentityValid"]]
  I4 -- yes --> OK[["ok = true"]]
  H1 --> W
  H2 --> W
  H3 --> W
  H4 --> W
  OK --> W["INSERT recon_status (ok, state, failed_invariant, state_hash, detail)"]
  W --> N["trigger → NOTIFY recon_changed → SSE → Health panel"]
  W -.->|"loop"| T

  classDef halt fill:#7f1d1d,stroke:#fca5a5,color:#fee2e2;
  class H1,H2,H3,H4 halt;
```

**What a "cycle" actually is.** Every 2 seconds `startReconDriver` fires `runReconCycle`. The cycle is stateless between runs — it holds nothing in memory, re-derives everything from Postgres + the chain, writes exactly one `recon_status` row, and returns. That statelessness is deliberate: a crash, a restart, or a parallel reader all see the same answer because the answer is a pure function of durable state. There is no "accumulator" that could desync.

**The snapshot is the whole trick.** Notice the snapshot straddles the seam — it reads the off-chain books (`positions`, `reserve`, `identities`, the latest *accepted* NAV) from Postgres *and* the on-chain truth (`totalSupply()`, `claimable(holder)`) directly from the contract via viem. The invariants then compare one side against the other. This is why the engine can catch a divergence the indexer alone never could: the indexer only knows what it projected; the recon engine asks the chain itself and checks the projection against it.

**The four invariants, in fixed order, short-circuiting on the first failure:**

- **I1 `SupplyBacked`** — `onchainTotalSupply == offchainBackedPrincipal`. Sum of every token's `totalSupply()` must equal the sum of `positions.principal` in the book. If they disagree, the projection is wrong — the book thinks a different number of tokens exist than actually do. This is an *integrity* break (the ledger is miscounting) — typically the indexer's projection drifting from the chain.
- **I2 `ClaimableCovered`** — `sum(claimable(holder)) ≤ offchainCollected`. Aggregate on-chain claimable must be covered by the cash the servicer actually collected (the reserve balance). This is the *solvency* gate — the single most important comparison in the system. If it breaks, holders could claim money that was never collected. Matrix row 7 breaks it on purpose by reporting collected cash below claimable (`reportCash`).
- **I3 `NavInBounds`** — no active loan is sitting under a `NavAnomaly` halt. This is the one invariant whose engine `state` is `NavAnomaly` rather than `ReconMismatch`, because its cause is a bad mark, not a cash/supply divergence.
- **I4 `IdentityValid`** — every current holder is `verified` (#66). An unverified holder on the book is a permissioning break the `_update` check should never have permitted; finding one means something bypassed the front door.

**Why fixed order matters.** `evaluateInvariants` returns the *first* failure. If the order were nondeterministic, the recorded `failed_invariant` could flip between runs on a state that breaks two invariants at once — and matrix row 7 would flake in CI. Determinism of the *verdict*, not just the *value*, is the property.

## 7. Deterministic replay and the `stateHash`

```mermaid
flowchart LR
  subgraph IN["input SET — any arrival / interleaving"]
    direction TB
    E1["Transfer b=12 li=0"]
    E2["PositionOpened b=12 li=1"]
    E3["NAV observed=1000 src=oracle"]
    E4["InterestClaimed b=20 li=3"]
  end
  IN --> SORT["sort by orderKey()<br/>chain → '0:block:logIndex'<br/>nav → '1:observedAt:source:bps'"]
  SORT --> FOLD["reduce(applyInput, genesis, now)<br/>now = max(observedAt), injected once"]
  FOLD --> ST["ReplayState<br/>positions · reserve · navByLoan · halted"]
  ST --> CANON["canonicalize (sort holders, stringify bigints)"]
  CANON --> HASH["keccak256 → stateHash 0x…"]

  classDef key fill:#1e293b,stroke:#38bdf8,color:#e2e8f0;
  class HASH key;
```

**The property, stated precisely:** for any set of chain events + NAV marks, replaying them in *any* arrival order produces an *identical* `stateHash`. This is the headline fast-check property test, and it's what makes the halt auditable — anyone can re-run the log and get byte-for-byte the same answer.

**How the order-independence is achieved.** The input set is sorted by `orderKey()` *before* folding, so arrival order is irrelevant — every permutation collapses to one canonical order. The key cleverly separates two keyspaces with a tag prefix: chain events sort as `0:blockNumber:logIndex` (zero-padded so string compare == numeric compare), NAV marks as `1:observedAt:source:bps`. The `0:`/`1:` prefix guarantees chain events always precede NAV at the same numeric position, deterministically, with no ambiguity.

**Why `applyInput` must be pure.** The reducer takes state in and returns new state out, clone-on-write, with **no wall clock and no RNG**. The deterministic `now` (the max `observedAt` across the whole input set) is *injected* and threaded identically into every fold. A stray `Date.now()` inside the fold would break the property only under interleaving, only in CI — the nastiest kind of bug. The comment in `fold.ts` flags exactly this.

**Why full replay, not incremental.** Each cycle replays from genesis rather than applying a delta to last cycle's state. That's "wasteful" in the way a pure function is wasteful — and it buys total absence of accumulator drift. There's no incremental state that could desync from the log; the log *is* the state. An incremental fold would reintroduce exactly the class of bug the whole system exists to prevent.

**Why the replay reuses live code.** `applyChain` mirrors the indexer's `project.ts` balance model and `applyNav` calls the *same* `withinBounds` the live NAV gate uses. Replay and live therefore can't diverge — if they used different math, the hash would prove nothing. The single source of truth for "what a Transfer does to balances" is shared between the projector and the replay fold by construction.

## 8. The two HALT mechanisms (and the cascade landmine)

The system fails closed in two distinct places. Knowing which catches what is a classic whiteboard probe.

```mermaid
flowchart TB
  subgraph G1["Mechanism 1 — NAV gate · off-chain · BEFORE a mark drives anything"]
    direction TB
    M["new NAV mark arrives"] --> WB{"withinBounds vs last ACCEPTED?<br/>· fresh (≤1h)<br/>· strictly newer timestamp<br/>· |Δ| ≤ 20% (2000 bps)"}
    WB -- reject --> NA["nav_readings(accepted=false, reason)<br/>recon_status NavAnomaly<br/>on-chain freezeAccrual()"]
    WB -- accept --> ADV["nav_readings(accepted=true)<br/>becomes the new baseline"]
  end
  subgraph G2["Mechanism 2 — recon engine · continuous · every cycle"]
    direction TB
    C["2s recon cycle"] --> EV{"all 4 invariants hold?"}
    EV -- no --> RM["recon_status ReconMismatch / NavAnomaly<br/>distribution halts"]
    EV -- yes --> OKK["ok = true"]
  end

  classDef halt fill:#7f1d1d,stroke:#fca5a5,color:#fee2e2;
  class NA,RM halt;
```

**Mechanism 1 — the NAV gate** is a *predictive, point-of-entry* guard. A mark that's stale, out of timestamp order, or jumps more than ±20% from the last accepted value never enters the accepted feed. It's the first line: stop the bad input before it can mis-price anyone. Its halt state is `NavAnomaly`.

**Mechanism 2 — the recon engine** is a *continuous, whole-system* guard. Even if every input was individually valid, the engine re-checks that the aggregate still holds together (supply, solvency, NAV, identity) every 2 seconds. Its halt state is usually `ReconMismatch` (and `NavAnomaly` for the I3 case). It catches what no single input check could: emergent divergence.

The cleanest one-liner: **the NAV gate validates an input; the recon engine validates the system.** One is a bouncer at the door; the other is a continuous audit of everyone already inside.

### The cascade landmine

```mermaid
flowchart LR
  A["accepted mark = 10000 bps (baseline)"] --> B["bad mark = 14000 bps (+40%)"]
  B --> R{"withinBounds vs last ACCEPTED (10000)"}
  R -- "reject (>20%)" --> X["stored accepted=false<br/>NOT promoted to baseline"]
  C2["next legit mark = 10100 bps"] --> R2{"vs last ACCEPTED — still 10000, NOT 14000"}
  R2 -- "+1% → ok" --> Y["accepted, becomes baseline"]

  classDef bad fill:#7f1d1d,stroke:#fca5a5,color:#fee2e2;
  class B,X bad;
```

The baseline for the bounds check is always the last **accepted** mark, never the last **received** one. If a rejected +40% spike were allowed to become the baseline, the *next* legitimate mark (back at the true value) would itself look like a -29% crash and get rejected — and now every subsequent good mark cascades into rejection, a single bad input poisoning the feed forever. `lastAccepted` querying `accepted = true` is the one line that prevents this. It's the subtlest correctness point in the NAV path and a great thing to volunteer at a whiteboard.

## 9. Accrual and claim — the money-movement path

```mermaid
sequenceDiagram
  autonumber
  participant H as Holder
  participant CT as CreditToken
  participant R as Reserve (MockUSDC)

  Note over CT: every mint/transfer/burn first calls _settleAccrual<br/>on the PRE-change balance (so the slice up to now is captured)
  H->>CT: claim()  — nonReentrant
  CT->>CT: _settleAccrual(holder)
  Note over CT: accrued += balance · ratePerSecond · elapsed / RATE_SCALE<br/>elapsed = span − (halted gap inside span)
  CT->>CT: owed = accruals[holder].accrued
  CT->>R: reserve.balanceOf(this)
  alt owed > reserve balance
    CT-->>H: revert InsufficientReserve(owed, bal)   — matrix row 5
  else funded
    CT->>CT: accrued = 0          — EFFECT (before interaction)
    CT->>R: safeTransfer(holder, owed)   — INTERACTION (last)
    CT-->>H: emit InterestClaimed(holder, loan, owed)   — matrix row 4
  end
```

**Lazy accrual, not a cron.** No job loops over holders crediting interest. Instead each holder carries an `Accrual { lastAccruedAt, accrued, haltedSnapshot }`, and interest is computed *on demand* as `balance · ratePerSecond · elapsed / RATE_SCALE`. `claimable(holder)` is a pure view that adds the settled `accrued` to the not-yet-folded slice up to the accrual clock — so the UI ticker reads a live number without any state write. Settlement (folding the slice into `accrued` and stamping the clock) happens only when something forces it: a `claim()`, or a transfer that moves the holder's balance.

**Why settle on the pre-change balance.** `_update` (the OZ hook every mint/transfer/burn funnels through) calls `_settleAccrual` on *both* parties *before* `super._update` moves the tokens. If it settled after, a transfer would retroactively accrue the sender's interest at the receiver's new balance — wrong. Settling first snapshots each party's earnings at the balance they actually held during the elapsed window.

**The halt accounting.** When accrual is frozen (a `NavAnomaly` or a `DEFAULT` status), the contract doesn't eagerly settle every holder. It tracks a global `haltedElapsed` and each holder's `haltedSnapshot`; `elapsed` subtracts the halted gap that fell inside the holder's span. The effect: a halt preserves everyone's pre-halt earnings exactly, with no per-holder write at freeze time — earnings simply stop advancing until the halt clears. `_accrualClock()` returns `accrualEndsAt` (the freeze instant) instead of `now` while halted.

**Reentrancy: belt and suspenders.** `claim()` is `nonReentrant` *and* follows checks-effects-interactions: it zeroes `accrued` (the effect) **before** `safeTransfer` (the interaction). Even if the reserve token had a malicious transfer hook, the holder's claimable is already zero by the time control could re-enter — there's nothing left to double-claim. The forge invariant test asserts total claimed never exceeds total accrued-minus-reserve under adversarial ordering.

## 10. The permissioning check — verified-only

The permissioning model is a single `verified` boolean per address (#66). `_update` performs exactly one check: a transfer/mint to a non-verified receiver reverts `ReceiverNotVerified`. Here's where each seeded identity lands:

| Seeded identity | claims | mint/transfer to this receiver |
|---|---|---|
| `VERIFIED_1/2` | verified | ✅ OK |
| `UNVERIFIED` | not verified | ❌ `ReceiverNotVerified` |

```mermaid
flowchart TB
  T["transfer/mint reaches _update"] --> S2{receiver verified?}
  S2 -- yes --> OK([OK])
  S2 -- no --> E2([revert ReceiverNotVerified])

  classDef rev fill:#7f1d1d,stroke:#fca5a5,color:#fee2e2;
  class E2 rev;
```

**Why `verified` is the seam.** The single boolean is the minimal permissioning predicate: a holder either passed KYC or didn't, and only verified holders can receive the token. Jurisdiction/accreditation/offering gating (Reg-D/Reg-S) was collapsed out (#66) — the per-offering cap-table logic is a named extension point that hangs off this same `_update` check, not built. The two rows above are scenario-matrix rows 1–3.

**Permissioning is by construction, not by check-after.** The check runs inside `_update`, the OZ chokepoint every balance change funnels through. There is no code path that moves a token without passing it. `super._update` runs *last*, so a reverting check never mutates balances — the failure is atomic. This is "permissioning enforced by construction" made literal.

## 11. Optimistic positions — converging the pending write to truth

```mermaid
stateDiagram-v2
  [*] --> PENDING : invest() writes tx + optimistic_positions row
  PENDING --> CONFIRMED : receipt mined, block_number set
  PENDING --> REVERTED : permissioning check reverted on-chain
  CONFIRMED --> RECONCILED : indexer projects canonical positions row, opened_at >= tx block
  RECONCILED --> [*] : optimistic row deleted
  REVERTED --> [*] : optimistic row dropped (cascade)
```

**The problem it solves.** When a holder invests, the tx is `PENDING` for a few seconds before the indexer projects the canonical `positions` row. Without help, the UI would show nothing during that gap — the investment would appear to vanish. So invest writes an `optimistic_positions` row immediately, and the query layer *merges* optimistic rows (marked `optimistic: true`) with canonical ones, so the holder sees their position instantly.

**The convergence rule.** An optimistic row is a projection that *must* converge to on-chain reality — the same convergence requirement the rest of the system enforces. `reconcileOptimistic` deletes an optimistic row once the indexer has projected a canonical `positions` row for the same `(holder, loan)` whose `opened_at` (a block number) is `≥` the tx's settling block. The match is strict on block number, not a bare `(holder, loan)` heuristic — so two rapid invests on one loan reconcile independently rather than one masking the other.

**Failure and idempotency.** If the tx reverts, the optimistic row is dropped (the FK to `tx_status` cascades on delete). And `reconcileOptimistic` is idempotent: a second run deletes zero rows. The optimistic overlay never lies for longer than one indexer lap, and it never leaves orphans — it's a temporary, self-erasing layer over the canonical truth.

## 12. The live feed — Postgres NOTIFY to the browser

```mermaid
flowchart LR
  CYCLE["recon cycle / accrual tick / chain event"] --> INS["INSERT into recon_status / read models"]
  INS --> TRG["AFTER INSERT trigger → pg_notify('recon_changed')"]
  TRG --> LISTEN["api: LISTEN recon_changed"]
  LISTEN --> BUS["EventBus (in-process pub/sub)"]
  SRC["sources: recon · accrual · chain"] --> BUS
  BUS --> H["/sse handler — text/event-stream"]
  H -->|"EventSource (browser)"| WEB["reconStream · ChainActivity · accrual ticker"]

  classDef db fill:#0f172a,stroke:#64748b,color:#cbd5e1;
  class INS,TRG db;
```

**Why SSE, not polling or Kafka.** The UI needs near-real-time pushes for three streams (recon verdicts, accrual ticks, chain activity) to a handful of browser tabs. SSE is the right-sized tool: it's one-way (server→client, which is all the UI needs), rides plain HTTP (no socket upgrade, no extra infra), and the browser's native `EventSource` auto-reconnects. A message queue like Kafka would be over-built for a single-node demo with one Postgres — it solves durability and fan-out-to-many-consumers problems this system doesn't have. The honest-scope answer at a whiteboard: "SSE because the feed is one-way to a few clients; Kafka would be infrastructure without a problem to solve here, and I'd only reach for it when I needed durable replay or many independent consumers."

**The NOTIFY trick.** The recon driver doesn't push to the UI directly. It writes a `recon_status` row; an `AFTER INSERT` trigger fires `pg_notify('recon_changed')`; the API's `LISTEN` wakes, and the `EventBus` fans the frame out to every connected SSE client. This decouples the writer from the readers entirely — the recon engine doesn't know or care how many UIs are watching, and a UI that connects mid-stream just starts receiving the next frame. Postgres is doing double duty as both the system of record and the message bus, which is exactly the right amount of infrastructure for this scope.

---

### Whiteboard cheat-sheet

If you can draw and narrate these five edges, you own the system:

1. **`_update` → `verified` check** — permissioning by construction; nothing moves to a non-verified receiver.
2. **chain events → indexer → `positions`** — the projection that *might* drift.
3. **recon engine → `claimable()` vs `reserve.balance`** — I2, the solvency gate that catches the drift.
4. **input log → sorted fold → `stateHash`** — determinism that makes the halt auditable.
5. **bad mark → `withinBounds` vs last *accepted*** — the NAV gate and why the baseline is accepted-only.

Everything else is detail hanging off those five.
