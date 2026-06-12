package com.pcl.warehouse.web;

import com.pcl.warehouse.book.BookRepository;
import com.pcl.warehouse.score.ScoreWeights;
import com.pcl.warehouse.web.dto.Analytics;
import com.pcl.warehouse.web.dto.RankedBook;
import com.pcl.warehouse.web.dto.RankedLoan;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// #57/#58 the read API the Origination tab consumes. /book is the ranked, score-broken-down book;
// /analytics is the book-level concentration + distributions. No mutations here — tokenization is the
// TS layer's job (#66).
@RestController
@RequestMapping("/book")
public class BookController {

    private final BookRepository repo;
    private final ScoreWeights weights;

    public BookController(BookRepository repo, ScoreWeights weights) {
        this.repo = repo;
        this.weights = weights;
    }

    // #57 GET /book?limit=&offset=&includeTokenized= — ranked by score desc, with the weights + total.
    @GetMapping
    public RankedBook ranked(
        @RequestParam(defaultValue = "50") int limit,
        @RequestParam(defaultValue = "0") int offset,
        @RequestParam(defaultValue = "false") boolean includeTokenized) {
        int capped = Math.clamp(limit, 1, 500);
        return new RankedBook(weights, repo.count(includeTokenized),
            repo.ranked(capped, Math.max(0, offset), includeTokenized));
    }

    // #57 GET /book/{id} — one loan with its full score breakdown (404 if unknown).
    @GetMapping("/{id}")
    public ResponseEntity<RankedLoan> one(@PathVariable String id) {
        return repo.findOne(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // #58 GET /book/analytics — concentration + distributions over the whole book.
    @GetMapping("/analytics")
    public Analytics analytics() {
        return repo.analytics();
    }
}
