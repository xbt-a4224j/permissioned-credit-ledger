package com.pcl.warehouse.score;

// #55 a loan's score: the 0-100 composite plus each feature's 0-100 contribution, so the UI can show
// exactly what informs the ranking.
public record LoanScore(
    String loanId,
    double score,
    double credit,
    double ret,
    double duration,
    double portfolio) {}
