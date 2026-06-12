package com.pcl.warehouse.web.dto;

import java.util.List;
import java.util.Map;

// #58 book-level analytics: totals, the tokenized tip vs the whole book, average credit metrics, and
// concentration by each dimension plus an LTV distribution. Feeds the Origination tab's charts.
public record Analytics(
    long total,
    long tokenized,
    double avgLtvBps,
    double avgDscrBps,
    Map<String, Long> byState,
    Map<String, Long> byPropertyType,
    Map<String, Long> byOriginator,
    List<Bucket> ltvDistribution) {

    // a labelled count for a histogram bar (e.g. "60-65%").
    public record Bucket(String label, long count) {}
}
