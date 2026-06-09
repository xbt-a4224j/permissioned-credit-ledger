// Viem public client for the indexer · #16
// makeChainClient returns a read-only viem PublicClient over http. The same indexer runs
// against a LOCAL anvil node (chainId 31337, deterministic CI/tests) and Avalanche Fuji
// (43113, the live demo) via an rpcUrl swap — correctness is only ever asserted against the
// local node (the Fuji-flakiness landmine), so this client retries are kept simple.
import { createPublicClient, http, defineChain, type PublicClient } from "viem";

// #16 the local anvil chain the deploy script (#12) and verify gate target on port 18545.
export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:18545"] } },
});

// #16 Avalanche Fuji C-Chain (live-demo target only; never asserted against in tests).
export const avalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.avax-test.network/ext/bc/C/rpc"] } },
});

// #16 pick the chain by id; default to the local anvil chain for tests/CI.
export function makeChainClient(rpcUrl: string, chainId = 31337): PublicClient {
  const chain = chainId === 43113 ? avalancheFuji : anvilLocal;
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { retryCount: 3, retryDelay: 200 }),
  }) as PublicClient;
}
