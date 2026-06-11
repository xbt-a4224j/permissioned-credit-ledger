// #17 NAV gate integration coverage against a throwaway Postgres.
// Matrix row 9 (the +40% spike -> NavAnomaly + accrual frozen), the three reject branches
// (Stale / NonMonotonicTimestamp / UnknownLoan), and the happy accept path (0 halt rows).
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { bps, loanId, unixSeconds, type LoanId, type NavReading, type Sql, type UnixSeconds } from "@pcl/shared";
import { ingestNav } from "../src/nav/gate.ts";
import { isAccrualFrozen } from "../src/nav/accrualGate.ts";
import { withinBounds } from "../src/nav/bounds.ts";
import { freshMigratedDb } from "../../shared/test/db.helper.ts";

const LOAN = loanId(1);
// NOW sits just after the test readings (within the 3600s staleness window) so non-stale
// branches reach the jump/monotonic checks; the Stale test uses a deliberately old observedAt.
const NOW = unixSeconds(1_700_000_700) as UnixSeconds;

function reading(navBps: number, observedAt: number, loan: LoanId = LOAN): NavReading {
  return { loan, navBps: bps(navBps), observedAt: unixSeconds(observedAt), source: "test" };
}

describe("NAV gate", () => {
  let db: Awaited<ReturnType<typeof freshMigratedDb>>;
  let sql: Sql;

  beforeEach(async () => {
    db = await freshMigratedDb("pcl_nav");
    sql = db.sql;
    await sql`insert into properties (id, address_label, appraised_value, lien_position) values ('1', 'x', 1, 1)`;
    await sql`insert into loans (id, principal, rate_bps, status, started_at, collateral_type, property_id, ltv_bps, dscr_bps) values ('1', 1000, 850, 'PERFORMING', 0, 'CRE', '1', 6500, 14000)`;
  });

  afterEach(async () => {
    await db.dispose();
  });

  test("row 9: a +40% spike is rejected OutOfBounds, writes 1 NavAnomaly halt, freezes accrual", async () => {
    // baseline at par accepted first.
    const base = await ingestNav(sql, reading(10000, 1_700_000_000), NOW);
    expect(base.accepted).toBe(true);

    // +40% (4000 bps jump > 2000 bound).
    const spike = await ingestNav(sql, reading(14000, 1_700_000_100), NOW);
    expect(spike).toEqual({ accepted: false, state: "NavAnomaly", reason: "OutOfBounds" });

    const halts = await sql<{ count: bigint }[]>`select count(*)::bigint as count from recon_status where state = 'NavAnomaly'`;
    expect(halts[0]?.count).toBe(1n);
    expect(await isAccrualFrozen(sql, LOAN)).toBe(true);
  });

  test("#49 a corrective in-bounds mark clears the freeze (latest reading accepted)", async () => {
    await ingestNav(sql, reading(10000, 1_700_000_000), NOW); // baseline accepted
    const spike = await ingestNav(sql, reading(14000, 1_700_000_100), NOW); // +40% rejected
    expect(spike.accepted).toBe(false);
    expect(await isAccrualFrozen(sql, LOAN)).toBe(true); // frozen while the latest mark is the rejection

    // a corrective par mark (in-bounds vs the last ACCEPTED baseline) becomes the latest reading.
    const fix = await ingestNav(sql, reading(10000, 1_700_000_200), NOW);
    expect(fix.accepted).toBe(true);
    expect(await isAccrualFrozen(sql, LOAN)).toBe(false); // un-frozen — no world reset needed
  });

  test("a stale reading -> reason Stale", async () => {
    // observedAt far older than NOW - maxStalenessSec(3600).
    const res = await ingestNav(sql, reading(10000, 1_700_000_000 - 10_000), NOW);
    expect(res).toEqual({ accepted: false, state: "NavAnomaly", reason: "Stale" });
  });

  test("a non-monotonic timestamp -> reason NonMonotonicTimestamp", async () => {
    await ingestNav(sql, reading(10000, 1_700_000_500), NOW); // accepted baseline
    const res = await ingestNav(sql, reading(10100, 1_700_000_500), NOW); // same observedAt
    expect(res).toEqual({ accepted: false, state: "NavAnomaly", reason: "NonMonotonicTimestamp" });
  });

  test("an unseeded loan -> reason UnknownLoan", async () => {
    const res = await ingestNav(sql, reading(10000, 1_700_000_000, loanId(999)), NOW);
    expect(res).toEqual({ accepted: false, state: "NavAnomaly", reason: "UnknownLoan" });
  });

  test("an in-bounds, fresh, monotonic reading is accepted, writes 0 halt rows", async () => {
    await ingestNav(sql, reading(10000, 1_700_000_000), NOW);
    const res = await ingestNav(sql, reading(10500, 1_700_000_100), NOW); // +5%
    expect(res.accepted).toBe(true);

    const accepted = await sql<{ count: bigint }[]>`select count(*)::bigint as count from nav_readings where accepted = true`;
    expect(accepted[0]?.count).toBe(2n);
    const halts = await sql<{ count: bigint }[]>`select count(*)::bigint as count from recon_status where ok = false`;
    expect(halts[0]?.count).toBe(0n);
    expect(await isAccrualFrozen(sql, LOAN)).toBe(false);
  });

  test("withinBounds is pure: identical args -> identical result", () => {
    const prev = reading(10000, 1_700_000_000);
    const next = reading(14000, 1_700_000_100);
    const a = withinBounds(prev, next, NOW);
    const b = withinBounds(prev, next, NOW);
    expect(a).toEqual(b);
    expect(a).toEqual({ ok: false, state: "NavAnomaly", reason: "OutOfBounds" });
  });
});
