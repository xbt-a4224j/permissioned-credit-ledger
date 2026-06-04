// Money Layer · GraphQL request context — the seam wiring chain + read models · #20/#21
// One ApiContext threads the three layers into every resolver: `db` is the off-chain read
// model (Postgres, #15), `chain` is the on-chain layer (a viem public client to read + a wallet
// client to broadcast invest/transfer/claim via the single server signer, #21), and `recon`
// reads the marquee reconciliation status (#18) so the HALT gate can refuse to distribute.
// #20 declares the interface (schema builds against it); #21 implements createContext().
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { makeSql, type Sql } from "@pcl/shared";
import { anvilLocal, avalancheFuji, loadManifest, type Manifest } from "../../indexer/src/index.ts";
import { readReconStatus, type ReconReader } from "./recon-reader.ts";

// #20 the request context every resolver (#21), the SSE sources (#22) and the tx tracker (#23)
// read. Declared here so the schema layer compiles against a frozen surface before #21 fills it.
export interface ApiContext {
  db: Sql;
  chain: {
    publicClient: PublicClient;
    walletClient: WalletClient;
    account: Account;
  };
  manifest: Manifest;
  recon: ReconReader;
}

// #21 environment surface (mirrors .env.example). CHAIN=local pins the deterministic anvil node
// the verify gate + tests assert against; CHAIN=fuji is the live-demo target only.
function envConfig(): { databaseUrl: string; rpcUrl: string; chainId: number; privateKey: `0x${string}` } {
  const useFuji = (process.env.CHAIN ?? "local").toLowerCase() === "fuji";
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/pcl";
  const rpcUrl = useFuji
    ? (process.env.FUJI_RPC ?? "https://api.avax-test.network/ext/bc/C/rpc")
    : (process.env.LOCAL_RPC ?? "http://127.0.0.1:18545");
  const chainId = useFuji ? 43113 : 31337;
  // #21 anvil's well-known account 0 is the deploy/admin/issuer signer locally; a real key on Fuji.
  const privateKey = (process.env.PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;
  return { databaseUrl, rpcUrl, chainId, privateKey };
}

// #21 build the live context: a raw Postgres pool, a viem read+write client pair bound to the
// single server signer, the deploy manifest (no hardcoded addresses), and the recon reader.
export function createContext(): ApiContext {
  const { databaseUrl, rpcUrl, chainId, privateKey } = envConfig();
  const chain = chainId === 43113 ? avalancheFuji : anvilLocal;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl, { retryCount: 3, retryDelay: 200 }),
  }) as PublicClient;
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const db = makeSql(databaseUrl);
  const manifest = loadManifest(chainId);

  return {
    db,
    chain: { publicClient, walletClient, account },
    manifest,
    recon: { read: (): ReturnType<typeof readReconStatus> => readReconStatus(db) },
  };
}

// #21 the wallet `account` address (the server signer) — invest/transfer originate from here.
export function signerAddress(ctx: ApiContext): Address {
  return ctx.chain.account.address;
}
