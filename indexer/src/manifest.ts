// The #12 deploy manifest as the off-chain genesis input · #16
// loadManifest reads deployments/<chainId>.json (written by Deploy.s.sol) and exposes the
// registry/reserve addresses + the per-loan token map. The token->loan map is what lets the
// decoder (#16) resolve a loan from any emitting CreditToken (one token == one loan series).
// No hardcoded addresses anywhere downstream — everything binds through this manifest.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { identityAddr, loanId, type IdentityAddr, type LoanId } from "@pcl/shared";

export interface ManifestLoan {
  loanId: number;
  token: string;
  collateralType: "CRE" | "RESIDENTIAL";
  label: string;
  principal: string;
  ltvBps: number;
  dscrBps: number;
  ratePerSecond: string;
  offering: "RegD" | "RegS";
  status: "PERFORMING" | "DELINQUENT" | "DEFAULT";
}

export interface Manifest {
  chainId: number;
  identityRegistry: string;
  complianceRegistryRegD: string;
  complianceRegistryRegS: string;
  reserve: string;
  loans: Record<string, ManifestLoan>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
// indexer/src -> ../../deployments
const DEPLOYMENTS_DIR = join(HERE, "..", "..", "deployments");

export function loadManifest(chainId = 31337, dir = DEPLOYMENTS_DIR): Manifest {
  const raw = readFileSync(join(dir, `${chainId}.json`), "utf8");
  return JSON.parse(raw) as Manifest;
}

// #16 token address (lowercased IdentityAddr) -> LoanId, for the decoder.
export function tokenToLoanMap(m: Manifest): Map<IdentityAddr, LoanId> {
  const map = new Map<IdentityAddr, LoanId>();
  for (const ln of Object.values(m.loans)) {
    map.set(identityAddr(ln.token), loanId(ln.loanId));
  }
  return map;
}

// #16 every CreditToken address to subscribe/backfill across (all 6 loan series).
export function tokenAddresses(m: Manifest): `0x${string}`[] {
  return Object.values(m.loans).map((ln) => ln.token as `0x${string}`);
}
