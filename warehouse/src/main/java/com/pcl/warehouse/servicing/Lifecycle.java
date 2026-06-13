package com.pcl.warehouse.servicing;

import java.util.Optional;

// #80 the per-loan servicing lifecycle for the tokenized subset. A loan only emits events valid for
// its current state — no payment on a delinquent loan, nothing after payoff — so the feed that drives
// the reserve is coherent (the untokenized 9,993 stay stateless cosmetic noise). A Java 21 exhaustive
// switch: the compiler enforces every (state, event) pair is handled.
public enum Lifecycle {
    PERFORMING,
    DELINQUENT,
    PAID_OFF;

    // the resulting state for an event, or empty if the event is invalid in this state.
    public Optional<Lifecycle> on(ServicingKind kind) {
        return switch (this) {
            case PERFORMING -> switch (kind) {
                case PAYMENT_POSTED, NAV_MARK, ESCROW_DRAW -> Optional.of(PERFORMING);
                case DELINQUENCY_FLIP -> Optional.of(DELINQUENT);
                case PAYOFF -> Optional.of(PAID_OFF);
            };
            case DELINQUENT -> switch (kind) {
                case PAYMENT_POSTED -> Optional.of(PERFORMING); // a cure
                case NAV_MARK -> Optional.of(DELINQUENT);
                case ESCROW_DRAW, DELINQUENCY_FLIP, PAYOFF -> Optional.empty();
            };
            case PAID_OFF -> Optional.empty(); // terminal
        };
    }
}
