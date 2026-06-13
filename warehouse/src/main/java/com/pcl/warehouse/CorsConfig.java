package com.pcl.warehouse;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// #73 allow the web app (Vite dev server on :51730) to consume the warehouse cross-origin — the
// servicing SSE ticker connects directly here. Read-only (GET), local-demo origins only; a real
// deploy would pin this to the deployed web origin.
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins("http://localhost:51730", "http://127.0.0.1:51730")
            .allowedMethods("GET");
    }
}
