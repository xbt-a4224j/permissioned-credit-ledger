// Money Layer (presentation) · the claim panel — pay accrued interest from the reserve · #25
// Shows the position's claimable and a Claim button (gated on a connected wallet). On success it
// confirms InterestClaimed + a debited-reserve hint (row 7); on InsufficientReserve it renders the
// ReasonBadge and leaves accrued intact (row 8 — the optimistic value is NOT reset). Money is bigint.
import type { Position } from "../types.ts";
import type { WalletApi } from "../lib/wallet.ts";
import { useWallet } from "../lib/wallet.ts";
import { useTxLifecycle } from "../lib/txStatus.ts";
import { runMutation } from "../lib/runMutation.ts";
import { CLAIM_MUTATION } from "../lib/mutations.ts";
import { logAction } from "../lib/actionLog.ts";
import { Button } from "./primitives.tsx";
import { ReasonBadge } from "./ReasonBadge.tsx";
import { TxStatusInline } from "./TxStatusInline.tsx";

export function ClaimPanel(props: { position: Position; wallet?: WalletApi }): JSX.Element {
  const ownWallet = useWallet();
  const wallet = props.wallet ?? ownWallet;
  const tx = useTxLifecycle();

  const submit = async (): Promise<void> => {
    if (wallet.address === undefined) return;
    await tx.run(async () => {
      await wallet.ensureChain();
      const result = await runMutation(CLAIM_MUTATION, { input: { loanId: props.position.loanId, wallet: wallet.address } }, "claim");
      logAction({ action: "claim", actor: wallet.address as string, loanId: props.position.loanId, result: result.ok ? "ok" : result.code === "NavAnomaly" || result.code === "ReconMismatch" ? "halted" : "rejected", reason: result.ok ? undefined : result.code });
      return result;
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={submit}
          disabled={wallet.address === undefined || tx.phase === "signing" || tx.phase === "pending"}
          title={wallet.address === undefined ? "Connect a wallet to claim" : undefined}
        >
          Claim
        </Button>
      </div>
      <TxStatusInline phase={tx.phase} txHash={tx.txHash} />
      {tx.phase === "reverted" && tx.reason !== undefined ? <ReasonBadge code={tx.reason} /> : null}
    </div>
  );
}
