// Indexer entrypoint — backfill + live tail · #16
// Wires the whole bridge: migrate the read model, seed reference rows from the manifest,
// backfill CreditToken logs from the resume cursor to `latest` across all 6 loan tokens, then
// watch the live tail. Every log is decoded (#16 decode) and ingested idempotently (#16
// ingest) so a reorg / reconnect / restart re-projects to identical state — the precondition
// for deterministic replay (#19) and the recon gate (#18). Correctness is asserted only
// against the local anvil node (the Fuji-flakiness landmine).
import { makeSql, applyMigrations } from "@pcl/shared";
import { makeChainClient } from "./client.ts";
import { decodeChainEvent, type RawLog } from "./decode.ts";
import { ingestEvent } from "./ingest.ts";
import { getCursor, setCursor } from "./cursor.ts";
import { loadManifest, tokenAddresses, tokenToLoanMap } from "./manifest.ts";
import { seedReference, seedDemoNavBaselines } from "./seed.ts";
import type { Sql } from "@pcl/shared";
import type { PublicClient } from "viem";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/pcl";
const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? "31337");

// #16 backfill: getLogs from `fromBlock` to `toBlock` across every CreditToken, decode, and
// ingest in canonical (blockNumber, logIndex) order. Returns the count applied. Exported so
// the integration tests + the verify gate can run a bounded backfill deterministically.
export async function backfill(
  sql: Sql,
  client: PublicClient,
  tokens: `0x${string}`[],
  tokenToLoan: ReturnType<typeof tokenToLoanMap>,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<{ applied: number; scanned: number }> {
  const logs = await client.getLogs({ address: tokens, fromBlock, toBlock });
  // canonical order so projection is order-stable even within a backfill window.
  const ordered = [...logs].sort((a, b) => {
    const bn = (a.blockNumber ?? 0n) - (b.blockNumber ?? 0n);
    if (bn !== 0n) return bn < 0n ? -1 : 1;
    return (a.logIndex ?? 0) - (b.logIndex ?? 0);
  });
  let applied = 0;
  for (const log of ordered) {
    const ev = decodeChainEvent(log as RawLog, tokenToLoan);
    if (ev === null) continue;
    const res = await ingestEvent(sql, ev);
    if (res.status === "applied") applied++;
  }
  await setCursor(sql, toBlock);
  return { applied, scanned: ordered.length };
}

// #16 boot: migrate + seed + backfill, then watch the live tail.
async function main(): Promise<void> {
  const sql = makeSql(DATABASE_URL);
  await applyMigrations(sql);

  const manifest = loadManifest(CHAIN_ID);
  await seedReference(sql, manifest);
  // #17 demo-world only: a par NAV baseline per loan so the +40% spike has something to jump from
  // (the matrix/golden seed their own NAV deterministically and must not inherit this).
  await seedDemoNavBaselines(sql, manifest);

  const client = makeChainClient(LOCAL_RPC, CHAIN_ID);
  const tokens = tokenAddresses(manifest);
  const tokenToLoan = tokenToLoanMap(manifest);
  // #47 also watch the IdentityRegistry so ClaimsUpdated (KYC) logs are backfilled + tailed and
  // projected into `identities` + the activity feed. Registry logs carry no loan; decode handles that.
  const watched = [...tokens, manifest.identityRegistry.toLowerCase() as `0x${string}`];

  const from = await getCursor(sql);
  const latest = await client.getBlockNumber();
  const { applied, scanned } = await backfill(sql, client, watched, tokenToLoan, from, latest);
  console.log(`[indexer] backfill ${from}->${latest}: scanned ${scanned} logs, applied ${applied} events`);

  // #16 live tail: re-decode + idempotently ingest each new log; advance the cursor.
  const unwatch = client.watchEvent({
    address: watched,
    onLogs: async (logs) => {
      for (const log of logs) {
        const ev = decodeChainEvent(log as RawLog, tokenToLoan);
        if (ev === null) continue;
        await ingestEvent(sql, ev);
        if (log.blockNumber !== null) await setCursor(sql, log.blockNumber);
      }
    },
  });

  // #16 graceful shutdown so the cursor + connections close cleanly.
  const shutdown = async (): Promise<void> => {
    unwatch();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  console.log("[indexer] watching live tail (Ctrl-C to stop)");
}

// #16 only run the loop when executed directly (tests import backfill/ingest, not main).
if (import.meta.main) {
  main().catch((err) => {
    console.error("[indexer] fatal:", err);
    process.exit(1);
  });
}
