// The Money Layer · idempotent demo reset (wipe + redeploy + reseed the local world) · #30
// `bun run scripts/demo_reset.ts` puts the demo back to a known-good cold state in seconds: it
// tears the stack down, wipes the Postgres volume, restarts the local EVM node, redeploys
// Deploy.s.sol and reseeds the 6 identities + 6 loans, then re-applies the read-model migrations.
// It delegates the actual orchestration to the proven, port-safe dev.sh (#31) with --no-test
// --reset (the same STOP -> START path the verifier relies on) rather than re-implementing it —
// single source of truth, no drift. LANDMINE GUARD: the reset must NEVER touch Fuji; a fumbled
// live reset that broadcast real testnet txs would burn the faucet mid-demo. So we hard-refuse any
// rpcUrl that isn't a localhost/127.0.0.1 node and exit non-zero with a typed reason — no silent
// partial reset, no Fuji broadcast.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// #30 typed failure reasons so a broken reset is machine-checkable, never a silent partial success.
export type DemoResetReason = "NonLocalRpcRefused" | "DevScriptFailed";

export class DemoResetError extends Error {
  // #30 carry the typed reason so callers/CI can branch on the failure mode.
  constructor(
    public readonly reason: DemoResetReason,
    message: string,
  ) {
    super(message);
    this.name = "DemoResetError";
  }
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEV_SH = resolve(SCRIPT_DIR, "dev.sh");

// #30 the LOCAL node only — anvil on the fixed EVM port (CLAUDE.md ports table). Anything else is
// refused so a reset can never broadcast to a real testnet (the Fuji-faucet landmine).
const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:18545";

// #30 only a loopback host is an acceptable reset target; any remote host (a Fuji RPC) is refused.
function assertLocalRpc(rpcUrl: string): void {
  let host: string;
  try {
    host = new URL(rpcUrl).hostname;
  } catch {
    throw new DemoResetError("NonLocalRpcRefused", `rpcUrl is not a valid URL: ${rpcUrl}`);
  }
  const isLocal = host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0" || host === "::1";
  if (!isLocal) {
    throw new DemoResetError(
      "NonLocalRpcRefused",
      `refusing to reset against non-local RPC host "${host}" — demo_reset only ever targets the ` +
        `local node (a Fuji reset could broadcast real txs and burn the faucet). Set LOCAL_RPC to a ` +
        `127.0.0.1/localhost node.`,
    );
  }
}

// #30 run dev.sh --no-test --reset and resolve/reject on its exit code (typed). --no-test keeps the
// reset fast (it's a recovery action, not a CI gate); --reset wipes the PG volume so the read model
// comes back clean; dev.sh then restarts anvil, redeploys + reseeds, and re-applies migrations.
function runDevReset(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("bash", [DEV_SH, "--no-test", "--reset"], {
      stdio: "inherit",
      env: { ...process.env, LOCAL_RPC },
    });
    child.on("error", (err) => reject(new DemoResetError("DevScriptFailed", `failed to launch dev.sh: ${err.message}`)));
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new DemoResetError("DevScriptFailed", `dev.sh --no-test --reset exited with code ${code ?? "null"}`));
    });
  });
}

// #30 the public surface: kill+restart the local node, redeploy, reseed 6 identities + 6 loans,
// re-apply migrations to a clean schema. Throws a typed DemoResetError on any sub-step failure (no
// silent partial reset). Target: < 30s cold on the local node (the README states this budget).
export async function demoReset(opts?: { rpcUrl?: string }): Promise<void> {
  const rpcUrl = opts?.rpcUrl ?? LOCAL_RPC;
  assertLocalRpc(rpcUrl);
  await runDevReset();
}

// #30 CLI entrypoint — run directly via `bun run scripts/demo_reset.ts`. Exits 0 on a clean reset,
// non-zero with the typed reason printed on any failure (so a fumbled run is loud, not silent).
if (import.meta.main) {
  const start = Date.now();
  try {
    await demoReset();
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n[demo_reset] OK — local world reset in ${secs}s. Verify: bun run scripts/verify_matrix.ts (expect 10/10).`);
    process.exit(0);
  } catch (err) {
    if (err instanceof DemoResetError) {
      console.error(`\n[demo_reset] FAILED (${err.reason}): ${err.message}`);
    } else {
      console.error(`\n[demo_reset] FAILED (unexpected): ${(err as Error).message}`);
    }
    process.exit(1);
  }
}
