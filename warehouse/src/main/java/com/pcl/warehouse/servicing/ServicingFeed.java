package com.pcl.warehouse.servicing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// #60-#62/#80 the live servicing feed. Every ~2s a batch of random events is synthesized across the
// whole book (#60-#62, cosmetic noise), persisted, broadcast over SSE, and folded into KPIs. THEN
// (#80) the tokenized subset is serviced coherently via a per-loan state machine — those events are
// flagged tokenized and a tokenized PAYMENT credits the investor slice into the reserve, UNLESS the
// engine is halted (collections aren't recognized while reconciliation is halted, so a deliberate
// halt persists). The tokenized heartbeat guarantees the reserve moves every tick (the ~7 tokenized
// loans are a needle in the 10k haystack; servicing them explicitly makes the loop visible).
@Service
public class ServicingFeed {

    private static final Logger log = LoggerFactory.getLogger(ServicingFeed.class);

    // #80 investor share of the coupon (the rest is originator/servicer/platform spread). Matches the
    // web INVESTOR_SHARE_BPS. A payment in dollars credits (amount * 1e6 * share/10000) base units.
    private static final long INVESTOR_SHARE_BPS = 8_000;
    private static final BigDecimal SLICE_PER_DOLLAR =
        BigDecimal.valueOf(1_000_000L).multiply(BigDecimal.valueOf(INVESTOR_SHARE_BPS)).divide(BigDecimal.valueOf(10_000L));

    private final ServicingRepository repo;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final AtomicLong seq = new AtomicLong();
    private final AtomicReference<Kpis> kpis;
    private final Random rng = new Random();
    private volatile List<String> loanIds = List.of();
    // #80 per-tokenized-loan lifecycle (the subset whose servicing is coherent + drives the reserve).
    private final Map<String, Lifecycle> lifecycle = new ConcurrentHashMap<>();

    public ServicingFeed(ServicingRepository repo) {
        this.repo = repo;
        this.kpis = new AtomicReference<>(Kpis.empty(Instant.now()));
    }

    @Scheduled(fixedDelay = 2000, initialDelay = 3000)
    void tick() {
        if (loanIds.isEmpty()) {
            loanIds = repo.loanIds();
            if (loanIds.isEmpty()) {
                return; // book not generated yet
            }
        }
        // (1) ambient noise across the whole book — cosmetic, not coherent, not reserve-affecting.
        var noise = IntStream.range(0, 3 + rng.nextInt(6)).mapToObj(i -> randomEvent()).toList();
        emit(noise);
        // (2) the tokenized subset — coherent, flagged, reserve-driving.
        serviceTokenizedSubset();
    }

    // #80 service every tokenized loan once per tick per its lifecycle (no payment on a delinquent
    // loan, etc.), then credit the investor slice of the tokenized payments into the reserve — unless
    // the engine is halted, in which case crediting pauses so a deliberate halt doesn't self-heal.
    private void serviceTokenizedSubset() {
        if (!repo.tsLedgerPresent()) {
            return; // no TS ledger tables (e.g. the warehouse's standalone CI job) — skip cleanly
        }
        var tokenized = repo.tokenizedLoanIds();
        if (tokenized.isEmpty()) {
            return;
        }
        var events = new ArrayList<ServicingEvent>();
        var credits = new ArrayList<LoanCredit>();
        for (var loanId : tokenized) {
            var state = lifecycle.computeIfAbsent(loanId, k -> Lifecycle.PERFORMING);
            var kind = tokenizedKind(state);
            var next = state.on(kind);
            if (next.isEmpty()) {
                continue; // event invalid in this state — skip it
            }
            lifecycle.put(loanId, next.get());
            var amount = amountFor(kind);
            events.add(new ServicingEvent(seq.incrementAndGet(), loanId, kind, amount, Instant.now(), true));
            if (kind == ServicingKind.PAYMENT_POSTED && amount != null) {
                var slice = amount.multiply(SLICE_PER_DOLLAR);
                if (slice.signum() > 0) {
                    credits.add(new LoanCredit(loanId, slice));
                }
            }
        }
        if (events.isEmpty()) {
            return;
        }
        emit(events);
        // #80 while halted, collections aren't recognized into the distributable pool (a deliberate halt
        // persists). #82 otherwise each paying loan's investor slice is one attributed reserve_ledger credit.
        if (!credits.isEmpty()) {
            if (repo.isHalted()) {
                log.debug("#80 engine halted — pausing reserve credit ({} entries)", credits.size());
            } else {
                for (var c : credits) {
                    repo.creditReserve(c.loanId(), c.slice());
                }
            }
        }
    }

    // #82 a per-loan investor-slice credit queued during a tick, applied to the reserve ledger after emit.
    private record LoanCredit(String loanId, BigDecimal slice) {}

    // #80 valid next event for a tokenized loan in a given state. Tokenized loans stay healthy and
    // paying (the reserve needs the cash flow); a small chance of a delinquency that cures next tick
    // exercises the state machine. They never pay off (that would silence the loop).
    private ServicingKind tokenizedKind(Lifecycle state) {
        if (state == Lifecycle.DELINQUENT) {
            return rng.nextInt(100) < 70 ? ServicingKind.PAYMENT_POSTED : ServicingKind.NAV_MARK;
        }
        int r = rng.nextInt(100);
        if (r < 80) return ServicingKind.PAYMENT_POSTED;
        if (r < 93) return ServicingKind.NAV_MARK;
        return ServicingKind.DELINQUENCY_FLIP;
    }

    private BigDecimal amountFor(ServicingKind kind) {
        return switch (kind) {
            case PAYMENT_POSTED -> randomMoney(20_000, 250_000);
            case ESCROW_DRAW -> randomMoney(5_000, 50_000);
            case PAYOFF -> randomMoney(1_000_000, 30_000_000);
            case NAV_MARK, DELINQUENCY_FLIP -> null;
        };
    }

    // persist + broadcast + fold a batch.
    private void emit(List<ServicingEvent> events) {
        repo.insert(events);
        events.forEach(this::broadcast);
        foldKpis(events);
    }

    // #61 register a subscriber; prune it on completion/timeout/error.
    public SseEmitter subscribe() {
        var emitter = new SseEmitter(0L); // no server-side timeout
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitters.add(emitter);
        return emitter;
    }

    public Kpis kpis() {
        return kpis.get();
    }

    private ServicingEvent randomEvent() {
        var loanId = loanIds.get(rng.nextInt(loanIds.size()));
        var kind = randomKind();
        return new ServicingEvent(seq.incrementAndGet(), loanId, kind, amountFor(kind), Instant.now(), false);
    }

    private ServicingKind randomKind() {
        int r = rng.nextInt(100);
        if (r < 62) return ServicingKind.PAYMENT_POSTED;
        if (r < 78) return ServicingKind.NAV_MARK;
        if (r < 90) return ServicingKind.ESCROW_DRAW;
        if (r < 97) return ServicingKind.DELINQUENCY_FLIP;
        return ServicingKind.PAYOFF;
    }

    private BigDecimal randomMoney(int lo, int hi) {
        return BigDecimal.valueOf(lo + rng.nextInt(hi - lo));
    }

    private void broadcast(ServicingEvent event) {
        emitters.removeIf(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("servicing").data(event));
                return false;
            } catch (Exception dead) {
                return true; // client gone — drop it
            }
        });
    }

    private void foldKpis(List<ServicingEvent> batch) {
        var collected = batch.stream()
            .filter(e -> e.kind() == ServicingKind.PAYMENT_POSTED)
            .map(ServicingEvent::amount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        long delinquencies = batch.stream().filter(e -> e.kind() == ServicingKind.DELINQUENCY_FLIP).count();
        long payoffs = batch.stream().filter(e -> e.kind() == ServicingKind.PAYOFF).count();
        kpis.updateAndGet(k -> new Kpis(
            k.eventsEmitted() + batch.size(),
            k.collections().add(collected),
            k.delinquencies() + delinquencies,
            k.payoffs() + payoffs,
            k.since()));
    }
}
