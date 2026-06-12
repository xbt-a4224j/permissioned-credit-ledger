package com.pcl.warehouse.web;

import com.pcl.warehouse.servicing.Kpis;
import com.pcl.warehouse.servicing.ServicingFeed;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// #61/#62 the live servicing surface: an SSE stream of events and a snapshot of the rolling KPIs.
@RestController
@RequestMapping("/servicing")
public class ServicingController {

    private final ServicingFeed feed;

    public ServicingController(ServicingFeed feed) {
        this.feed = feed;
    }

    // #61 GET /servicing/stream — Server-Sent Events; each event is named "servicing".
    @GetMapping("/stream")
    public SseEmitter stream() {
        return feed.subscribe();
    }

    // #62 GET /servicing/kpis — collections / delinquencies / payoffs accumulated since boot.
    @GetMapping("/kpis")
    public Kpis kpis() {
        return feed.kpis();
    }
}
