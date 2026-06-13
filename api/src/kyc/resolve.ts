// KYC resolver — verdict → on-chain claim · #39/#66
// resolveSubmitKyc validates the (metadata-only) submission, asks the provider (#39) for a verdict,
// and — when APPROVED — issuer-signs IdentityRegistry.setClaims so the wallet's on-chain `verified`
// claim flips and the permissioning check now passes. resolveKycStatus reads claimsOf back. No PII or
// document bytes are ever received or stored; only {filename,size,sha256} metadata is validated and
// discarded. (#66 collapsed compliance to verified-only: no jurisdiction / accreditation here.)
import { GraphQLError } from "graphql";
import type { Address } from "viem";
import { IDENTITY_ABI } from "../chain/abi.ts";
import { kycProvider } from "./provider.ts";
import type { ApiContext } from "../context.ts";

export interface KycInputArgs {
  wallet: string;
  fullName: string;
  docFilename: string;
  docSize: number;
  docSha256: string;
}

export interface KycStatusView {
  verified: boolean;
}

export interface KycResultView {
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  txHash: string | null;
  claims: KycStatusView | null;
}

// #39 validate the external input at the boundary (OWASP): wallet is 0x-hex (the scalar already
// checks), the doc sha256 is a 64-char hex digest, size is sane, fullName is bounded.
function validate(input: KycInputArgs): void {
  if (input.docSha256.length > 0 && !/^[0-9a-fA-F]{64}$/.test(input.docSha256)) {
    throw new GraphQLError("docSha256 must be a 64-char hex SHA-256 digest.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (input.docSize < 0 || input.docSize > 50_000_000) {
    throw new GraphQLError("docSize out of range.", { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (input.fullName.length === 0 || input.fullName.length > 200) {
    throw new GraphQLError("fullName must be 1–200 chars.", { extensions: { code: "BAD_USER_INPUT" } });
  }
}

// #39 submit a KYC application: provider review → (on approve) write the verified claim on-chain.
// Returns the verdict + the resulting on-chain claim so the UI can flip the wallet to Verified live.
export async function resolveSubmitKyc(ctx: ApiContext, input: KycInputArgs): Promise<KycResultView> {
  validate(input);

  const verdict = await kycProvider.review({
    wallet: input.wallet,
    fullName: input.fullName,
    doc: { filename: input.docFilename, size: input.docSize, sha256: input.docSha256 },
  });

  if (verdict.status === "REJECTED" || verdict.claims === null) {
    return { decision: "REJECTED", reason: verdict.reason, txHash: null, claims: null };
  }

  // #39 APPROVED → issuer-signs setClaims(account, { verified }).
  const c = verdict.claims;
  const txHash = await ctx.chain.walletClient.writeContract({
    address: ctx.manifest.identityRegistry as Address,
    abi: IDENTITY_ABI,
    functionName: "setClaims",
    args: [input.wallet as Address, { verified: c.verified }],
    account: ctx.chain.account,
    chain: ctx.chain.walletClient.chain,
  });
  // #39 wait for the claim to land AND confirm it succeeded. A reverted setClaims (signer lost
  // ISSUER_ROLE, nonce/gas, a stale-deploy registry) must NOT be reported as APPROVED: the wallet
  // stays unverified on-chain, so a follow-up invest reverts ReceiverNotVerified at the simulate
  // stage and never broadcasts — surfacing as a silent "position never opened, never accrues" bug.
  // Surface it instead of writing an off-chain mirror that disagrees with the chain.
  const receipt = await ctx.chain.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new GraphQLError("Identity claim write reverted on-chain; wallet is not verified.", {
      extensions: { code: "ChainRevertError" },
    });
  }

  // #39 mirror the on-chain claim into the off-chain identities read-model. The indexer projects
  // token events (PositionOpened/Transfer/…) but NOT identity-claim changes, so without this the
  // recon engine's I4 (IdentityValid) keeps reading the stale seed: the instant a freshly-verified
  // wallet takes a position, I4 sees an "unverified holder" and HALTs the whole platform. Keep the
  // mirror in sync here so on-chain and off-chain identity views never diverge.
  await ctx.db`
    insert into identities (addr, verified)
    values (${input.wallet.toLowerCase()}, ${c.verified})
    on conflict (addr) do update set verified = excluded.verified
  `;

  return { decision: "APPROVED", reason: null, txHash, claims: { verified: c.verified } };
}

// #39 read a wallet's current on-chain claim (the permissioning source of truth) for the UI badge.
export async function resolveKycStatus(ctx: ApiContext, wallet: string): Promise<KycStatusView> {
  const claims = (await ctx.chain.publicClient.readContract({
    address: ctx.manifest.identityRegistry as Address,
    abi: IDENTITY_ABI,
    functionName: "claimsOf",
    args: [wallet as Address],
  })) as { verified: boolean };
  return { verified: claims.verified };
}
