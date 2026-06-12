package com.pcl.warehouse.servicing;

import java.math.BigDecimal;
import java.time.Instant;

// #60 one servicing event. seq is a monotonic in-process id (the UI's stable key); amount is null for
// non-cash kinds (NAV mark, delinquency flip).
public record ServicingEvent(long seq, String loanId, ServicingKind kind, BigDecimal amount, Instant at) {}
