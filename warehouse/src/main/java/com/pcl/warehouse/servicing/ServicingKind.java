package com.pcl.warehouse.servicing;

// #60 the servicing events the feed streams across the book. Payments dominate; payoffs and
// delinquency flips are rarer. NAV_MARK / DELINQUENCY_FLIP carry no cash amount.
public enum ServicingKind {
    PAYMENT_POSTED,
    NAV_MARK,
    ESCROW_DRAW,
    DELINQUENCY_FLIP,
    PAYOFF
}
