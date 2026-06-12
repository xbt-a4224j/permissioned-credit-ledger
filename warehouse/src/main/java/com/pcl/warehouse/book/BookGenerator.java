package com.pcl.warehouse.book;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// #52 synthetic CRE book generator. On boot, if wh_book has no generated rows yet, deterministically
// synthesize ~10k realistic CRE bridge loans (the originator's full pipeline — the warehouse holds
// far more than the chain's tokenized tip) and batch-insert them. Seeded RNG => the book is
// reproducible across runs. The handful of tokenized loans are layered on separately (#53), so this
// only generates untokenized inventory. Runs before the mirror/scoring runners (@Order).
@Component
@Order(10)
public class BookGenerator implements ApplicationRunner {

    static final int BOOK_SIZE = 10_000;
    private static final long SEED = 424242L;
    private static final LocalDate ANCHOR = LocalDate.of(2026, 6, 1);

    // fictional originators — generic by construction (this is a generic POC).
    private static final String[] ORIGINATORS = {
        "Meridian Bridge Capital", "Atlas CRE Partners", "Summit Mortgage Fund",
        "Harbor Point Lending", "Crossbeam Capital"
    };
    private static final String[][] METROS = {
        {"CA", "Los Angeles"}, {"CA", "San Francisco"}, {"NY", "New York"}, {"TX", "Dallas"},
        {"TX", "Austin"}, {"FL", "Miami"}, {"IL", "Chicago"}, {"WA", "Seattle"},
        {"MA", "Boston"}, {"GA", "Atlanta"}, {"CO", "Denver"}, {"AZ", "Phoenix"}
    };
    private static final String[] PROPERTY_TYPES = {
        "Office", "Multifamily", "Retail", "Industrial", "Hospitality", "Mixed-Use", "Residential"
    };

    private final JdbcTemplate jdbc;

    public BookGenerator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        Integer generated = jdbc.queryForObject(
            "select count(*) from wh_book where tokenized = false", Integer.class);
        if (generated != null && generated >= BOOK_SIZE) {
            return; // idempotent — already generated
        }
        jdbc.batchUpdate(
            "insert into wh_book (loan_id, principal, ltv_bps, dscr_bps, coupon_bps, origination_date, "
                + "maturity_date, state, msa, property_type, originator, seasoning_months, tokenized) "
                + "values (?,?,?,?,?,?,?,?,?,?,?,?,false) on conflict (loan_id) do nothing",
            generate());
    }

    // deterministic synthesis of the full book. Distributions chosen to look like a real CRE bridge
    // tape: principal skewed to the $5-20M range, LTV 50-80%, DSCR 1.0-1.6x, coupon 8-12%, 6-36mo term.
    List<Object[]> generate() {
        Random rng = new Random(SEED);
        List<Object[]> rows = new ArrayList<>(BOOK_SIZE);
        for (int i = 1; i <= BOOK_SIZE; i++) {
            String loanId = String.format("L%05d", i);
            long principal = Math.round(1_000_000d + Math.pow(rng.nextDouble(), 2) * 49_000_000d);
            int ltvBps = 5000 + rng.nextInt(3001);   // 50-80%
            int dscrBps = 10000 + rng.nextInt(6001);  // 1.00-1.60x
            int couponBps = 800 + rng.nextInt(401);   // 8.00-12.00%
            LocalDate orig = ANCHOR.minusDays(rng.nextInt(720));  // originated within ~24 months
            LocalDate maturity = orig.plusMonths(6 + rng.nextInt(31)); // 6-36mo bridge
            int seasoning = (int) ChronoUnit.MONTHS.between(orig, ANCHOR);
            String[] metro = METROS[rng.nextInt(METROS.length)];
            String propType = PROPERTY_TYPES[rng.nextInt(PROPERTY_TYPES.length)];
            String originator = ORIGINATORS[rng.nextInt(ORIGINATORS.length)];
            rows.add(new Object[] {
                loanId, BigDecimal.valueOf(principal), ltvBps, dscrBps, couponBps,
                Date.valueOf(orig), Date.valueOf(maturity),
                metro[0], metro[0] + "-" + metro[1], propType, originator, seasoning
            });
        }
        return rows;
    }
}
