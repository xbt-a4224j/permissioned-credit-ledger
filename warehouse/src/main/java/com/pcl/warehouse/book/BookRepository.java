package com.pcl.warehouse.book;

import com.pcl.warehouse.score.LoanScore;
import com.pcl.warehouse.web.dto.Analytics;
import com.pcl.warehouse.web.dto.RankedLoan;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

// #57 the wh_book / wh_loan_scores data access. Reads via the fluent JdbcClient (Boot 3.2+); the
// score upsert uses JdbcTemplate batch for one round-trip over ~10k rows.
@Repository
public class BookRepository {

    private static final String SELECT_COLS =
        "select loan_id, principal, ltv_bps, dscr_bps, coupon_bps, "
            + "(maturity_date - origination_date) as term_days, state, property_type, originator, tokenized "
            + "from wh_book";

    private final JdbcClient db;
    private final JdbcTemplate jdbc;

    public BookRepository(JdbcClient db, JdbcTemplate jdbc) {
        this.db = db;
        this.jdbc = jdbc;
    }

    public List<Loan> findAll() {
        return db.sql(SELECT_COLS).query(BookRepository::mapLoan).list();
    }

    public List<Loan> findTokenized() {
        return db.sql(SELECT_COLS + " where tokenized = true").query(BookRepository::mapLoan).list();
    }

    // #55 batch upsert the recomputed scores (idempotent on loan_id).
    public void saveScores(List<LoanScore> scores) {
        jdbc.batchUpdate("""
            insert into wh_loan_scores (loan_id, score, credit_score, return_score, duration_score, portfolio_score)
            values (?,?,?,?,?,?)
            on conflict (loan_id) do update set
                score = excluded.score, credit_score = excluded.credit_score,
                return_score = excluded.return_score, duration_score = excluded.duration_score,
                portfolio_score = excluded.portfolio_score, computed_at = now()
            """,
            scores.stream()
                .map(s -> new Object[] {s.loanId(), s.score(), s.credit(), s.ret(), s.duration(), s.portfolio()})
                .toList());
    }

    private static final String RANKED_SELECT = """
        select b.loan_id, b.principal, b.ltv_bps, b.dscr_bps, b.coupon_bps,
            (b.maturity_date - b.origination_date) as term_days, b.state, b.property_type, b.originator, b.tokenized,
            s.score, s.credit_score, s.return_score, s.duration_score, s.portfolio_score
        from wh_book b join wh_loan_scores s using (loan_id)
        """;

    // #57 one page of loans ordered by score desc; untokenized only unless includeTokenized.
    public List<RankedLoan> ranked(int limit, int offset, boolean includeTokenized) {
        return db.sql(RANKED_SELECT
                + " where (:includeTokenized or b.tokenized = false) order by s.score desc, b.loan_id limit :limit offset :offset")
            .param("includeTokenized", includeTokenized)
            .param("limit", limit)
            .param("offset", offset)
            .query(BookRepository::mapRanked).list();
    }

    public int count(boolean includeTokenized) {
        return db.sql("select count(*) from wh_book where (:includeTokenized or tokenized = false)")
            .param("includeTokenized", includeTokenized)
            .query(Integer.class).single();
    }

    public Optional<RankedLoan> findOne(String loanId) {
        return db.sql(RANKED_SELECT + " where b.loan_id = :id")
            .param("id", loanId)
            .query(BookRepository::mapRanked).optional();
    }

    // #58 book-level analytics computed with streams over the loaded book (10k rows is cheap).
    public Analytics analytics() {
        var all = findAll();
        var ltvDistribution = IntStream.rangeClosed(10, 15)
            .mapToObj(step -> {
                int lo = step * 500;
                long n = all.stream().filter(l -> l.ltvBps() >= lo && l.ltvBps() < lo + 500).count();
                return new Analytics.Bucket("%d-%d%%".formatted(lo / 100, (lo + 500) / 100), n);
            })
            .toList();
        return new Analytics(
            all.size(),
            all.stream().filter(Loan::tokenized).count(),
            round(all.stream().mapToInt(Loan::ltvBps).average().orElse(0)),
            round(all.stream().mapToInt(Loan::dscrBps).average().orElse(0)),
            all.stream().collect(Collectors.groupingBy(Loan::state, Collectors.counting())),
            all.stream().collect(Collectors.groupingBy(Loan::propertyType, Collectors.counting())),
            all.stream().collect(Collectors.groupingBy(Loan::originator, Collectors.counting())),
            ltvDistribution);
    }

    private static double round(double x) {
        return Math.round(x * 100.0) / 100.0;
    }

    private static RankedLoan mapRanked(ResultSet rs, int rowNum) throws SQLException {
        return new RankedLoan(
            rs.getString("loan_id"),
            rs.getBigDecimal("principal"),
            rs.getInt("ltv_bps"),
            rs.getInt("dscr_bps"),
            rs.getInt("coupon_bps"),
            Math.max(1, rs.getInt("term_days") / 30),
            rs.getString("state"),
            rs.getString("property_type"),
            rs.getString("originator"),
            rs.getBoolean("tokenized"),
            rs.getDouble("score"),
            rs.getDouble("credit_score"),
            rs.getDouble("return_score"),
            rs.getDouble("duration_score"),
            rs.getDouble("portfolio_score"));
    }

    private static Loan mapLoan(ResultSet rs, int rowNum) throws SQLException {
        return new Loan(
            rs.getString("loan_id"),
            rs.getBigDecimal("principal"),
            rs.getInt("ltv_bps"),
            rs.getInt("dscr_bps"),
            rs.getInt("coupon_bps"),
            Math.max(1, rs.getInt("term_days") / 30),
            rs.getString("state"),
            rs.getString("property_type"),
            rs.getString("originator"),
            rs.getBoolean("tokenized"));
    }
}
