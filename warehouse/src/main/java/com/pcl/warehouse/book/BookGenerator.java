package com.pcl.warehouse.book;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Random;
import java.util.stream.IntStream;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// #52 synthetic CRE book generator. On boot, if wh_book has no generated rows yet, deterministically
// synthesize ~10k realistic CRE bridge loans (the originator's full pipeline — the warehouse holds
// far more than the chain's tokenized tip) and batch-insert them. Each loan is seeded from its own
// index (SEED ^ i), so generation is pure and independent per element: reproducible AND safely
// parallelizable, with no shared mutable RNG. The tokenized loans are layered on separately (#53).
@Component
@Order(10)
public class BookGenerator implements ApplicationRunner {

    static final int BOOK_SIZE = 10_000;
    private static final long SEED = 424_242L;
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

    private static final String INSERT = """
        insert into wh_book (loan_id, principal, ltv_bps, dscr_bps, coupon_bps, origination_date,
            maturity_date, state, msa, property_type, originator, seasoning_months, tokenized)
        values (?,?,?,?,?,?,?,?,?,?,?,?,false) on conflict (loan_id) do nothing
        """;

    private final JdbcTemplate jdbc;

    public BookGenerator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        var generated = jdbc.queryForObject(
            "select count(*) from wh_book where tokenized = false", Integer.class);
        if (generated != null && generated >= BOOK_SIZE) {
            return; // idempotent — already generated
        }
        var rows = IntStream.rangeClosed(1, BOOK_SIZE)
            .mapToObj(BookGenerator::generate)
            .map(BookGenerator::toArgs)
            .toList();
        jdbc.batchUpdate(INSERT, rows);
    }

    // one synthetic CRE bridge loan, deterministic in its index. Distributions chosen to look like a
    // real tape: principal skewed to the $5-20M range, LTV 50-80%, DSCR 1.0-1.6x, coupon 8-12%.
    static BookRow generate(int i) {
        var rng = new Random(SEED ^ i);
        long principal = Math.round(1_000_000d + Math.pow(rng.nextDouble(), 2) * 49_000_000d);
        var orig = ANCHOR.minusDays(rng.nextInt(720));        // originated within ~24 months
        var maturity = orig.plusMonths(6 + rng.nextInt(31));  // 6-36mo bridge
        var metro = METROS[rng.nextInt(METROS.length)];
        return new BookRow(
            "L%05d".formatted(i),
            BigDecimal.valueOf(principal),
            5_000 + rng.nextInt(3_001),   // LTV 50-80%
            10_000 + rng.nextInt(6_001),  // DSCR 1.00-1.60x
            800 + rng.nextInt(401),       // coupon 8.00-12.00%
            orig, maturity,
            metro[0], metro[0] + "-" + metro[1],
            PROPERTY_TYPES[rng.nextInt(PROPERTY_TYPES.length)],
            ORIGINATORS[rng.nextInt(ORIGINATORS.length)],
            (int) ChronoUnit.MONTHS.between(orig, ANCHOR));
    }

    private static Object[] toArgs(BookRow r) {
        return new Object[] {
            r.loanId(), r.principal(), r.ltvBps(), r.dscrBps(), r.couponBps(),
            Date.valueOf(r.origination()), Date.valueOf(r.maturity()),
            r.state(), r.msa(), r.propertyType(), r.originator(), r.seasoningMonths()
        };
    }

    // the generated-loan shape (warehouse-internal; the REST DTO is separate, #57).
    record BookRow(String loanId, BigDecimal principal, int ltvBps, int dscrBps, int couponBps,
        LocalDate origination, LocalDate maturity, String state, String msa,
        String propertyType, String originator, int seasoningMonths) {}
}
