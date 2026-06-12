package com.pcl.warehouse.book;

import com.pcl.warehouse.score.LoanScore;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
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
