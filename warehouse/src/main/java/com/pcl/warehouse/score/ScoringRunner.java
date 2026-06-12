package com.pcl.warehouse.score;

import com.pcl.warehouse.book.BookRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

// #55-#56 score the whole book on boot, after generation (#52) and the tokenized mirror (#53). The
// portfolio-fit feature is relative to the current tokenized set, so scores are recomputed each boot
// (and re-runnable after a tokenize). Idempotent: the upsert overwrites prior scores.
@Component
@Order(30)
public class ScoringRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ScoringRunner.class);

    private final BookRepository repo;
    private final LoanScorer scorer;

    public ScoringRunner(BookRepository repo, LoanScorer scorer) {
        this.repo = repo;
        this.scorer = scorer;
    }

    @Override
    public void run(ApplicationArguments args) {
        var concentration = Concentration.of(repo.findTokenized());
        var scores = repo.findAll().stream()
            .map(loan -> scorer.score(loan, concentration))
            .toList();
        repo.saveScores(scores);
        log.info("#55 scored {} loans (weights credit/return/duration/portfolio relative)", scores.size());
    }
}
