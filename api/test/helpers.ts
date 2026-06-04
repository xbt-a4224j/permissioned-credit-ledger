// #21 API test harness — a migrated+seeded read model and a mockable ApiContext.
// Spins a throwaway Postgres (the verify-gate db on 55432), applies migrations, seeds the manifest
// reference rows + 6 canonical identities, and backfills CreditToken logs from the local anvil so
// queries see the 6 loans + the anchor position. buildContext assembles an ApiContext whose chain
// client can be a real viem client (happy path) or a stub (typed-error paths) — letting resolver
// tests assert reverts/HALT without broadcasting.
import { createWalletClient, http, type Account, type Address, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Sql } from "@pcl/shared";
import { freshMigratedDb } from "../../shared/test/db.helper.ts";
import {
  anvilLocal,
  backfill,
  loadManifest,
  makeChainClient,
  seedReference,
  tokenAddresses,
  tokenToLoanMap,
  type Manifest,
} from "../../indexer/src/index.ts";
import type { ApiContext } from "../src/context.ts";
import { readReconStatus } from "../src/recon-reader.ts";

export const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";
// anvil account 0 (the deploy admin/issuer) — the server signer locally.
const SIGNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// #21 a migrated, seeded, backfilled db handle. Returns the sql + manifest + disposer. Used by
// suites that read the on-chain-derived read model (queries/mutations against the live anvil).
export async function seededDb(prefix: string): Promise<{ sql: Sql; manifest: Manifest; dispose: () => Promise<void> }> {
  const db = await freshMigratedDb(prefix);
  const manifest = loadManifest(31337);
  await seedReference(db.sql, manifest);
  const chain = makeChainClient(LOCAL_RPC, 31337);
  const latest = await chain.getBlockNumber();
  await backfill(db.sql, chain, tokenAddresses(manifest), tokenToLoanMap(manifest), 0n, latest);
  return { sql: db.sql, manifest, dispose: db.dispose };
}

// #22/#23 a migrated + reference-seeded db with NO chain backfill — the read model's positions are
// controlled directly by the test. This isolates the SSE/tx-tracking suites from the shared anvil
// (whose state the mutation suite mutates), so they're order- and parallelism-independent.
export async function migratedDb(prefix: string): Promise<{ sql: Sql; manifest: Manifest; dispose: () => Promise<void> }> {
  const db = await freshMigratedDb(prefix);
  const manifest = loadManifest(31337);
  await seedReference(db.sql, manifest);
  return { sql: db.sql, manifest, dispose: db.dispose };
}

// #22/#23 insert a controlled canonical position row (bypassing the indexer) for read-model tests.
export async function seedPosition(
  sql: Sql,
  loanId: string,
  holder: string,
  principal: bigint,
  openedAtBlock: number,
): Promise<void> {
  await sql`
    insert into positions (id, loan_id, holder, principal, accrued, opened_at)
    values (${`${loanId}:${holder.toLowerCase()}`}, ${loanId}, ${holder.toLowerCase()}, ${principal.toString()}, 0, ${openedAtBlock})
    on conflict (id) do update set principal = ${principal.toString()}, opened_at = ${openedAtBlock}
  `;
}

// #21 the seeded canonical actors (mirrors Identities.sol / seed.ts).
export const ACCREDITED_US_1 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as Address; // verified, accredited, US
export const ACCREDITED_US_2 = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc" as Address; // verified, accredited, US
export const REG_S_NONUS_1 = "0x90f79bf6eb2c4f870365e785982e1f101e93b906" as Address; // verified, nonUS
export const UNVERIFIED = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc" as Address; // !verified
export const FROZEN = "0x976ea74026e726554db657fa54763abd0c3a0aa9" as Address; // verified, frozen

// #21 a minimal chain stub: simulate/write are user-supplied so a test can make simulate throw a
// typed revert or succeed. account is the real signer (address only matters).
export interface ChainStub {
  simulateContract: PublicClient["simulateContract"];
  writeContract: WalletClient["writeContract"];
}

// #21 assemble an ApiContext over a seeded db with a (real or stub) chain client.
export function buildContext(
  sql: Sql,
  manifest: Manifest,
  chain: { publicClient: PublicClient; walletClient: WalletClient; account?: Account },
): ApiContext {
  const account = chain.account ?? privateKeyToAccount(SIGNER_KEY);
  return {
    db: sql,
    chain: { publicClient: chain.publicClient, walletClient: chain.walletClient, account },
    manifest,
    recon: { read: () => readReconStatus(sql) },
  };
}

// #21 a real read+write viem client pair against the local anvil, signed by `key` (defaults to
// the issuer/admin server signer = anvil account 0). invest/transfer are issuer-driven; claim is
// holder-driven (msg.sender), so claim tests pass the holder's key (the UI signs claim on Fuji).
export function realChain(key: `0x${string}` = SIGNER_KEY): { publicClient: PublicClient; walletClient: WalletClient; account: Account } {
  const account = privateKeyToAccount(key);
  const publicClient = makeChainClient(LOCAL_RPC, 31337);
  const walletClient = createWalletClient({ account, chain: anvilLocal, transport: http(LOCAL_RPC) });
  return { publicClient, walletClient, account };
}

// #21 ACCREDITED_US_1's well-known anvil key (account 1) — the anchor holder; used to sign claim.
export const ACCREDITED_US_1_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
