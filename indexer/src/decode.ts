// Viem log -> typed ChainEvent · #16
// decodeChainEvent maps a raw CreditToken log onto the @pcl/shared ChainEvent union, building
// the canonical EventId (txHash:logIndex) the ingest dedupes on (#16) and replay orders by
// (#19). It resolves the loan series from the emitting token (one CreditToken == one loan) so
// every event — including the loan-less ERC20 Transfer — carries its loan. Unknown event
// names / tokens / status indices are hard errors, never silently dropped: the indexer must
// trust on-chain truth exactly or downstream invariants (#18) lie.
import { decodeEventLog, type Log } from "viem";
import {
  eventId,
  identityAddr,
  loanId,
  usdc6,
  type ChainEvent,
  type IdentityAddr,
  type LoanId,
} from "@pcl/shared";
import { CREDIT_TOKEN_EVENTS, IDENTITY_EVENTS, JURISDICTION_BY_INDEX, LOAN_STATUS_BY_INDEX } from "./abi.ts";

// #16 a log carrying the fields the projection needs (viem getLogs/watch provide these).
export type RawLog = Log & {
  transactionHash: `0x${string}` | null;
  logIndex: number | null;
  blockNumber: bigint | null;
  address: `0x${string}`;
};

function statusName(idx: number): "PERFORMING" | "DELINQUENT" | "DEFAULT" {
  const s = LOAN_STATUS_BY_INDEX[idx];
  if (s === undefined) throw new Error(`unknown LoanStatus index ${idx} (ABI drift)`);
  return s;
}

// #47 decode an IdentityRegistry ClaimsUpdated (KYC) log into a ChainEvent — a registry log, not a
// token log, so there is no loan. Returns null for any other registry log. The caller (decodeChainEvent)
// has already validated txHash/logIndex/blockNumber are non-null before delegating here.
function decodeIdentityEvent(log: RawLog): ChainEvent | null {
  let decoded: { eventName: string; args: Record<string, unknown> };
  try {
    decoded = decodeEventLog({ abi: IDENTITY_EVENTS, data: log.data, topics: log.topics }) as {
      eventName: string;
      args: Record<string, unknown>;
    };
  } catch {
    return null;
  }
  if (decoded.eventName !== "ClaimsUpdated") return null;
  const a = decoded.args;
  return {
    id: eventId(log.transactionHash as `0x${string}`, log.logIndex as number),
    blockNumber: log.blockNumber as bigint,
    logIndex: log.logIndex as number,
    token: identityAddr(log.address), // the emitting IdentityRegistry (no loan series)
    name: "ClaimsUpdated",
    account: identityAddr(a["account"] as string),
    verified: a["verified"] as boolean,
    accredited: a["accredited"] as boolean,
    jurisdiction: JURISDICTION_BY_INDEX[Number(a["jurisdiction"] as bigint | number)] ?? "Unknown",
    frozen: a["frozen"] as boolean,
  };
}

// #16 decode one log. Returns null for a CreditToken log we don't project (e.g. Approval,
// RoleGranted) so the caller can skip it; throws only on a corrupt/недecodable log.
export function decodeChainEvent(log: RawLog, tokenToLoan: ReadonlyMap<IdentityAddr, LoanId>): ChainEvent | null {
  if (log.transactionHash === null || log.logIndex === null || log.blockNumber === null) {
    throw new Error("decodeChainEvent: log is missing txHash/logIndex/blockNumber (pending log?)");
  }

  let decoded: { eventName: string; args: Record<string, unknown> };
  try {
    decoded = decodeEventLog({
      abi: CREDIT_TOKEN_EVENTS,
      data: log.data,
      topics: log.topics,
    }) as { eventName: string; args: Record<string, unknown> };
  } catch {
    // #47 not a CreditToken event — try the IdentityRegistry (ClaimsUpdated/KYC); else skip.
    return decodeIdentityEvent(log);
  }

  const token = identityAddr(log.address);
  const loan = tokenToLoan.get(token);
  const id = eventId(log.transactionHash, log.logIndex);
  const base = { id, blockNumber: log.blockNumber, logIndex: log.logIndex, token } as const;
  const a = decoded.args;

  switch (decoded.eventName) {
    case "PositionOpened":
      return {
        ...base,
        name: "PositionOpened",
        holder: identityAddr(a["holder"] as string),
        loan: loanId(a["loanId"] as bigint),
        amount: usdc6(a["amount"] as bigint),
      };
    case "InterestClaimed":
      return {
        ...base,
        name: "InterestClaimed",
        holder: identityAddr(a["holder"] as string),
        loan: loanId(a["loanId"] as bigint),
        amount: usdc6(a["amount"] as bigint),
      };
    case "LoanStatusChanged":
      return {
        ...base,
        name: "LoanStatusChanged",
        loan: loanId(a["loanId"] as bigint),
        status: statusName(Number(a["status"] as bigint | number)),
      };
    case "Transfer": {
      // the loan must be known for the (loan, holder) projection; an unmapped token is a
      // deploy/manifest mismatch (hard error, never a silent skip).
      if (loan === undefined) throw new Error(`Transfer from unmapped token ${token} (manifest mismatch)`);
      return {
        ...base,
        name: "Transfer",
        loan,
        from: identityAddr(a["from"] as string),
        to: identityAddr(a["to"] as string),
        amount: usdc6(a["value"] as bigint),
      };
    }
    default:
      return null; // AccrualFrozen etc. — decoded but not projected into positions
  }
}
