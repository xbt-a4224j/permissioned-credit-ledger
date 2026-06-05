// Compliance front-door · KYC resolver — verdict → on-chain claim · #39
// resolveSubmitKyc validates the (metadata-only) submission, asks the provider (#39) for a verdict,
// and — when APPROVED — issuer-signs IdentityRegistry.setClaims so the wallet's on-chain claims flip
// and the transfer gauntlet now passes. resolveKycStatus reads claimsOf back. No PII or document
// bytes are ever received or stored; only {filename,size,sha256} metadata is validated and discarded.
import { GraphQLError } from "graphql";
import type { Address } from "viem";
import { IDENTITY_ABI } from "../chain/abi.ts";
import { kycProvider, type Jurisdiction } from "./provider.ts";
import type { ApiContext } from "../context.ts";

// #39 Solidity IIdentityRegistry.Jurisdiction enum (Unknown=0, US=1, NonUS=2).
const JURISDICTION_TO_U8: Record<Jurisdiction, number> = { US: 1, NonUS: 2 };
const U8_TO_JURISDICTION = ["Unknown", "US", "NonUS"] as const;

export interface KycInputArgs {
  wallet: string;
  fullName: string;
  jurisdiction: string;
  accredited: boolean;
  docFilename: string;
  docSize: number;
  docSha256: string;
}

export interface KycStatusView {
  verified: boolean;
  accredited: boolean;
  jurisdiction: string;
  frozen: boolean;
}

export interface KycResultView {
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  txHash: string | null;
  claims: KycStatusView | null;
}

// #39 validate the external input at the boundary (OWASP): wallet is 0x-hex (the scalar already
// checks), jurisdiction is one of the enum, the doc sha256 is a 64-char hex digest, size is sane.
function validate(input: KycInputArgs): { jurisdiction: Jurisdiction } {
  if (input.jurisdiction !== "US" && input.jurisdiction !== "NonUS") {
    throw new GraphQLError("jurisdiction must be 'US' or 'NonUS'.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (input.docSha256.length > 0 && !/^[0-9a-fA-F]{64}$/.test(input.docSha256)) {
    throw new GraphQLError("docSha256 must be a 64-char hex SHA-256 digest.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (input.docSize < 0 || input.docSize > 50_000_000) {
    throw new GraphQLError("docSize out of range.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (input.fullName.length === 0 || input.fullName.length > 200) {
    throw new GraphQLError("fullName must be 1–200 chars.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  return { jurisdiction: input.jurisdiction };
}

// #39 submit a KYC application: provider review → (on approve) write claims on-chain. Returns the
// verdict + the resulting on-chain claims so the UI can flip the wallet to Verified live.
export async function resolveSubmitKyc(ctx: ApiContext, input: KycInputArgs): Promise<KycResultView> {
  const { jurisdiction } = validate(input);

  const verdict = await kycProvider.review({
    wallet: input.wallet,
    fullName: input.fullName,
    jurisdiction,
    accredited: input.accredited,
    doc: { filename: input.docFilename, size: input.docSize, sha256: input.docSha256 },
  });

  if (verdict.status === "REJECTED" || verdict.claims === null) {
    return { decision: "REJECTED", reason: verdict.reason, txHash: null, claims: null };
  }

  // #39 APPROVED → issuer-signs setClaims(account, {verified, accredited, jurisdiction, frozen}).
  const c = verdict.claims;
  const txHash = await ctx.chain.walletClient.writeContract({
    address: ctx.manifest.identityRegistry as Address,
    abi: IDENTITY_ABI,
    functionName: "setClaims",
    args: [
      input.wallet as Address,
      { verified: c.verified, accredited: c.accredited, jurisdiction: JURISDICTION_TO_U8[c.jurisdiction], frozen: c.frozen },
    ],
    account: ctx.chain.account,
    chain: ctx.chain.walletClient.chain,
  });
  // wait for the claim to land so a follow-up invest sees the verified wallet.
  await ctx.chain.publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    decision: "APPROVED",
    reason: null,
    txHash,
    claims: { verified: c.verified, accredited: c.accredited, jurisdiction: c.jurisdiction, frozen: c.frozen },
  };
}

// #39 read a wallet's current on-chain claims (the gauntlet's source of truth) for the UI badge.
export async function resolveKycStatus(ctx: ApiContext, wallet: string): Promise<KycStatusView> {
  const claims = (await ctx.chain.publicClient.readContract({
    address: ctx.manifest.identityRegistry as Address,
    abi: IDENTITY_ABI,
    functionName: "claimsOf",
    args: [wallet as Address],
  })) as { verified: boolean; accredited: boolean; jurisdiction: number; frozen: boolean };
  return {
    verified: claims.verified,
    accredited: claims.accredited,
    jurisdiction: U8_TO_JURISDICTION[claims.jurisdiction] ?? "Unknown",
    frozen: claims.frozen,
  };
}
