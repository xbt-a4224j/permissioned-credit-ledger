package com.pcl.warehouse.web.dto;

import java.util.List;
import java.util.Map;

// #58 book-level analytics for the origination desk: totals + $ exposure, the tokenized tip vs the
// whole book, average credit metrics, concentration by dimension, $ exposure by property type, an
// LTV distribution, and a score distribution (tokenization-readiness). Feeds the Origination charts.
public record Analytics(
    long total,
    long tokenized,
    long totalPrincipalM,       // whole-book exposure, $ millions
    long tokenizedPrincipalM,   // tokenized-on-chain exposure, $ millions
    double avgLtvBps,
    double avgDscrBps,
    double avgCouponBps,
    Map<String, Long> byState,
    Map<String, Long> byPropertyType,
    Map<String, Long> byOriginator,
    Map<String, Long> exposureByType,   // $ millions by property type — where the capital sits
    List<Bucket> ltvDistribution,
    List<Bucket> scoreDistribution) {    // loan count by score band — the tokenization-ready tail

    // a labelled count for a histogram bar (e.g. "60-65%" -> n, or "Office" -> $M).
    public record Bucket(String label, long count) {}
}
