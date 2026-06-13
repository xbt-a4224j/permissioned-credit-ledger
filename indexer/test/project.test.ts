// #16 projector + ingest unit coverage against a throwaway Postgres.
// Proves: a PositionOpened+Transfer mint creates one position with the right principal and
// accrued=0; a re-delivered EventId mutates nothing (idempotency); InterestClaimed debits the
// reserve + resets accrued; a Transfer moves principal between holders.
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { eventId, identityAddr, loanId, usdc6, type ChainEvent, type Sql } from "@pcl/shared";
import { ingestEvent } from "../src/ingest.ts";
import { freshMigratedDb } from "../../shared/test/db.helper.ts";

const HOLDER = identityAddr("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
const HOLDER2 = identityAddr("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc");
const ZERO = identityAddr("0x0000000000000000000000000000000000000000");
const TOKEN = identityAddr("0x8a791620dd6260079bf849dc5567adc3f2fdc318");
const LOAN = loanId(1);

function txh(n: number): `0x${string}` {
  return ("0x" + n.toString(16).padStart(64, "0")) as `0x${string}`;
}

// #16 mint = Transfer(0x0 -> holder, amt) + PositionOpened(holder, loan, amt).
function mintEvents(holder: string, amount: bigint, block: bigint, tx: number): ChainEvent[] {
  return [
    { id: eventId(txh(tx), 0), name: "Transfer", blockNumber: block, logIndex: 0, token: TOKEN, loan: LOAN, from: ZERO, to: identityAddr(holder), amount: usdc6(amount) },
    { id: eventId(txh(tx), 1), name: "PositionOpened", blockNumber: block, logIndex: 1, token: TOKEN, holder: identityAddr(holder), loan: LOAN, amount: usdc6(amount) },
  ];
}

describe("indexer projection", () => {
  let db: Awaited<ReturnType<typeof freshMigratedDb>>;
  let sql: Sql;

  beforeEach(async () => {
    db = await freshMigratedDb("pcl_proj");
    sql = db.sql;
    // seed the FK targets the projection writes against.
    await sql`insert into identities (addr, verified) values (${HOLDER}, true), (${HOLDER2}, true)`;
    await sql`insert into properties (id, address_label, appraised_value, lien_position) values ('1', 'x', 1, 1)`;
    await sql`insert into loans (id, principal, rate_bps, status, started_at, collateral_type, property_id, ltv_bps, dscr_bps) values ('1', 0, 1, 'PERFORMING', 0, 'CRE', '1', 6500, 14000)`;
    await sql`insert into reserve (id, balance, updated_at) values (1, 1000000, 0)`;
  });

  afterEach(async () => {
    await db.dispose();
  });

  test("mint produces exactly 1 position with correct principal and accrued=0", async () => {
    for (const ev of mintEvents(HOLDER, 100_000n, 5n, 1)) await ingestEvent(sql, ev);
    const rows = await sql<{ holder: string; principal: bigint; accrued: bigint; opened_at: bigint }[]>`
      select holder, principal, accrued, opened_at from positions
    `;
    expect(rows.length).toBe(1);
    expect(rows[0]?.principal).toBe(100_000n);
    expect(rows[0]?.accrued).toBe(0n);
    expect(rows[0]?.opened_at).toBe(5n); // opened_at is a bigint column
  });

  test("re-delivered EventId mutates nothing (idempotency)", async () => {
    const evs = mintEvents(HOLDER, 100_000n, 5n, 1);
    for (const ev of evs) await ingestEvent(sql, ev);
    const reserveBefore = (await sql<{ balance: bigint }[]>`select balance from reserve where id=1`)[0]?.balance;

    // replay the SAME events: every ingest must report duplicate, 0 mutation.
    for (const ev of evs) {
      const res = await ingestEvent(sql, ev);
      expect(res.status).toBe("duplicate");
    }
    const count = (await sql<{ count: bigint }[]>`select count(*)::bigint as count from positions`)[0]?.count;
    const reserveAfter = (await sql<{ balance: bigint }[]>`select balance from reserve where id=1`)[0]?.balance;
    expect(count).toBe(1n);
    expect((await sql<{ principal: bigint }[]>`select principal from positions`)[0]?.principal).toBe(100_000n);
    expect(reserveAfter).toBe(reserveBefore);
  });

  test("InterestClaimed debits the reserve and resets accrued", async () => {
    for (const ev of mintEvents(HOLDER, 100_000n, 5n, 1)) await ingestEvent(sql, ev);
    // simulate accrued sitting on the position, then a claim.
    await sql`update positions set accrued = 4242 where holder = ${HOLDER}`;
    await ingestEvent(sql, { id: eventId(txh(2), 0), name: "InterestClaimed", blockNumber: 6n, logIndex: 0, token: TOKEN, holder: HOLDER, loan: LOAN, amount: usdc6(4242n) });
    const balance = (await sql<{ balance: bigint }[]>`select balance from reserve where id=1`)[0]?.balance;
    expect(balance).toBe(1_000_000n - 4242n);
    expect((await sql<{ accrued: bigint }[]>`select accrued from positions where holder=${HOLDER}`)[0]?.accrued).toBe(0n);
  });

  test("Transfer moves principal between holders", async () => {
    for (const ev of mintEvents(HOLDER, 100_000n, 5n, 1)) await ingestEvent(sql, ev);
    await ingestEvent(sql, { id: eventId(txh(3), 0), name: "Transfer", blockNumber: 7n, logIndex: 0, token: TOKEN, loan: LOAN, from: HOLDER, to: HOLDER2, amount: usdc6(30_000n) });
    const rows = await sql<{ holder: string; principal: bigint }[]>`select holder, principal from positions order by holder`;
    const byHolder = Object.fromEntries(rows.map((r) => [r.holder, r.principal]));
    expect(byHolder[HOLDER]).toBe(70_000n);
    expect(byHolder[HOLDER2]).toBe(30_000n);
  });

  // #47 KYC: ClaimsUpdated upserts the identities read model AND lands in the activity log.
  test("ClaimsUpdated upserts identities and lands in the event log", async () => {
    const NEWBIE = identityAddr("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc"); // unseeded
    const REGISTRY = identityAddr("0x5fbdb2315678afecb367f032d93f642f64180aa3");
    await ingestEvent(sql, {
      id: eventId(txh(9), 0), name: "ClaimsUpdated", blockNumber: 8n, logIndex: 0, token: REGISTRY,
      account: NEWBIE, verified: true,
    });
    const row = (await sql<{ verified: boolean }[]>`
      select verified from identities where addr = ${NEWBIE}`)[0];
    expect(row).toEqual({ verified: true });
    // it lands in chain_events (the activity-feed source) with booleans intact.
    const ev = (await sql<{ name: string; payload: Record<string, unknown> }[]>`
      select name, payload from chain_events where name = 'ClaimsUpdated'`)[0];
    expect(ev?.name).toBe("ClaimsUpdated");
    expect(ev?.payload["verified"]).toBe(true);

    // a later verdict (un-verify) updates the same row.
    await ingestEvent(sql, {
      id: eventId(txh(10), 0), name: "ClaimsUpdated", blockNumber: 9n, logIndex: 0, token: REGISTRY,
      account: NEWBIE, verified: false,
    });
    expect((await sql<{ verified: boolean }[]>`select verified from identities where addr = ${NEWBIE}`)[0]?.verified).toBe(false);
  });
});
