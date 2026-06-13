// Live chain tailer — blocks + decoded events in the terminal · #16 (dev tooling)
// Tails the local node and prints one line per mined block (dim) and one colored line per
// CreditToken / IdentityRegistry event, decoded through the SAME decoder the indexer uses
// (decode.ts + the deploy manifest) — so the terminal shows exactly what the read model will
// ingest, named events and all. Display only: nothing is written anywhere.
//
//   bun run scripts/tail_chain.ts          # Ctrl-C to stop
//
// Pairs with the app: invest/claim in the UI and watch the block land and the event decode.
import { identityAddr } from "@pcl/shared";
import { decodeChainEvent, loadManifest, makeChainClient, tokenAddresses, tokenToLoanMap, type RawLog } from "../indexer/src/index.ts";

const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? "31337");

// ANSI palette (no deps): dim block lines, bold colored event lines.
const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;
const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string): string => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`;
const magenta = (s: string): string => `\x1b[35m${s}\x1b[0m`;
const blue = (s: string): string => `\x1b[34m${s}\x1b[0m`;

const short = (addr: string): string => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const usd = (v: bigint): string => `$${(Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function eventLine(evName: string, body: string): string {
  return `   ${bold(body)}  ${dim(evName)}`;
}

// one colored, human line per decoded event (mirrors the activity feed's summaries).
function describe(ev: NonNullable<ReturnType<typeof decodeChainEvent>>): string {
  switch (ev.name) {
    case "PositionOpened":
      return eventLine("PositionOpened", green(`🟢 loan #${ev.loan} · ${short(ev.holder)} invested ${usd(ev.amount)}`));
    case "Transfer": {
      const zero = identityAddr("0x0000000000000000000000000000000000000000");
      if (ev.from === zero) return eventLine("Transfer (mint)", cyan(`⬆ loan #${ev.loan} · minted ${usd(ev.amount)} → ${short(ev.to)}`));
      if (ev.to === zero) return eventLine("Transfer (burn)", cyan(`⬇ loan #${ev.loan} · burned ${usd(ev.amount)} ← ${short(ev.from)}`));
      return eventLine("Transfer", cyan(`⇄ loan #${ev.loan} · ${short(ev.from)} → ${short(ev.to)} ${usd(ev.amount)}`));
    }
    case "InterestClaimed":
      return eventLine("InterestClaimed", yellow(`💰 loan #${ev.loan} · ${short(ev.holder)} claimed ${usd(ev.amount)}`));
    case "LoanStatusChanged":
      return eventLine("LoanStatusChanged", magenta(`🔁 loan #${ev.loan} → ${ev.status}`));
    case "ClaimsUpdated":
      return eventLine("ClaimsUpdated", blue(`🪪 KYC ${short(ev.account)} → ${ev.verified ? "verified" : "unverified"}`));
  }
}

const manifest = loadManifest(CHAIN_ID);
const tokenToLoan = tokenToLoanMap(manifest);
const watched = [...tokenAddresses(manifest), manifest.identityRegistry.toLowerCase() as `0x${string}`];
const client = makeChainClient(LOCAL_RPC, CHAIN_ID);

console.log(bold(`tailing ${LOCAL_RPC} (chain ${CHAIN_ID}) — ${watched.length} contracts watched · Ctrl-C to stop`));
console.log(dim("blocks are dim · events are colored · decoded with the indexer's own decoder\n"));

// dim line per block; tx-carrying blocks get a marker so they pop in the scroll.
const unwatchBlocks = client.watchBlocks({
  includeTransactions: true,
  pollingInterval: 1_000, // match anvil's 1s block time so no block line is skipped
  onBlock: (block) => {
    const txs = block.transactions.length;
    const line = `⛏ block ${block.number}  txs:${txs}  gas:${block.gasUsed.toLocaleString("en-US")}`;
    console.log(txs > 0 ? `${dim("⛏ block")} ${bold(String(block.number))}  ${bold(`txs:${txs}`)}  ${dim(`gas:${block.gasUsed.toLocaleString("en-US")}`)}` : dim(line));
  },
});

// colored line per decoded event (same path the indexer ingests).
const unwatchLogs = client.watchEvent({
  address: watched,
  pollingInterval: 1_000,
  onLogs: (logs) => {
    for (const log of logs) {
      const ev = decodeChainEvent(log as RawLog, tokenToLoan);
      if (ev !== null) console.log(describe(ev));
    }
  },
});

const stop = (): void => {
  unwatchBlocks();
  unwatchLogs();
  console.log(dim("\nstopped."));
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
