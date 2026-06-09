// The invest dialog — fund a loan series through the gauntlet · #25
// Amount input (6-decimal aware, parsed to bigint base units), an Invest button gated on a
// connected wallet. ensureChain() runs before the mutation (wrong-network broadcasts diverge from
// the indexer). The result is typed: { ok:false } renders a ReasonBadge inline (rows 3,6 for the
// invest path), { ok:true } shows the tx lifecycle chip. Money never touches a JS number.
import { useState } from "react";
import type { Loan } from "../types.ts";
import type { WalletApi } from "../lib/wallet.ts";
import { useTxLifecycle } from "../lib/txStatus.ts";
import { runMutation } from "../lib/runMutation.ts";
import { INVEST_MUTATION } from "../lib/mutations.ts";
import { logAction } from "../lib/actionLog.ts";
import { parseUsd6 } from "../lib/format.ts";
import { Button, Modal } from "./primitives.tsx";
import { ReasonBadge } from "./ReasonBadge.tsx";
import { TxStatusInline } from "./TxStatusInline.tsx";

export function InvestDialog(props: { loan: Loan; wallet: WalletApi; onClose: () => void }): JSX.Element {
  const { wallet } = props;
  const tx = useTxLifecycle();
  const [amount, setAmount] = useState("1.000000");

  // #25 parse the 6-dec input to bigint base units; invalid input disables the action.
  let amountWei: bigint | null = null;
  try {
    amountWei = parseUsd6(amount);
  } catch {
    amountWei = null;
  }

  const submit = async (): Promise<void> => {
    if (wallet.address === undefined || amountWei === null) return;
    await tx.run(async () => {
      await wallet.ensureChain();
      const result = await runMutation(INVEST_MUTATION, { input: { loanId: props.loan.id, wallet: wallet.address, amount: amountWei!.toString() } }, "invest");
      logAction({ action: "invest", actor: wallet.address as string, loanId: props.loan.id, amount: amountWei!.toString(), result: result.ok ? "ok" : result.code === "NavAnomaly" || result.code === "ReconMismatch" ? "halted" : "rejected", reason: result.ok ? undefined : result.code });
      return result;
    });
  };

  return (
    <Modal title={`Invest in loan #${props.loan.id}`} onClose={props.onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Amount (USDC)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 font-tabular tabular-nums"
          />
          {amountWei === null ? <span className="text-xs text-halt">Enter a valid amount.</span> : null}
        </label>

        <div className="flex items-center justify-between">
          <Button
            onClick={submit}
            disabled={wallet.address === undefined || amountWei === null || tx.phase === "signing" || tx.phase === "pending"}
            title={wallet.address === undefined ? "Connect a wallet to invest" : undefined}
          >
            Invest
          </Button>
          <TxStatusInline phase={tx.phase} txHash={tx.txHash} />
        </div>

        {tx.phase === "reverted" && tx.reason !== undefined ? <ReasonBadge code={tx.reason} /> : null}
        {tx.phase === "confirmed" ? <span className="text-sm text-positive">Position opened — accrual started.</span> : null}
      </div>
    </Modal>
  );
}
