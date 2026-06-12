package com.pcl.warehouse.book;

import java.math.BigDecimal;

// #54 a wh_book row in the shape the scorer + endpoints need. termMonths is derived from the
// origination/maturity span at read time. principal is in dollars (the generator + mirror normalize).
public record Loan(
    String loanId,
    BigDecimal principal,
    int ltvBps,
    int dscrBps,
    int couponBps,
    int termMonths,
    String state,
    String propertyType,
    String originator,
    boolean tokenized) {}
