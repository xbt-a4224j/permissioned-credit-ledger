// The "Verify identity" modal · #39/#66
// The onboarding front-door: upload a document (hashed client-side) + name → submit. The mock provider
// returns a verdict; on APPROVE the API issuer-signs an on-chain `verified` claim so the wallet flips
// to Verified and the permissioning check now passes. No document bytes or PII ever leave the browser
// — only the SHA-256 metadata. Demo escape hatch: a name with "reject" is refused. (#66 verified-only.)
import { useState } from "react";
import { gql, GraphqlCodeError } from "../lib/graphqlClient.ts";
import { hashFile, SUBMIT_KYC, type KycResult } from "../lib/kyc.ts";
import { logAction } from "../lib/actionLog.ts";
import { Button, Modal } from "./primitives.tsx";

export function KycModal(props: { wallet: string; onClose: () => void; onVerified: () => void }): JSX.Element {
  const [fullName, setFullName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KycResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = fullName.trim().length > 0 && file !== null && !busy;

  async function submit(): Promise<void> {
    if (file === null) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const sha256 = await hashFile(file); // client-side; bytes never leave the page
      const data = await gql<{ submitKyc: KycResult }>(SUBMIT_KYC, {
        input: { wallet: props.wallet, fullName: fullName.trim(), docFilename: file.name, docSize: file.size, docSha256: sha256 },
      });
      setResult(data.submitKyc);
      logAction({ action: "kyc_submit", actor: props.wallet, result: data.submitKyc.decision === "APPROVED" ? "ok" : "rejected", reason: data.submitKyc.reason ?? undefined });
      if (data.submitKyc.decision === "APPROVED") props.onVerified();
    } catch (err) {
      setError(err instanceof GraphqlCodeError ? `${err.message} (${err.code ?? "error"})` : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Verify identity (KYC)" onClose={props.onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-500">
          Mock provider behind a real interface — in production this is Persona / Parallel Markets. The document is
          hashed in your browser; only the SHA-256 is sent. On approval, an on-chain claim is written and the gauntlet passes.
        </p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Full legal name</span>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Investor"
            className="rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Identity document</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          {file !== null ? <span className="text-xs text-slate-400">{file.name} · {(file.size / 1024).toFixed(0)} KB · hashed locally</span> : null}
        </label>

        <div className="flex items-center justify-between">
          <Button onClick={submit} disabled={!canSubmit} title={canSubmit ? undefined : "Name + document required"}>
            {busy ? "Reviewing…" : "Submit"}
          </Button>
          {result?.decision === "APPROVED" ? <span className="text-sm font-medium text-positive">Verified ✓ — claim written on-chain.</span> : null}
          {result?.decision === "REJECTED" ? <span className="text-sm font-medium text-halt">Rejected — {result.reason}</span> : null}
        </div>
        {error !== null ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
      </div>
    </Modal>
  );
}
