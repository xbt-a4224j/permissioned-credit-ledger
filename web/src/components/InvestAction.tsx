// Money Layer (presentation) · the marketplace Invest action — button + dialog · #25
// Mounted into LoanCard via the actionSlot (MarketplaceView's renderAction). The Invest button is
// disabled with a tooltip until a wallet is connected; clicking opens the InvestDialog. Kept as its
// own component so LoanCard (#24) stays structurally unchanged and wallet-free.
import { useState } from "react";
import type { Loan } from "../types.ts";
import type { WalletApi } from "../lib/wallet.ts";
import { Button } from "./primitives.tsx";
import { InvestDialog } from "./InvestDialog.tsx";

export function InvestAction(props: { loan: Loan; wallet: WalletApi }): JSX.Element {
  const [open, setOpen] = useState(false);
  const connected = props.wallet.address !== undefined;
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={!connected}
        title={connected ? undefined : "Connect a wallet to invest"}
      >
        Invest
      </Button>
      {open ? <InvestDialog loan={props.loan} wallet={props.wallet} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
