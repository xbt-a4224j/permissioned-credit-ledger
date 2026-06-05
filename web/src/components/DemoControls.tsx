// The Seam (presentation) · demo controls — trigger the marquee HALTs from the UI · #33 (bug)
// Bug #33: NavAnomaly / ReconMismatch (the marquee) had no live trigger — only verify_matrix.ts
// exercised them. These two buttons call the demo-only pushNav / injectCash mutations (#33), which
// halt loan series #1 the same way the matrix does. The HALT banner + invariant grid then update
// over SSE within one driver interval (#32). Local-node only; a non-local API refuses server-side.
import { useState } from "react";
import { Button, Card } from "./primitives.tsx";
import { gql, GraphqlCodeError } from "../lib/graphqlClient.ts";
import { PUSH_NAV_MUTATION, INJECT_CASH_MUTATION } from "../lib/mutations.ts";

// #33 the demo always targets the seeded loan series #1 (the position that exists on a fresh world).
const DEMO_LOAN_ID = 1;

export function DemoControls(): JSX.Element {
  const [busy, setBusy] = useState<"nav" | "cash" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fire(kind: "nav" | "cash"): Promise<void> {
    setBusy(kind);
    setMessage(null);
    setError(null);
    try {
      const doc = kind === "nav" ? PUSH_NAV_MUTATION : INJECT_CASH_MUTATION;
      const field = kind === "nav" ? "pushNav" : "injectCash";
      const data = await gql<Record<string, { state: string; haltReason: string | null }>>(doc, { loanId: DEMO_LOAN_ID });
      const status = data[field];
      setMessage(
        status?.state === "HALTED"
          ? `Engine HALTED — ${status.haltReason ?? "halt"} on loan #${DEMO_LOAN_ID}.`
          : `Triggered; the panel updates on the next reconciliation cycle.`,
      );
    } catch (err) {
      setError(err instanceof GraphqlCodeError ? `${err.message} (${err.code ?? "error"})` : (err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-dashed">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-navy-900">Demo controls</div>
          <p className="text-xs text-slate-500">
            Trigger the marquee on loan series #{DEMO_LOAN_ID}. Reset afterwards with{" "}
            <code className="rounded bg-slate-100 px-1">bun run scripts/demo_reset.ts</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy !== null} onClick={() => void fire("nav")}>
            {busy === "nav" ? "Pushing…" : "Push +40% NAV"}
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => void fire("cash")}>
            {busy === "cash" ? "Injecting…" : "Inject cash shortfall"}
          </Button>
        </div>
      </div>
      {message !== null ? <p className="mt-3 text-sm text-navy-700">{message}</p> : null}
      {error !== null ? <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p> : null}
    </Card>
  );
}
