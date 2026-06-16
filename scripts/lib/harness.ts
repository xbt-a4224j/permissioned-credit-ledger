// End-to-end bring-up/teardown for the matrix verifier · #27
// The verifier targets a REAL local node + REAL Postgres (never a mock chain): dev.sh (#31) /
// CI (#28) bring up anvil (18545) + Postgres (55432) and deploy the seed world; this harness then
// (a) provisions a FRESH throwaway DB per run (deterministic fixture — the property test needs a
// clean read model each pass), applies migrations (#15) + seeds reference rows (#16) + backfills
// CreditToken logs from the live node, (b) boots the real graphql-yoga API server (#21) in-process
// over that DB and a wallet client, and (c) exposes a MatrixContext whose row drivers go THROUGH
// the GraphQL HTTP surface (rows 1-5) and the NAV
// feed / reconciliation engine (rows 6-7). All
// correctness is asserted against the local node only (the Fuji-flakiness landmine).
import postgres from "postgres";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  publicActions,
  type Account,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { applyMigrations, makeSql } from "@pcl/shared";
import {
  anvilLocal,
  backfill,
  loadManifest,
  makeChainClient,
  seedReference,
  setCursor,
  tokenAddresses,
  tokenToLoanMap,
  type Manifest,
} from "../../indexer/src/index.ts";
import { createYoga } from "graphql-yoga";
import { schema } from "../../api/src/schema/index.ts";
import { formatError } from "../../api/src/errors.ts";
import type { ApiContext } from "../../api/src/context.ts";
import { readReconStatus } from "../../api/src/recon-reader.ts";
import { simulateFeed } from "../../api/src/nav/index.ts";
import { runReconCycle } from "../../api/src/recon/index.ts";
import { loanId, usdc6, type Sql as SharedSql } from "@pcl/shared";
import type { Actual } from "./scenarios.ts";

// #27 fixed local config (CLAUDE.md ports). DATABASE_URL points at the base `pcl` db; the harness
// carves a throwaway db off the same server so every run starts from a clean read model.
const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";
const ADMIN_DB_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/pcl";
const CHAIN_ID = 31337;

// #27 anvil well-known keys: account 0 is the deploy admin/issuer (the server signer; invest
// originates here). VERIFIED_1 is anvil account 1 — the anchor holder whose key
// signs claim (claim is msg.sender-driven; the UI signs it on Fuji).
const ISSUER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ANCHOR_HOLDER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

// #27 a generous off-chain collected balance so the seeded read model satisfies recon I2
// (onchainClaimable <= collected) and no SPURIOUS recon HALT gates rows 1-5. The genuine
// shortfall HALT is injected deliberately in row 7.
const RESERVE_FUNDING = 1_000_000_000_000n; // 1,000,000 USDC (6dp)

// #27 the driver surface each scenario row calls. invest/claim* go through the live GraphQL
// server; navSpike/cashMismatch drive the NAV feed + engine then read the HALT back
// through GraphQL — proving the seam, not poking internals to fake a verdict.
export interface MatrixContext {
  apiUrl: string;
  rpcUrl: string;
  manifest: Manifest;
  invest: (loanId: string, wallet: `0x${string}`, amount: string) => Promise<Actual>;
  claimFunded: (loanId: string, wallet: `0x${string}`) => Promise<Actual>;
  claimUnderfunded: (loanId: string, wallet: `0x${string}`) => Promise<Actual>;
  navSpike: (loanId: string) => Promise<Actual>;
  cashMismatch: (loanId: string, wallet: `0x${string}`) => Promise<Actual>;
}

// #27 the assembled fixture: the DB, the live server, the chain clients, and a disposer.
export interface Fixture {
  ctx: MatrixContext;
  dispose: () => Promise<void>;
}

// #27 fail loudly + early if the prerequisite stack (anvil + the seed manifest) is not up. The
// verifier expects `./scripts/dev.sh` (or CI) to have already deployed; a missing manifest or a
// dead node is a clear, actionable error rather than an opaque downstream failure.
export async function assertStackUp(): Promise<{ manifest: Manifest; chain: PublicClient }> {
  let manifest: Manifest;
  try {
    manifest = loadManifest(CHAIN_ID);
  } catch {
    throw new Error(
      `no deploy manifest for chain ${CHAIN_ID} — run ./scripts/dev.sh first (it deploys Deploy.s.sol to the local node)`,
    );
  }
  const chain = makeChainClient(LOCAL_RPC, CHAIN_ID);
  try {
    await chain.getBlockNumber();
  } catch {
    throw new Error(`local node unreachable at ${LOCAL_RPC} — run ./scripts/dev.sh first (it starts anvil on 18545)`);
  }
  return { manifest, chain };
}

// #27 carve a fresh, uniquely-named db off the admin connection (mirrors the test db.helper).
async function createThrowawayDb(): Promise<{ name: string; url: string }> {
  const name = `pcl_matrix_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = postgres(ADMIN_DB_URL, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
  const u = new URL(ADMIN_DB_URL);
  u.pathname = `/${name}`;
  return { name, url: u.toString() };
}

async function dropThrowawayDb(name: string): Promise<void> {
  const admin = postgres(ADMIN_DB_URL, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

// #27 minimal GraphQL-over-HTTP client against the booted server. Returns { data, errors } so a
// row driver can read the typed extensions.code off a revert/HALT — the SAME path a real client
// hits, so the test exercises the real error-mapping seam (not the resolver function directly).
async function gqlFetch(apiUrl: string, query: string, variables: Record<string, unknown>): Promise<{ data: unknown; errors?: { extensions?: { code?: string } }[] }> {
  const res = await fetch(`${apiUrl}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as { data: unknown; errors?: { extensions?: { code?: string } }[] };
}

// #27 the write mutations as GraphQL documents (the real client surface, #20).
const INVEST = `mutation($input: InvestInput!) { invest(input: $input) { hash state } }`;
const CLAIM = `mutation($input: ClaimInput!) { claim(input: $input) { hash state } }`;

// #27 read the reconciliation status through GraphQL (rows 6-7 assert the HALT here).
const RECON = `query { reconciliationStatus { state haltReason } }`;

// #27 turn a GraphQL response into a typed Actual. An error with a known engine-state code is a
// HALT; an error with an on-chain ReasonCode is a revert; a clean response is OK with the event.
function actualFromGql(
  resp: { errors?: { extensions?: { code?: string } }[] },
  okEvent: "PositionOpened" | "InterestClaimed",
): Actual {
  const code = resp.errors?.[0]?.extensions?.code;
  if (code === "NavAnomaly" || code === "ReconMismatch") return { kind: "halt", state: code };
  if (code === "ReceiverNotVerified" || code === "InsufficientReserve" || code === "ExceedsPrincipal") {
    return { kind: "revert", reason: code };
  }
  if (resp.errors !== undefined && resp.errors.length > 0) {
    // an untyped error means the row didn't exercise the seam it claims — surface it loudly.
    throw new Error(`unexpected untyped GraphQL error: ${JSON.stringify(resp.errors)}`);
  }
  return { kind: "ok", event: okEvent };
}

// #27 a viem test client for time warps (rows 4/5/7 need on-chain accrual to accumulate).
type TestClient = ReturnType<typeof createTestClient> & PublicClient;

// #27 wait for a broadcast tx to MINE (bounded), so a clean OK row's claimable/position effects
// are real on-chain before the row is marked pass — never a fixed sleep (the #27 landmine).
async function waitMined(chain: PublicClient, hash: `0x${string}`): Promise<"success" | "reverted"> {
  const receipt = await chain.waitForTransactionReceipt({ hash, timeout: 30_000 });
  return receipt.status;
}

// #27 build the fixture: throwaway db -> migrate -> seed -> backfill -> fund off-chain reserve ->
// boot the API server in-process on a unique port. Two API contexts back the writes: the issuer
// signer (invest) and the anchor-holder signer (claim is msg.sender-driven).
export async function setupFixture(): Promise<Fixture> {
  const { manifest, chain } = await assertStackUp();

  // --- fresh read model from the live node ---
  const dbHandle = await createThrowawayDb();
  const sql = makeSql(dbHandle.url);
  await applyMigrations(sql);
  await seedReference(sql, manifest);
  const latest = await chain.getBlockNumber();
  await backfill(sql, chain, tokenAddresses(manifest), tokenToLoanMap(manifest), 0n, latest);
  // off-chain collected cash high enough that recon I2 holds for rows 1-5 (no spurious HALT).
  await sql`update reserve set balance = ${RESERVE_FUNDING.toString()} where id = 1`;

  // --- chain clients ---
  const issuer = privateKeyToAccount(ISSUER_KEY);
  const holder = privateKeyToAccount(ANCHOR_HOLDER_KEY);
  const publicClient = createPublicClient({ chain: anvilLocal, transport: http(LOCAL_RPC) }) as PublicClient;
  const issuerWallet = createWalletClient({ account: issuer, chain: anvilLocal, transport: http(LOCAL_RPC) });
  const holderWallet = createWalletClient({ account: holder, chain: anvilLocal, transport: http(LOCAL_RPC) });
  const testClient = createTestClient({ chain: anvilLocal, mode: "anvil", transport: http(LOCAL_RPC) }).extend(
    publicActions,
  ) as unknown as TestClient;

  // --- the REAL graphql-yoga server (schema #20 + typed formatError #21), in-process ---
  // Two servers because the on-chain claim is msg.sender-driven: invest originates from
  // the issuer signer, claim from the anchor-holder signer. Each owns its OWN db pool on the same
  // throwaway db. We build a LEAN yoga (no SSE/accrual/tx-watcher loops, #22/#23) so a disposed
  // fixture leaves no background timer querying a closed pool — the verifier exercises the GraphQL
  // resolver + typed-error seam (#21), which is exactly the contract rows 1-5 assert against.
  const holderSql = makeSql(dbHandle.url);
  const issuerCtx: ApiContext = {
    db: sql,
    chain: { publicClient, walletClient: issuerWallet as WalletClient, account: issuer as Account },
    manifest,
    recon: { read: () => readReconStatus(sql) },
  };
  const holderCtx: ApiContext = {
    db: holderSql,
    chain: { publicClient, walletClient: holderWallet as WalletClient, account: holder as Account },
    manifest,
    recon: { read: () => readReconStatus(holderSql) },
  };

  // a lean yoga fetch handler for an ApiContext (real schema + the maskError code guarantee).
  const leanFetch = (apiCtx: ApiContext): ((req: Request) => Promise<Response> | Response) => {
    const yoga = createYoga<Record<string, never>, ApiContext>({
      schema,
      context: () => apiCtx,
      graphqlEndpoint: "/graphql",
      maskedErrors: { maskError: (error: unknown) => formatError(error) },
      landingPage: false,
    });
    return (req: Request) => {
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), { headers: { "content-type": "application/json" } });
      }
      return yoga.fetch(req);
    };
  };

  const issuerPort = 41991 + Math.floor(Math.random() * 1000);
  const holderPort = issuerPort + 1;
  const issuerHttp = Bun.serve({ port: issuerPort, fetch: leanFetch(issuerCtx) });
  const holderHttp = Bun.serve({ port: holderPort, fetch: leanFetch(holderCtx) });
  const issuerUrl = `http://localhost:${issuerHttp.port}`;
  const holderUrl = `http://localhost:${holderHttp.port}`;

  // snapshot the chain so this run's broadcasts + warps don't leak into a second run.
  const chainSnapshot = await testClient.snapshot();

  const ctx: MatrixContext = {
    apiUrl: issuerUrl,
    rpcUrl: LOCAL_RPC,
    manifest,
    // rows 1-3: invest = issuer mint through GraphQL. OK rows wait for the tx to mine; an
    // unverified receiver reverts ReceiverNotVerified.
    invest: async (ln, wallet, amount) => {
      const resp = await gqlFetch(issuerUrl, INVEST, { input: { loanId: ln, wallet, amount } });
      const actual = actualFromGql(resp, "PositionOpened");
      if (actual.kind === "ok") {
        const hash = (resp.data as { invest: { hash: `0x${string}` } }).invest.hash;
        const status = await waitMined(publicClient, hash);
        if (status !== "success") throw new Error(`invest row tx reverted on-chain: ${hash}`);
      }
      return actual;
    },
    // row 4: warp so the anchor accrues a little on-chain claimable, then claim (funded reserve).
    claimFunded: async (ln, wallet) => {
      await testClient.increaseTime({ seconds: 7 * 24 * 3600 });
      await testClient.mine({ blocks: 1 });
      const resp = await gqlFetch(holderUrl, CLAIM, { input: { loanId: ln, wallet } });
      const actual = actualFromGql(resp, "InterestClaimed");
      if (actual.kind === "ok") {
        const hash = (resp.data as { claim: { hash: `0x${string}` } }).claim.hash;
        const status = await waitMined(publicClient, hash);
        if (status !== "success") throw new Error(`claim row tx reverted on-chain: ${hash}`);
      }
      return actual;
    },
    // row 5: warp far enough that owed exceeds the on-chain reserve -> InsufficientReserve.
    claimUnderfunded: async (ln, wallet) => {
      const snap = await testClient.snapshot();
      try {
        await testClient.increaseTime({ seconds: 300_000 * 24 * 3600 });
        await testClient.mine({ blocks: 1 });
        const resp = await gqlFetch(holderUrl, CLAIM, { input: { loanId: ln, wallet } });
        return actualFromGql(resp, "InterestClaimed");
      } finally {
        await testClient.revert({ id: snap });
      }
    },
    // row 6: push a +40% NAV spike through the feed -> NavAnomaly HALT + accrual frozen; assert
    // the HALT back through the GraphQL reconciliationStatus surface.
    navSpike: async (ln) => {
      await simulateFeed(sql as SharedSql, loanId(ln), "row9Spike");
      const resp = await gqlFetch(issuerUrl, RECON, {});
      const status = (resp.data as { reconciliationStatus: { state: string; haltReason: string | null } }).reconciliationStatus;
      if (status.state === "HALTED" && status.haltReason === "NavAnomaly") return { kind: "halt", state: "NavAnomaly" };
      throw new Error(`row 6 expected NavAnomaly HALT, got ${JSON.stringify(status)}`);
    },
    // row 7: warp so on-chain claimable > 0, inject off-chain collected BELOW it, run a recon
    // cycle -> ReconMismatch (I2). Assert the HALT through GraphQL AND that a gated claim refuses.
    cashMismatch: async (ln, wallet) => {
      await testClient.increaseTime({ seconds: 30 * 24 * 3600 });
      await testClient.mine({ blocks: 1 });
      // #66 loadSnapshot pins on-chain reads to the indexer cursor block. The warp above advances
      // chain time but emits no indexable events, so the cursor (and thus the snapshot's claimable
      // read) would stay at the pre-warp height where accrued == 0 — underflowing the shortfall math.
      // In production the cursor tracks head continuously; mirror that by bumping it to the warped head.
      await setCursor(sql, await publicClient.getBlockNumber());
      // load the current snapshot to learn the on-chain claimable, then collected := claimable-1.
      const snapMod = await import("../../api/src/recon/snapshot.ts");
      const snap = await snapMod.loadSnapshot(sql, publicClient, manifest);
      const shortfall = (snap.onchainClaimableTotal - usdc6(1n)) as bigint;
      await sql`update reserve set balance = ${shortfall.toString()} where id = 1`;
      const res = await runReconCycle(sql, publicClient, manifest);
      if (res.ok) throw new Error("row 7 expected a ReconMismatch HALT, recon cycle passed");
      const resp = await gqlFetch(issuerUrl, RECON, {});
      const status = (resp.data as { reconciliationStatus: { state: string; haltReason: string | null } }).reconciliationStatus;
      // distribution must actually be blocked now: a claim through GraphQL must refuse.
      const claimResp = await gqlFetch(holderUrl, CLAIM, { input: { loanId: ln, wallet } });
      const claimActual = actualFromGql(claimResp, "InterestClaimed");
      if (status.state === "HALTED" && status.haltReason === "ReconMismatch" && claimActual.kind === "halt") {
        return { kind: "halt", state: "ReconMismatch" };
      }
      throw new Error(`row 7 expected ReconMismatch HALT + blocked claim, got ${JSON.stringify({ status, claimActual })}`);
    },
  };

  const dispose = async (): Promise<void> => {
    issuerHttp.stop();
    holderHttp.stop();
    // end both db pools BEFORE dropping the db so `drop ... with force` never races a live query.
    await sql.end({ timeout: 5 }).catch(() => {});
    await holderSql.end({ timeout: 5 }).catch(() => {});
    try {
      await testClient.revert({ id: chainSnapshot });
    } catch {
      /* best-effort chain restore */
    }
    await dropThrowawayDb(dbHandle.name);
  };

  return { ctx, dispose };
}
