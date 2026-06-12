package com.pcl.warehouse.web.dto;

import com.pcl.warehouse.score.ScoreWeights;
import java.util.List;

// #57 the ranked-book response: the weights (shown once so the ranking is auditable), the total row
// count for paging, and this page of ranked loans.
public record RankedBook(ScoreWeights weights, int total, List<RankedLoan> loans) {}
