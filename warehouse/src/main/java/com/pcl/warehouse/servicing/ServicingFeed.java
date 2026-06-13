package com.pcl.warehouse.servicing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Random;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// #60-#62 the live servicing feed. Every ~2s a batch of events is synthesized across the book,
// persisted (#60), broadcast to all SSE subscribers (#61), and folded into rolling KPIs (#62). The
// stream models the off-chain servicing firehose — the side the reconciliation engine reconciles
// against. Random by design (a live ticker, not a reproducible dataset).
@Service
public class ServicingFeed {

    private static final Logger log = LoggerFactory.getLogger(ServicingFeed.class);

    private final ServicingRepository repo;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final AtomicLong seq = new AtomicLong();
    private final AtomicReference<Kpis> kpis;
    private final Random rng = new Random();
    private volatile List<String> loanIds = List.of();

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
        var batch = IntStream.range(0, 3 + rng.nextInt(6))
            .mapToObj(i -> randomEvent())
            .toList();
        repo.insert(batch);
        batch.forEach(this::broadcast);
        foldKpis(batch);
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
        var amount = switch (kind) {
            case PAYMENT_POSTED -> randomMoney(20_000, 250_000);
            case ESCROW_DRAW -> randomMoney(5_000, 50_000);
            case PAYOFF -> randomMoney(1_000_000, 30_000_000);
            case NAV_MARK, DELINQUENCY_FLIP -> null;
        };
        return new ServicingEvent(seq.incrementAndGet(), loanId, kind, amount, Instant.now());
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
