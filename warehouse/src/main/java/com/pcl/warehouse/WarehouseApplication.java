package com.pcl.warehouse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

// #51 warehouse — the origination data-platform sidecar. Spring Boot on port 47100, sharing the
// TS stack's Postgres (it owns the wh_* tables, #74). Scores the originator's full book for
// tokenization (#54-#57); the TS layer reads the ranked book and deploys the chosen loan on-chain.
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class WarehouseApplication {

	public static void main(String[] args) {
		SpringApplication.run(WarehouseApplication.class, args);
	}

}
