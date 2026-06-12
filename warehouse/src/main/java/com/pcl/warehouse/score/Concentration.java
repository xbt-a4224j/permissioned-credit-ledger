package com.pcl.warehouse.score;

import com.pcl.warehouse.book.Loan;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// #56 concentration of the already-tokenized set across each dimension — the fraction of tokenized
// loans in a given bucket (state / property type / originator). A candidate loan sitting in an
// over-represented bucket diversifies the on-chain book less, so it earns a lower portfolio-fit score.
// Recomputed from the current tokenized set, so the ranking shifts as loans get tokenized.
record Concentration(
    Map<String, Double> byState,
    Map<String, Double> byType,
    Map<String, Double> byOriginator) {

    static Concentration of(List<Loan> tokenized) {
        if (tokenized.isEmpty()) {
            return new Concentration(Map.of(), Map.of(), Map.of());
        }
        return new Concentration(
            share(tokenized, Loan::state),
            share(tokenized, Loan::propertyType),
            share(tokenized, Loan::originator));
    }

    private static Map<String, Double> share(List<Loan> loans, Function<Loan, String> dimension) {
        double n = loans.size();
        return loans.stream()
            .collect(Collectors.groupingBy(dimension, Collectors.counting()))
            .entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue() / n));
    }

    // 0..1 — how concentrated the tokenized book already is in this loan's buckets (mean across dims).
    double penaltyFor(Loan loan) {
        return (byState.getOrDefault(loan.state(), 0.0)
            + byType.getOrDefault(loan.propertyType(), 0.0)
            + byOriginator.getOrDefault(loan.originator(), 0.0)) / 3.0;
    }
}
