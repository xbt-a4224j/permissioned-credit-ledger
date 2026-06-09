// KYC client helpers · #39
// The document is hashed CLIENT-SIDE (Web Crypto SHA-256) and never uploaded — only {filename,size,
// sha256} metadata reaches the API. That's a deliberate privacy posture: the platform never custodies
// PII or document bytes; in production the (real) provider does. Talking point, not just a shortcut.

// #39 SHA-256 a File in the browser → 64-char hex digest. No bytes leave the page.
export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface KycResult {
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  txHash: string | null;
  claims: { verified: boolean; accredited: boolean; jurisdiction: string; frozen: boolean } | null;
}

export const SUBMIT_KYC = /* GraphQL */ `
  mutation SubmitKyc($input: KycInput!) {
    submitKyc(input: $input) {
      decision
      reason
      txHash
      claims { verified accredited jurisdiction frozen }
    }
  }
`;

export const KYC_STATUS = /* GraphQL */ `
  query KycStatus($wallet: Address!) {
    kycStatus(wallet: $wallet) { verified accredited jurisdiction frozen }
  }
`;
