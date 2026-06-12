// Indexer entrypoint — backfill + live tail · #16
// Wires the whole bridge: migrate the read model, seed reference rows from the manifest,
// backfill CreditToken logs from the resume cursor to `latest` across all 6 loan tokens, then
// watch the live tail. Every log is decoded (#16 decode) and ingested idempotently (#16
// ingest) so a reorg / reconnect / restart re-projects to identical state — the precondition
// for deterministic replay (#19) and the recon gate (#18). Correctness is asserted only
// against the local anvil node (the Fuji-flakiness landmine).
import { makeSql, applyMigrations, identityAddr, loanId } from "@pcl/shared";
import { makeChainClient } from "./client.ts";
import { decodeChainEvent, type RawLog } from "./decode.ts";
import { ingestEvent } from "./ingest.ts";
import { getCursor, setCursor } from "./cursor.ts";
import { loadManifest, tokenToLoanMap } from "./manifest.ts";
import { seedReference, seedDemoNavBaselines } from "./seed.ts";
import type { Sql, IdentityAddr, LoanId } from "@pcl/shared";
import type { PublicClient } from "viem";

// #75 the indexer's watched-token set comes from the DB (loans.token_address), not the static
// manifest — so a loan tokenized at runtime (#66) is picked up by the refresh loop without a
// restart. Returns the token address list + the decoder's token->loan map, both DB-sourced.
async function loadWatchedTokens(sql: Sql): Promise<{
  tokens: `0x${string}`[];
  tokenToLoan: ReturnType<typeof tokenToLoanMap>;
}> {
  const rows = await sql<{ id: string; token_address: string }[]>`
    select id, token_address from loans where token_address is not null
  `;
  const tokenToLoan = new Map<IdentityAddr, LoanId>();
  for (const r of rows) tokenToLoan.set(identityAddr(r.token_address), loanId(r.id));
  return { tokens: rows.map((r) => r.token_address as `0x${string}`), tokenToLoan };
}

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
  // #47 also watch the IdentityRegistry so ClaimsUpdated (KYC) logs are backfilled + tailed and
  // projected into `identities` + the activity feed. Registry logs carry no loan; decode handles that.
  const identityReg = manifest.identityRegistry.toLowerCase() as `0x${string}`;
  // #75 watched-token set + decoder map come from the DB, not the manifest.
  let { tokens, tokenToLoan } = await loadWatchedTokens(sql);
  let watched = [...tokens, identityReg];
  const seen = new Set(tokens.map((t) => t.toLowerCase()));

  const from = await getCursor(sql);
  const latest = await client.getBlockNumber();
  const { applied, scanned } = await backfill(sql, client, watched, tokenToLoan, from, latest);
  console.log(`[indexer] backfill ${from}->${latest}: scanned ${scanned} logs, applied ${applied} events`);

  // #16 live tail: re-decode + idempotently ingest each new log; advance the cursor. Re-created on
  // re-subscribe (#75) so it reads the latest `tokenToLoan` map for runtime-added tokens.
  const subscribe = (): (() => void) =>
    client.watchEvent({
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
  let unwatch = subscribe();

  // #75 pick up loans tokenized at runtime (the #66 loop): poll the DB token set; when a new token
  // appears, ingest its history idempotently (without disturbing the live-tail cursor) and
  // re-subscribe over the expanded set + refreshed decoder map.
  const refresh = setInterval((): void => {
    void (async (): Promise<void> => {
      const next = await loadWatchedTokens(sql);
      const fresh = next.tokens.filter((t) => !seen.has(t.toLowerCase()));
      if (fresh.length === 0) return;
      const tip = await client.getBlockNumber();
      const logs = await client.getLogs({ address: fresh, fromBlock: 0n, toBlock: tip });
      for (const log of [...logs].sort((a, b) =>
        (a.blockNumber ?? 0n) === (b.blockNumber ?? 0n)
          ? (a.logIndex ?? 0) - (b.logIndex ?? 0)
          : (a.blockNumber ?? 0n) < (b.blockNumber ?? 0n) ? -1 : 1)) {
        const ev = decodeChainEvent(log as RawLog, next.tokenToLoan);
        if (ev !== null) await ingestEvent(sql, ev);
      }
      tokens = next.tokens;
      tokenToLoan = next.tokenToLoan;
      watched = [...tokens, identityReg];
      fresh.forEach((t) => seen.add(t.toLowerCase()));
      unwatch();
      unwatch = subscribe();
      console.log(`[indexer] #75 now watching ${fresh.length} runtime token(s) (${watched.length} total)`);
    })();
  }, 3000);

  // #16 graceful shutdown so the cursor + connections close cleanly.
  const shutdown = async (): Promise<void> => {
    clearInterval(refresh);
    unwatch();
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  console.log("[indexer] watching live tail + #75 runtime-token refresh (Ctrl-C to stop)");
}

// #16 only run the loop when executed directly (tests import backfill/ingest, not main).
if (import.meta.main) {
  main().catch((err) => {
    console.error("[indexer] fatal:", err);
    process.exit(1);
  });
}
