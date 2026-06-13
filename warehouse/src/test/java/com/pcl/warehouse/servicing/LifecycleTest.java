package com.pcl.warehouse.servicing;

import static com.pcl.warehouse.servicing.Lifecycle.DELINQUENT;
import static com.pcl.warehouse.servicing.Lifecycle.PAID_OFF;
import static com.pcl.warehouse.servicing.Lifecycle.PERFORMING;
import static com.pcl.warehouse.servicing.ServicingKind.DELINQUENCY_FLIP;
import static com.pcl.warehouse.servicing.ServicingKind.ESCROW_DRAW;
import static com.pcl.warehouse.servicing.ServicingKind.NAV_MARK;
import static com.pcl.warehouse.servicing.ServicingKind.PAYMENT_POSTED;
import static com.pcl.warehouse.servicing.ServicingKind.PAYOFF;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

// #80 the loan lifecycle state machine — valid transitions + invalid events rejected.
class LifecycleTest {

    @Test
    void performingTransitions() {
        assertEquals(Optional.of(PERFORMING), PERFORMING.on(PAYMENT_POSTED));
        assertEquals(Optional.of(PERFORMING), PERFORMING.on(NAV_MARK));
        assertEquals(Optional.of(PERFORMING), PERFORMING.on(ESCROW_DRAW));
        assertEquals(Optional.of(DELINQUENT), PERFORMING.on(DELINQUENCY_FLIP));
        assertEquals(Optional.of(PAID_OFF), PERFORMING.on(PAYOFF));
    }

    @Test
    void delinquentCuresOnPaymentAndRejectsTheRest() {
        assertEquals(Optional.of(PERFORMING), DELINQUENT.on(PAYMENT_POSTED)); // a cure
        assertEquals(Optional.of(DELINQUENT), DELINQUENT.on(NAV_MARK));
        assertTrue(DELINQUENT.on(ESCROW_DRAW).isEmpty());
        assertTrue(DELINQUENT.on(DELINQUENCY_FLIP).isEmpty());
        assertTrue(DELINQUENT.on(PAYOFF).isEmpty());
    }

    @Test
    void paidOffIsTerminal() {
        for (var kind : ServicingKind.values()) {
            assertTrue(PAID_OFF.on(kind).isEmpty(), "PAID_OFF must reject " + kind);
        }
    }

    @Test
    void everyStateEventPairResolvesWithoutThrowing() {
        for (var state : Lifecycle.values()) {
            for (var kind : ServicingKind.values()) {
                assertNotNull(state.on(kind), state + " on " + kind);
            }
        }
    }
}
