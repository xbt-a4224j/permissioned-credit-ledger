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

    // #58 per-property-type risk + size PROFILE — a real CRE book is NOT uniform. Each type carries a
    // characteristic ticket size, leverage (LTV), coverage (DSCR), and coupon, so the book-level
    // analytics (concentration by $, risk by segment, score distribution) actually vary and tell a
    // story: Multifamily/Industrial dominate by count and underwrite healthy; Office is fewer loans
    // but big tickets, high leverage, thin coverage, distressed coupon → outsized $ exposure and the
    // worst scores. weights sum to 100 (a cumulative roulette pick). principal $M lo..hi (skewed),
    // ltv/dscr/coupon in basis points.
    record Profile(String type, int weight, double minPrincipalM, double maxPrincipalM,
        int ltvLo, int ltvHi, int dscrLo, int dscrHi, int couponLo, int couponHi) {}

    private static final Profile[] PROFILES = {
        new Profile("Multifamily", 26, 3, 18, 5800, 7000, 1300, 1600, 800, 1000),
        new Profile("Industrial", 18, 5, 28, 5500, 6800, 1350, 1650, 800, 980),
        new Profile("Office", 16, 8, 50, 6800, 8000, 1000, 1250, 1080, 1320),
        new Profile("Retail", 15, 2, 14, 6000, 7200, 1150, 1400, 950, 1180),
        new Profile("Hospitality", 10, 6, 42, 6200, 7800, 1080, 1380, 1020, 1280),
        new Profile("Mixed-Use", 9, 3, 20, 6000, 7400, 1180, 1450, 920, 1120),
        new Profile("Residential", 6, 1, 6, 6500, 8000, 1120, 1420, 850, 1050),
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

    // one synthetic CRE bridge loan, deterministic in its index. The property type is a weighted pick,
    // and ticket size + LTV/DSCR/coupon are drawn from THAT type's profile — so the book has real
    // structure (a concentrated, distressed-office tail; a healthy multifamily/industrial core).
    static BookRow generate(int i) {
        var rng = new Random(SEED ^ i);
        var p = pickProfile(rng);
        // ticket size skewed toward the smaller end of the type's range (a few big-ticket whales).
        double principalM = p.minPrincipalM() + Math.pow(rng.nextDouble(), 1.8) * (p.maxPrincipalM() - p.minPrincipalM());
        long principal = Math.round(principalM * 1_000_000d);
        var orig = ANCHOR.minusDays(rng.nextInt(720));        // originated within ~24 months
        var maturity = orig.plusMonths(6 + rng.nextInt(31));  // 6-36mo bridge
        var metro = METROS[rng.nextInt(METROS.length)];
        return new BookRow(
            "L%05d".formatted(i),
            BigDecimal.valueOf(principal),
            p.ltvLo() + rng.nextInt(p.ltvHi() - p.ltvLo() + 1),
            p.dscrLo() + rng.nextInt(p.dscrHi() - p.dscrLo() + 1),
            p.couponLo() + rng.nextInt(p.couponHi() - p.couponLo() + 1),
            orig, maturity,
            metro[0], metro[0] + "-" + metro[1],
            p.type(),
            ORIGINATORS[rng.nextInt(ORIGINATORS.length)],
            (int) ChronoUnit.MONTHS.between(orig, ANCHOR));
    }

    // #58 weighted roulette pick over the property-type profiles (weights sum to 100).
    private static Profile pickProfile(Random rng) {
        int roll = rng.nextInt(100);
        int acc = 0;
        for (var p : PROFILES) {
            acc += p.weight();
            if (roll < acc) return p;
        }
        return PROFILES[PROFILES.length - 1];
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
