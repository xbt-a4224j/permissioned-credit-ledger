package com.pcl.warehouse.web.dto;

import java.math.BigDecimal;

// #57 a loan as the ranked-book API returns it: the book columns plus the score and its per-feature
// breakdown, so the UI can render exactly what informs the ranking.
public record RankedLoan(
    String loanId,
    BigDecimal principal,
    int ltvBps,
    int dscrBps,
    int couponBps,
    int termMonths,
    String state,
    String propertyType,
    String originator,
    boolean tokenized,
    double score,
    double creditScore,
    double returnScore,
    double durationScore,
    double portfolioScore) {}
