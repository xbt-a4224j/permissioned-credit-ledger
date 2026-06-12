package com.pcl.warehouse.score;

// #54 feature normalizers — map a raw value onto 0-100 with the correct direction, clamped to the
// configured band. Pure and stateless.
final class Normalize {

    private Normalize() {}

    // higher raw value -> higher score (e.g. coupon, DSCR).
    static double ascending(double v, double lo, double hi) {
        return clamp01((v - lo) / (hi - lo)) * 100.0;
    }

    // lower raw value -> higher score (e.g. LTV, term).
    static double descending(double v, double lo, double hi) {
        return 100.0 - ascending(v, lo, hi);
    }

    private static double clamp01(double x) {
        return Math.max(0.0, Math.min(1.0, x));
    }
}
