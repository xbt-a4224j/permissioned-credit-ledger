// The KYC provider seam — build-vs-buy made explicit · #39
// KYC/KYB document verification is a regulated, commodity capability: in production you integrate a
// vendor (Persona, Parallel Markets, iComply, Jumio) — you do NOT build OCR + liveness + sanctions
// screening yourself. So this is an INTERFACE with a mock implementation: the anti-corruption layer.
// Swapping in a real provider is a one-file change. Crucially, the provider holds the PII and the
// document bytes; the platform only ever receives a VERDICT + the claims to write on-chain. The
// interesting (worth-building) part is downstream: the verdict becomes an IdentityRegistry claim that
// the transfer gauntlet enforces — compliance-as-code.

export type Jurisdiction = "US" | "NonUS";

// #39 what the applicant submits. `doc` is METADATA ONLY — the bytes never leave the browser; the UI
// hashes the file client-side and sends {filename,size,sha256}. We never custody PII or documents.
export interface KycSubmission {
  wallet: string;
  fullName: string;
  jurisdiction: Jurisdiction;
  accredited: boolean;
  doc: { filename: string; size: number; sha256: string };
}

export interface KycClaims {
  verified: boolean;
  accredited: boolean;
  jurisdiction: Jurisdiction;
  frozen: boolean;
}

export interface KycVerdict {
  status: "APPROVED" | "REJECTED";
  reason: string | null;
  /** the claims to write on-chain when APPROVED; null when REJECTED */
  claims: KycClaims | null;
}

export interface KycProvider {
  review(s: KycSubmission): Promise<KycVerdict>;
}

// #39 the mock provider — auto-approves a well-formed submission. Two demo escape hatches: a name
// containing "reject" simulates a failed sanctions/PEP/document check, and a missing document hash
// is refused — so the rejected path is demoable and testable without a real vendor.
export class MockKycProvider implements KycProvider {
  async review(s: KycSubmission): Promise<KycVerdict> {
    if (s.doc.sha256.length === 0) {
      return { status: "REJECTED", reason: "No identity document provided.", claims: null };
    }
    if (/reject|sanction|deny/i.test(s.fullName)) {
      return { status: "REJECTED", reason: "Identity/sanctions screening failed (mock provider).", claims: null };
    }
    return {
      status: "APPROVED",
      reason: null,
      claims: { verified: true, accredited: s.accredited, jurisdiction: s.jurisdiction, frozen: false },
    };
  }
}

// #39 the single provider instance the resolver uses. In prod: `new PersonaKycProvider(env)`.
export const kycProvider: KycProvider = new MockKycProvider();
