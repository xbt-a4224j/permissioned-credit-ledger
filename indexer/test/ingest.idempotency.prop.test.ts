// #16 headline property: ingestion is idempotent + order-stable.
// For an arbitrary delivery sequence of decoded events — containing arbitrary DUPLICATES and
// REORDERINGS — replaying through ingestEvent yields byte-identical final positions + reserve
// rows as replaying the deduped, canonical-(blockNumber, logIndex)-ordered sequence. This is
// the reorg/reconnect/restart guarantee (a re-delivered log is a no-op) the deterministic
// replay (#19) and recon (#18) stand on. Events are additive mints across distinct holders so
// the property isolates idempotency + order-independence with no transfer-underflow hazard.
import { afterAll, beforeAll, expect, test } from "vitest";
import fc from "fast-check";
import { eventId, identityAddr, loanId, usdc6, type ChainEvent, type Sql } from "@pcl/shared";
import { ingestEvent } from "../src/ingest.ts";
import { freshMigratedDb } from "../../shared/test/db.helper.ts";

const TOKEN = identityAddr("0x8a791620dd6260079bf849dc5567adc3f2fdc318");
const ZERO = identityAddr("0x0000000000000000000000000000000000000000");
const LOAN = loanId(1);

// a small pool of distinct holder addresses.
function holderAddr(i: number): `0x${string}` {
  return ("0x" + (i + 1).toString(16).padStart(40, "0")) as `0x${string}`;
}
function txh(n: number): `0x${string}` {
  return ("0x" + (n + 1).toString(16).padStart(64, "0")) as `0x${string}`;
}

// one mint = Transfer(0x0->holder) + PositionOpened, two events at (block, 0) and (block, 1).
function mintEvents(holderIdx: number, amount: bigint): ChainEvent[] {
  const holder = identityAddr(holderAddr(holderIdx));
  const block = BigInt(holderIdx + 1);
  return [
    { id: eventId(txh(holderIdx), 0), name: "Transfer", blockNumber: block, logIndex: 0, token: TOKEN, loan: LOAN, from: ZERO, to: holder, amount: usdc6(amount) },
    { id: eventId(txh(holderIdx), 1), name: "PositionOpened", blockNumber: block, logIndex: 1, token: TOKEN, holder, loan: LOAN, amount: usdc6(amount) },
  ];
}

// snapshot the read model as a stable, comparable string (sorted; bigints -> strings).
async function snapshot(sql: Sql): Promise<string> {
  const positions = await sql<{ holder: string; principal: bigint; accrued: bigint }[]>`
    select holder, principal::text as principal, accrued::text as accrued from positions order by holder
  `;
  const reserve = await sql<{ balance: bigint }[]>`select balance::text as balance from reserve where id = 1`;
  return JSON.stringify({ positions, reserve });
}

// MAX_HOLDERS distinct identities seeded once; the property truncates the mutable read-model
// tables between runs and reuses the two DBs so >=256 runs stays fast (no per-run db churn).
const MAX_HOLDERS = 5;

async function seedIdentities(sql: Sql): Promise<void> {
  await sql`insert into properties (id, address_label, appraised_value, lien_position) values ('1', 'x', 1, 1)`;
  await sql`insert into loans (id, principal, rate_bps, status, started_at, collateral_type, property_id, ltv_bps, dscr_bps) values ('1', 0, 1, 'PERFORMING', 0, 'CRE', '1', 6500, 14000)`;
  for (let i = 0; i < MAX_HOLDERS; i++) {
    await sql`insert into identities (addr, verified) values (${identityAddr(holderAddr(i))}, true)`;
  }
}

// reset only the per-run mutable rows (positions + reserve); identities/loans persist.
async function resetRun(sql: Sql): Promise<void> {
  await sql`truncate positions, chain_events`;
  await sql`insert into reserve (id, balance, updated_at) values (1, 0, 0) on conflict (id) do update set balance = 0`;
}

let a: Awaited<ReturnType<typeof freshMigratedDb>>;
let b: Awaited<ReturnType<typeof freshMigratedDb>>;

beforeAll(async () => {
  a = await freshMigratedDb("pcl_idem_a");
  b = await freshMigratedDb("pcl_idem_b");
  await seedIdentities(a.sql);
  await seedIdentities(b.sql);
});

afterAll(async () => {
  await a.dispose();
  await b.dispose();
});

// #16 regression: a second event colliding on (block_number, log_index) under a DIFFERENT id
// (a stale read model meeting a fresh chain instance) must be a NO-OP, never a throw. Before the
// `on conflict do nothing` fix the ingest targeted only the `id` pk, so this collision raised a
// unique violation and KILLED the indexer — freezing the cursor and stranding the read model until
// the recon engine HALTed on a phantom mismatch. The skip must also leave the first projection intact.
test("a (block, logIndex) collision under a different id is a no-op, not a crash", async () => {
  await resetRun(a.sql);
  const holder = identityAddr(holderAddr(0));
  const first: ChainEvent = { id: eventId(txh(0), 0), name: "Transfer", blockNumber: 1n, logIndex: 0, token: TOKEN, loan: LOAN, from: ZERO, to: holder, amount: usdc6(1000n) };
  const collidingDifferentId: ChainEvent = { id: eventId(txh(99), 0), name: "Transfer", blockNumber: 1n, logIndex: 0, token: TOKEN, loan: LOAN, from: ZERO, to: holder, amount: usdc6(9999n) };

  const a1 = await ingestEvent(a.sql, first);
  expect(a1.status).toBe("applied");
  const before = await snapshot(a.sql);

  // must NOT throw, and must report a skip (the (block, logIndex) row already exists).
  const a2 = await ingestEvent(a.sql, collidingDifferentId);
  expect(a2.status).toBe("duplicate");
  // and the colliding event's payload/amount must NOT have mutated the read model.
  expect(await snapshot(a.sql)).toBe(before);
  const rows = await a.sql<{ n: bigint }[]>`select count(*)::bigint as n from chain_events where block_number = 1 and log_index = 0`;
  expect(rows[0]?.n).toBe(1n);
});

test("ingestion is idempotent + order-stable over duplicates and reorderings", async () => {
  await fc.assert(
    fc.asyncProperty(
      // a pool of 1..MAX_HOLDERS distinct mints (each a unique pair of events).
      fc.integer({ min: 1, max: MAX_HOLDERS }),
      // a duplication recipe: extra re-deliveries picked from the flat event list, with repeats.
      fc.array(fc.nat(), { minLength: 0, maxLength: 40 }),
      async (numMints, picks) => {
        const flat = Array.from({ length: numMints }, (_, i) => mintEvents(i, BigInt((i + 1) * 1000))).flat();

        await resetRun(a.sql);
        await resetRun(b.sql);

        // canonical (deduped, in-order) run.
        for (const ev of flat) await ingestEvent(a.sql, ev);

        // noisy run: every unique event at least once, plus arbitrary re-deliveries, then
        // interleaved by sorting on id (fast-check drives content; this drives interleaving).
        const noisy = [...flat, ...picks.map((p) => flat[p % flat.length]!)];
        noisy.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
        for (const ev of noisy) await ingestEvent(b.sql, ev);

        expect(await snapshot(b.sql)).toBe(await snapshot(a.sql));
      },
    ),
    { numRuns: 256 },
  );
}, 60_000);
