// Indexer barrel · #16
// The viem CreditToken indexer: decode -> idempotent ingest -> read-model projection. Public
// surface for tests, the verify gate, and the dev script (#31).
export { makeChainClient, anvilLocal, avalancheFuji } from "./client.ts";
export { decodeChainEvent, type RawLog } from "./decode.ts";
export { ingestEvent, type IngestResult } from "./ingest.ts";
export { applyPositionOpened, applyTransfer, applyInterestClaimed, applyLoanStatusChanged, project } from "./project.ts";
export { getCursor, setCursor } from "./cursor.ts";
export { loadManifest, tokenToLoanMap, tokenAddresses, type Manifest, type ManifestLoan } from "./manifest.ts";
export { seedReference, SEEDED_IDENTITIES } from "./seed.ts";
export { backfill } from "./main.ts";
