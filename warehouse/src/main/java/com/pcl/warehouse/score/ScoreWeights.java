package com.pcl.warehouse.score;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

// #55 the transparent score weights — tunable via warehouse.score.* in application.properties and
// surfaced in the API response, so "why does #1 rank above #2?" is answerable by pointing. The
// weights need not sum to 1; the composite divides by total(), so they are relative.
@ConfigurationProperties(prefix = "warehouse.score")
public record ScoreWeights(
    @DefaultValue("0.35") double credit,
    @DefaultValue("0.25") double ret,
    @DefaultValue("0.20") double duration,
    @DefaultValue("0.20") double portfolio) {

    public double total() {
        return credit + ret + duration + portfolio;
    }
}
