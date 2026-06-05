// #38 waterfall engine tests — pin the worked example (good year / bad year) and the invariants.
import { describe, expect, it } from "vitest";
import { runWaterfall, DEMO_POOL } from "./waterfall.ts";

describe("runWaterfall — good year", () => {
  const r = runWaterfall(DEMO_POOL, 90_000, 0);
  it("pays senior then mezz coupons in full, junior keeps the residual", () => {
    const [sr, mz, jr] = r.tranches;
    expect(sr!.couponPaid).toBe(48_000); // 800k @6%
    expect(mz!.couponPaid).toBe(15_000); // 150k @10%
    expect(jr!.residual).toBe(27_000); // 90k - 48k - 15k
    expect(jr!.cashToTranche).toBe(27_000);
  });
  it("no principal is lost and no coupon goes unpaid", () => {
    expect(r.unpaidCoupon).toBe(0);
    expect(r.tranches.every((t) => t.lossAbsorbed === 0)).toBe(true);
  });
  it("the equity tranche earns the fat residual yield", () => {
    expect(r.tranches[2]!.yieldOnPrincipal).toBeCloseTo(27_000 / 50_000, 5); // 54%
  });
});

describe("runWaterfall — bad year (losses fill bottom-up)", () => {
  const r = runWaterfall(DEMO_POOL, 50_000, 100_000);
  it("wipes the junior first, then eats into mezz, senior untouched", () => {
    const [sr, mz, jr] = r.tranches;
    expect(jr!.principalAfterLoss).toBe(0); // $50k junior wiped
    expect(mz!.principalAfterLoss).toBe(100_000); // $150k - $50k
    expect(sr!.principalAfterLoss).toBe(800_000); // senior protected
  });
  it("coupons are computed on surviving principal", () => {
    const [sr, mz] = r.tranches;
    expect(sr!.couponDue).toBe(48_000); // unchanged
    expect(mz!.couponDue).toBe(10_000); // 100k surviving @10%
  });
});

describe("runWaterfall — invariants", () => {
  it("an income shortfall leaves coupons unpaid, never negative cash", () => {
    const r = runWaterfall(DEMO_POOL, 30_000, 0);
    expect(r.tranches[0]!.couponPaid).toBe(30_000); // senior takes all available
    expect(r.tranches[1]!.couponPaid).toBe(0);
    expect(r.unpaidCoupon).toBe(33_000); // (48k+15k) - 30k
    expect(r.tranches.every((t) => t.cashToTranche >= 0)).toBe(true);
  });
  it("a catastrophic loss wipes every tranche, never below zero", () => {
    const r = runWaterfall(DEMO_POOL, 0, 5_000_000);
    expect(r.tranches.every((t) => t.principalAfterLoss === 0)).toBe(true);
  });
});
