// Money Layer (presentation) · the transfer dialog — a gauntleted holder-to-holder transfer · #25
// Recipient address + amount (6-dec -> bigint). The transfer routes through the compliance gauntlet
// (#8), so a revert surfaces ReceiverFrozen (row 4) / ReceiverNotVerified (row 5) as a typed
// ReasonBadge. ensureChain() precedes the broadcast. Money never coerces through a JS number.
import { useState } from "react";
import type { Position } from "../types.ts";
import type { WalletApi } from "../lib/wallet.ts";
import { useWallet } from "../lib/wallet.ts";
import { useTxLifecycle } from "../lib/txStatus.ts";
import { runMutation } from "../lib/runMutation.ts";
import { TRANSFER_MUTATION } from "../lib/mutations.ts";
import { logAction } from "../lib/actionLog.ts";
import { parseUsd6 } from "../lib/format.ts";
import { Button, Modal } from "./primitives.tsx";
import { ReasonBadge } from "./ReasonBadge.tsx";
import { TxStatusInline } from "./TxStatusInline.tsx";

export function TransferDialog(props: { position: Position; wallet?: WalletApi; onClose: () => void }): JSX.Element {
  const ownWallet = useWallet();
  const wallet = props.wallet ?? ownWallet;
  const tx = useTxLifecycle();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("1.000000");

  let amountWei: bigint | null = null;
  try {
    amountWei = parseUsd6(amount);
  } catch {
    amountWei = null;
  }
  const validTo = /^0x[0-9a-fA-F]{40}$/.test(to);

  const submit = async (): Promise<void> => {
    if (wallet.address === undefined || amountWei === null || !validTo) return;
    await tx.run(async () => {
      await wallet.ensureChain();
      const result = await runMutation(
        TRANSFER_MUTATION,
        { input: { loanId: props.position.loanId, from: wallet.address, to, amount: amountWei!.toString() } },
        "transfer",
      );
      logAction({ action: "transfer", actor: wallet.address as string, loanId: props.position.loanId, to, amount: amountWei!.toString(), result: result.ok ? "ok" : result.code === "NavAnomaly" || result.code === "ReconMismatch" ? "halted" : "rejected", reason: result.ok ? undefined : result.code });
      return result;
    });
  };

  return (
    <Modal title={`Transfer loan #${props.position.loanId}`} onClose={props.onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Recipient address</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x…"
            className="rounded-md border border-slate-300 px-3 py-2 font-tabular"
          />
          {to !== "" && !validTo ? <span className="text-xs text-halt">Enter a valid 0x address.</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Amount (USDC)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 font-tabular tabular-nums"
          />
        </label>

        <div className="flex items-center justify-between">
          <Button
            onClick={submit}
            disabled={wallet.address === undefined || amountWei === null || !validTo || tx.phase === "signing" || tx.phase === "pending"}
            title={wallet.address === undefined ? "Connect a wallet to transfer" : undefined}
          >
            Transfer
          </Button>
          <TxStatusInline phase={tx.phase} txHash={tx.txHash} />
        </div>

        {tx.phase === "reverted" && tx.reason !== undefined ? <ReasonBadge code={tx.reason} /> : null}
        {tx.phase === "confirmed" ? <span className="text-sm text-positive">Transfer confirmed.</span> : null}
      </div>
    </Modal>
  );
}
