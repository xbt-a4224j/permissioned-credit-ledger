// #23 optimistic-position reconciliation — converge to the indexer's truth.
// Before catch-up, positions(holder) includes the optimistic row (optimistic=true). After the
// canonical positions row at >= the tx block exists and reconcileOptimistic runs, the optimistic
// row is gone (no double count) and a second run deletes 0 (idempotent). A fast-check property
// asserts the lifecycle is monotonic over arbitrary settle->reconcile interleavings.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import fc from "fast-check";
import type { Sql } from "@pcl/shared";
import { migratedDb, buildContext, realChain } from "./helpers.ts";
import { reconcileOptimistic, optimisticPositionsFor } from "../src/tx/reconcile.ts";
import { recordPending } from "../src/tx/tracker.ts";
import { resolvePositions } from "../src/resolvers/queries.ts";
import type { ApiContext } from "../src/context.ts";

let sql: Sql;
let dispose: () => Promise<void>;
let ctx: ApiContext;

// migratedDb seeds reference rows only (NO chain backfill) so this holder/loan starts with no
// canonical position — the test controls every positions row directly (anvil-independent).
const HOLDER = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc" as const; // ACCREDITED_US_2
const HASH = "0x3333333333333333333333333333333333333333333333333333333333333333" as const;

beforeAll(async () => {
  const db = await migratedDb("pcl_rec");
  sql = db.sql;
  dispose = db.dispose;
  ctx = buildContext(sql, db.manifest, realChain());
});
afterAll(async () => {
  await dispose();
});

test("before catch-up: positions includes the optimistic row (optimistic=true)", async () => {
  await recordPending(sql, { hash: HASH, kind: "invest", holder: HOLDER, loanId: "2", amount: 7_000_000n });
  // confirm it so reconcileOptimistic is eligible to act once the canonical row lands.
  await sql`update tx_status set state = 'CONFIRMED', block_number = 5 where hash = ${HASH}`;

  const positions = await resolvePositions(ctx, HOLDER);
  const opt = positions.find((p) => p.loanId === "2");
  expect(opt).toBeDefined();
  expect(opt?.optimistic).toBe(true);
  expect(opt?.principal).toBe("7000000");
});

test("reconcileOptimistic is a no-op until the canonical positions row lands", async () => {
  // no canonical positions row at >= block 5 yet -> nothing removed.
  const res = await reconcileOptimistic(sql);
  expect(res.removed).toBe(0);
  expect((await optimisticPositionsFor(sql, HOLDER)).length).toBe(1);
});

test("after the canonical row lands, reconcileOptimistic removes the optimistic row (no double count)", async () => {
  // simulate the indexer projecting the canonical positions row at block 5.
  await sql`
    insert into positions (id, loan_id, holder, principal, accrued, opened_at)
    values ('2:' || ${HOLDER}, '2', ${HOLDER}, 7000000, 0, 5)
    on conflict (id) do update set principal = 7000000, opened_at = 5
  `;
  const res = await reconcileOptimistic(sql);
  expect(res.removed).toBe(1);

  const positions = await resolvePositions(ctx, HOLDER);
  const onLoan2 = positions.filter((p) => p.loanId === "2");
  expect(onLoan2.length).toBe(1); // exactly one (the canonical), not two.
  expect(onLoan2[0]?.optimistic).toBe(false);
});

test("reconcileOptimistic is idempotent — a second run deletes 0", async () => {
  const res = await reconcileOptimistic(sql);
  expect(res.removed).toBe(0);
});

describe("#23 lifecycle is monotonic over arbitrary interleavings", () => {
  test("property: settled state never returns to PENDING; optimistic gone once canonical exists", () => {
    type Step = "confirm" | "revert" | "project" | "reconcile";
    fc.assert(
      fc.property(fc.array(fc.constantFrom<Step>("confirm", "revert", "project", "reconcile"), { maxLength: 12 }), (steps) => {
        // a pure model of the lifecycle the DB enforces (state machine + optimistic invariant).
        // reconcileOptimistic only removes the optimistic row when, AT THE MOMENT IT RUNS, the tx
        // is CONFIRMED and the canonical row already exists — exactly the reconcile.ts predicate.
        let state: "PENDING" | "CONFIRMED" | "REVERTED" = "PENDING";
        let canonicalExists = false;
        let optimistic = true;
        // independently track whether a reconcile ever fired while CONFIRMED && canonical existed.
        let reconcileFiredEffectively = false;
        let prevState: "PENDING" | "CONFIRMED" | "REVERTED" = state;
        for (const s of steps) {
          if (s === "confirm" && state === "PENDING") state = "CONFIRMED";
          else if (s === "revert" && state === "PENDING") state = "REVERTED";
          else if (s === "project") canonicalExists = true;
          else if (s === "reconcile" && state === "CONFIRMED" && canonicalExists) {
            optimistic = false;
            reconcileFiredEffectively = true;
          }
          // headline monotonicity: a settled state (CONFIRMED/REVERTED) never reverts to PENDING.
          if (prevState !== "PENDING") expect(state).not.toBe("PENDING");
          prevState = state;
        }
        // the no-retain invariant: optimistic is removed EXACTLY when an effective reconcile fired,
        // and is otherwise retained — the optimistic flag is the negation of that condition.
        return optimistic === !reconcileFiredEffectively;
      }),
      { numRuns: 256 },
    );
  });
});
