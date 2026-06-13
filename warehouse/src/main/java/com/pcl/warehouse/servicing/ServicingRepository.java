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

    // #80 are the TS-owned ledger tables present? They aren't in the warehouse's standalone CI job
    // (only wh_* exist there), so the tokenized servicing/reserve path is skipped cleanly when absent.
    public boolean tsLedgerPresent() {
        Long n = db.sql("select count(*) from information_schema.tables where table_name in ('loans','reserve','recon_status')")
            .query(Long.class).single();
        return n != null && n >= 3;
    }

    // #80 the on-chain tokenized loans (the TS-owned loans table) — the subset whose servicing
    // drives the reserve. Read-only across the ownership boundary.
    public List<String> tokenizedLoanIds() {
        return db.sql("select id from loans where token_address is not null order by id::int")
            .query(String.class).list();
    }

    // #80 is distribution currently halted? Reads the latest recon verdict (TS-owned). While halted,
    // the feed does NOT credit the reserve — new collections aren't recognized into the distributable
    // pool until reconciliation clears, so a deliberate halt persists (it doesn't self-heal).
    public boolean isHalted() {
        Boolean ok = db.sql("select ok from recon_status order by cycle_id desc limit 1")
            .query(Boolean.class).optional().orElse(true);
        return !ok;
    }

    // #80 credit the investor slice of a tokenized-loan payment into the reserve (base units). The
    // reserve is the investors' custodial pool that funds claims; only the investor coupon enters it.
    public void creditReserve(java.math.BigDecimal baseUnits) {
        jdbc.update("update reserve set balance = balance + ?, updated_at = extract(epoch from now())::bigint where id = 1",
            baseUnits);
    }

    public void insert(List<ServicingEvent> events) {
        jdbc.batchUpdate(
            "insert into wh_servicing_events (loan_id, kind, amount, occurred_at) values (?,?,?,?)",
            events.stream()
                .map(e -> new Object[] {e.loanId(), e.kind().name(), e.amount(), Timestamp.from(e.at())})
                .toList());
    }
}
