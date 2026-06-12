package com.pcl.warehouse.score;

import com.pcl.warehouse.book.Loan;
import org.springframework.stereotype.Service;

// #54-#56 transparent weighted scorer. Four feature scores (0-100) combined by the configured weights
// into a 0-100 composite. Pure: the same loan + same tokenized concentration + same weights always
// yields the same score (the property pinned in #59).
@Service
public class LoanScorer {

    // feature bands (the normalization domain). Outside the band clamps to 0/100.
    private static final double LTV_LO = 5_000, LTV_HI = 8_000;       // 50-80%
    private static final double DSCR_LO = 10_000, DSCR_HI = 16_000;   // 1.00-1.60x
    private static final double COUPON_LO = 800, COUPON_HI = 1_200;   // 8-12%
    private static final double TERM_LO = 6, TERM_HI = 36;            // months

    private final ScoreWeights weights;

    public LoanScorer(ScoreWeights weights) {
        this.weights = weights;
    }

    public LoanScore score(Loan loan, Concentration tokenizedConcentration) {
        double credit = creditQuality(loan);
        double ret = Normalize.ascending(loan.couponBps(), COUPON_LO, COUPON_HI);
        double duration = Normalize.descending(loan.termMonths(), TERM_LO, TERM_HI);
        double portfolio = (1.0 - tokenizedConcentration.penaltyFor(loan)) * 100.0;

        double composite = (weights.credit() * credit
            + weights.ret() * ret
            + weights.duration() * duration
            + weights.portfolio() * portfolio) / weights.total();

        return new LoanScore(loan.loanId(),
            round(composite), round(credit), round(ret), round(duration), round(portfolio));
    }

    // credit quality = mean of LTV (lower is safer) and DSCR (higher is safer).
    private static double creditQuality(Loan loan) {
        double ltv = Normalize.descending(loan.ltvBps(), LTV_LO, LTV_HI);
        double dscr = Normalize.ascending(loan.dscrBps(), DSCR_LO, DSCR_HI);
        return (ltv + dscr) / 2.0;
    }

    private static double round(double x) {
        return Math.round(x * 100.0) / 100.0;
    }
}
