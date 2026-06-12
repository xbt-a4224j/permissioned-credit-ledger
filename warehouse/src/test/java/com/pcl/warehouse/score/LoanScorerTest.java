package com.pcl.warehouse.score;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pcl.warehouse.book.Loan;
import java.math.BigDecimal;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

// #59 the scoring engine, tested as pure logic (no Spring context, no DB): normalization boundaries,
// composite math, weight-driven reordering, portfolio-fit relativity, and determinism.
class LoanScorerTest {

    private static final ScoreWeights WEIGHTS = new ScoreWeights(0.35, 0.25, 0.20, 0.20);
    private final LoanScorer scorer = new LoanScorer(WEIGHTS);
    private static final Concentration NO_TOKENS = Concentration.of(List.of());

    private static Loan loan(int ltv, int dscr, int coupon, int term, String state, String type, String orig) {
        return new Loan("X", BigDecimal.TEN, ltv, dscr, coupon, term, state, type, orig, false);
    }

    @Test
    void bestCaseFeaturesScoreOneHundred() {
        var s = scorer.score(loan(5000, 16000, 1200, 6, "CA", "Office", "O"), NO_TOKENS);
        assertEquals(100.0, s.credit(), 0.01);   // LTV 50% + DSCR 1.6x -> both 100
        assertEquals(100.0, s.ret(), 0.01);       // coupon 12%
        assertEquals(100.0, s.duration(), 0.01);  // 6mo term
        assertEquals(100.0, s.portfolio(), 0.01); // nothing tokenized -> no concentration penalty
        assertEquals(100.0, s.score(), 0.01);
    }

    @Test
    void worstCreditReturnDurationScoreZero() {
        var s = scorer.score(loan(8000, 10000, 800, 36, "CA", "Office", "O"), NO_TOKENS);
        assertEquals(0.0, s.credit(), 0.01);
        assertEquals(0.0, s.ret(), 0.01);
        assertEquals(0.0, s.duration(), 0.01);
        assertEquals(100.0, s.portfolio(), 0.01); // empty tokenized set -> fit stays max
        // composite = (0.35*0 + 0.25*0 + 0.20*0 + 0.20*100) / 1.0 = 20
        assertEquals(20.0, s.score(), 0.01);
    }

    @Test
    void valuesOutsideTheBandClampNotOverflow() {
        var s = scorer.score(loan(4000, 18000, 1500, 3, "CA", "Office", "O"), NO_TOKENS);
        assertEquals(100.0, s.credit(), 0.01);  // LTV 40% and DSCR 1.8x both past the top of the band
        assertEquals(100.0, s.ret(), 0.01);
        assertEquals(100.0, s.duration(), 0.01);
    }

    @Test
    void weightsDriveTheRanking() {
        var returnHeavy = loan(7000, 12000, 1200, 24, "CA", "Office", "O");  // great coupon, mediocre credit
        var creditHeavy = loan(5000, 16000, 850, 24, "CA", "Office", "O");   // pristine credit, weak coupon

        var creditWeighted = new LoanScorer(new ScoreWeights(0.70, 0.10, 0.10, 0.10));
        var returnWeighted = new LoanScorer(new ScoreWeights(0.10, 0.70, 0.10, 0.10));

        assertTrue(creditWeighted.score(creditHeavy, NO_TOKENS).score()
            > creditWeighted.score(returnHeavy, NO_TOKENS).score(),
            "credit-weighted should rank the pristine-credit loan first");
        assertTrue(returnWeighted.score(returnHeavy, NO_TOKENS).score()
            > returnWeighted.score(creditHeavy, NO_TOKENS).score(),
            "return-weighted should rank the high-coupon loan first");
    }

    @Test
    void portfolioFitIsRelativeToTheTokenizedSet() {
        // a tokenized set entirely in CA / Office / originator O.
        var tokenized = Concentration.of(List.of(
            loan(6000, 13000, 1000, 18, "CA", "Office", "O"),
            loan(6000, 13000, 1000, 18, "CA", "Office", "O")));

        var sameBucket = scorer.score(loan(6000, 13000, 1000, 18, "CA", "Office", "O"), tokenized);
        var diversifying = scorer.score(loan(6000, 13000, 1000, 18, "TX", "Retail", "Z"), tokenized);

        assertTrue(diversifying.portfolio() > sameBucket.portfolio(),
            "a loan that diversifies the tokenized book should score higher on portfolio fit");
        assertEquals(0.0, sameBucket.portfolio(), 0.01);     // fully concentrated bucket -> penalty 1
        assertEquals(100.0, diversifying.portfolio(), 0.01); // untouched buckets -> no penalty
    }

    @Test
    void scoringIsDeterministic() {
        var rng = new Random(7);
        for (int i = 0; i < 500; i++) {
            var l = loan(5000 + rng.nextInt(3001), 10000 + rng.nextInt(6001),
                800 + rng.nextInt(401), 6 + rng.nextInt(31), "CA", "Office", "O");
            assertEquals(scorer.score(l, NO_TOKENS).score(), scorer.score(l, NO_TOKENS).score(),
                "same loan + weights -> identical score");
        }
    }
}
