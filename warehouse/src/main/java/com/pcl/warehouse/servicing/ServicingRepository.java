package com.pcl.warehouse.servicing;

import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

// #60 persistence for the servicing feed: the loan-id universe to draw events from, and a batch
// insert into wh_servicing_events.
@Repository
public class ServicingRepository {

    private final JdbcClient db;
    private final JdbcTemplate jdbc;

    public ServicingRepository(JdbcClient db, JdbcTemplate jdbc) {
        this.db = db;
        this.jdbc = jdbc;
    }

    public List<String> loanIds() {
        return db.sql("select loan_id from wh_book").query(String.class).list();
    }

    public void insert(List<ServicingEvent> events) {
        jdbc.batchUpdate(
            "insert into wh_servicing_events (loan_id, kind, amount, occurred_at) values (?,?,?,?)",
            events.stream()
                .map(e -> new Object[] {e.loanId(), e.kind().name(), e.amount(), Timestamp.from(e.at())})
                .toList());
    }
}
