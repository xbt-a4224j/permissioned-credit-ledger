package com.pcl.warehouse.book;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// #53 mirror the on-chain tokenized loans into wh_book as the tokenized tip. The warehouse holds the
// whole book (#52); the chain holds the handful that have been tokenized. We read those from the
// TS-owned `loans` table (same Postgres instance) and upsert them flagged tokenized=true, so the
// Origination tab can show "full book vs tokenized". The warehouse KNOWS about the tip; it does not
// own it — link key = loan_id. Defensive: if the TS stack hasn't seeded `loans` yet, skip quietly.
@Component
@Order(20)
public class TokenizedMirror implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(TokenizedMirror.class);
    private static final LocalDate ANCHOR = LocalDate.of(2026, 6, 1);

    // deterministic placeholder geo for the seeded tip (the TS loans table has no geo columns).
    private static final String[][] METROS = {
        {"CA", "Los Angeles"}, {"NY", "New York"}, {"TX", "Dallas"},
        {"FL", "Miami"}, {"IL", "Chicago"}, {"WA", "Seattle"}
    };

    private final JdbcTemplate jdbc;

    public TokenizedMirror(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        Integer hasLoans = jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'loans'", Integer.class);
        if (hasLoans == null || hasLoans == 0) {
            log.info("#53 mirror: TS `loans` table absent — skipping (will mirror once the stack seeds it)");
            return;
        }
        var loans = jdbc.queryForList(
            "select id, principal, rate_bps, ltv_bps, dscr_bps, collateral_type, started_at from loans order by id::int");
        if (loans.isEmpty()) {
            log.info("#53 mirror: `loans` is empty — skipping");
            return;
        }
        int n = 0;
        for (var l : loans) {
            String loanId = (String) l.get("id");
            // TS stores principal in 6-decimal base units (USDC e6); wh_book is in dollars (#52). Convert.
            BigDecimal principal = new BigDecimal(l.get("principal").toString()).movePointLeft(6);
            int rateBps = ((Number) l.get("rate_bps")).intValue();
            int ltvBps = ((Number) l.get("ltv_bps")).intValue();
            int dscrBps = ((Number) l.get("dscr_bps")).intValue();
            String collateral = (String) l.get("collateral_type");
            long startedAt = ((Number) l.get("started_at")).longValue();
            LocalDate orig = LocalDate.ofEpochDay(startedAt / 86_400L);
            LocalDate maturity = orig.plusMonths(18);
            int seasoning = (int) java.time.temporal.ChronoUnit.MONTHS.between(orig, ANCHOR);
            String[] metro = METROS[(Integer.parseInt(loanId) - 1) % METROS.length];
            String propType = "RESIDENTIAL".equals(collateral) ? "Residential" : "Office";

            jdbc.update(
                "insert into wh_book (loan_id, principal, ltv_bps, dscr_bps, coupon_bps, origination_date, "
                    + "maturity_date, state, msa, property_type, originator, seasoning_months, tokenized) "
                    + "values (?,?,?,?,?,?,?,?,?,?,?,?,true) "
                    + "on conflict (loan_id) do update set tokenized = true, principal = excluded.principal, "
                    + "ltv_bps = excluded.ltv_bps, dscr_bps = excluded.dscr_bps, coupon_bps = excluded.coupon_bps",
                loanId, principal, ltvBps, dscrBps, rateBps,
                Date.valueOf(orig), Date.valueOf(maturity),
                metro[0], metro[0] + "-" + metro[1], propType, "Platform (seeded)", Math.max(seasoning, 0));
            n++;
        }
        log.info("#53 mirror: {} on-chain loans flagged tokenized in wh_book", n);
    }
}
