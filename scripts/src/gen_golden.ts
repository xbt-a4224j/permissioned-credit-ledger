// The Seam · regenerate the replay golden fixture · #19
// Backfills the seeded local chain into a throwaway DB, runs the deterministic replay, and
// writes api/src/replay/golden.json (canonical state + stateHash). Run after an intentional
// change to the seed or fold math: `bun run scripts/src/gen_golden.ts`. A logic change that
// alters state then surfaces as a golden-hash diff in replay.golden.test.ts.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { makeSql, applyMigrations } from "@pcl/shared";
import { makeChainClient } from "../../indexer/src/client.ts";
import { backfill } from "../../indexer/src/main.ts";
import { loadManifest, tokenAddresses, tokenToLoanMap } from "../../indexer/src/manifest.ts";
import { seedReference } from "../../indexer/src/seed.ts";
import { loadInputs, replay } from "../../api/src/replay/replay.ts";
import { canonicalize, stateHash } from "../../api/src/replay/hash.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(HERE, "..", "..", "api", "src", "replay", "golden.json");
const BASE = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/pcl";
const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";

async function main(): Promise<void> {
  const name = "pcl_golden_gen";
  const admin = postgres(BASE, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
  await admin.end();

  const url = new URL(BASE);
  url.pathname = `/${name}`;
  const sql = makeSql(url.toString());
  await applyMigrations(sql);

  const m = loadManifest(31337);
  await seedReference(sql, m);
  const chain = makeChainClient(LOCAL_RPC, 31337);
  const latest = await chain.getBlockNumber();
  await backfill(sql, chain, tokenAddresses(m), tokenToLoanMap(m), 0n, latest);

  const state = replay(await loadInputs(sql));
  const golden = {
    hash: stateHash(state),
    canonical: canonicalize(state),
    note: "matrix seed replay (#19): the anchor PositionOpened only, no NAV. Regenerate with scripts/src/gen_golden.ts.",
  };
  writeFileSync(GOLDEN_PATH, `${JSON.stringify(golden, null, 2)}\n`);
  console.log("wrote", GOLDEN_PATH, "hash", golden.hash);

  await sql.end();
  const admin2 = postgres(BASE, { max: 1, onnotice: () => {} });
  await admin2.unsafe(`drop database if exists "${name}" with (force)`);
  await admin2.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
