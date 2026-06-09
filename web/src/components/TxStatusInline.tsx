// The tx-phase chip + explorer link · #25
// Renders the PENDING -> CONFIRMED|REVERTED lifecycle (#23) as a small status chip. On Fuji it
// links to the explorer (VITE_EXPLORER_URL/tx/<hash>); the link is suppressed for the local node.
import type { TxPhase } from "../lib/txStatus.ts";
import { Badge } from "./primitives.tsx";
import type { Tone } from "../theme.ts";

// #25 phase -> label + tone. `signing` is the server-side broadcast (no browser wallet needed);
// the label reflects that — "Submitting…" not "Awaiting signature" (the server signs).
const PHASE_META: Record<TxPhase, { label: string; tone: Tone }> = {
  idle: { label: "Idle", tone: "neutral" },
  signing: { label: "Submitting…", tone: "navy" },
  pending: { label: "Pending confirmation", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "positive" },
  reverted: { label: "Reverted", tone: "block" },
};

const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL as string | undefined;
const CHAIN_LABEL = (import.meta.env.VITE_CHAIN_LABEL ?? "Local") as "Fuji" | "Local";

export function TxStatusInline(props: { phase: TxPhase; txHash?: `0x${string}` | undefined }): JSX.Element | null {
  if (props.phase === "idle") return null;
  const meta = PHASE_META[props.phase];
  const showLink = CHAIN_LABEL === "Fuji" && EXPLORER_URL !== undefined && props.txHash !== undefined;
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {showLink ? (
        <a
          href={`${EXPLORER_URL}/tx/${props.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-navy-700 underline"
        >
          View tx
        </a>
      ) : null}
    </span>
  );
}
