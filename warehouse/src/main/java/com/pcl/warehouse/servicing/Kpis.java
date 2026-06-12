package com.pcl.warehouse.servicing;

import java.math.BigDecimal;
import java.time.Instant;

// #62 rolling KPIs the feed maintains as events arrive, exposed at /servicing/kpis.
public record Kpis(
    long eventsEmitted,
    BigDecimal collections,
    long delinquencies,
    long payoffs,
    Instant since) {

    static Kpis empty(Instant since) {
        return new Kpis(0, BigDecimal.ZERO, 0, 0, since);
    }
}
