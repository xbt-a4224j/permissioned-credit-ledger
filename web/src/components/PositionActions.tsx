// Per-position Claim + Transfer actions · #25
// Mounted into PositionRow via the actionSlot (PositionDashboardView's renderActions). Claim pays
// accrued from the reserve (rows 7-8); Transfer opens the gauntleted transfer dialog (rows 4-5).
// Both are wallet-gated. Kept separate so PositionRow (#24) stays structurally unchanged.
import { useState } from "react";
import type { Position } from "../types.ts";
import type { WalletApi } from "../lib/wallet.ts";
import { Button } from "./primitives.tsx";
import { ClaimPanel } from "./ClaimPanel.tsx";
import { TransferDialog } from "./TransferDialog.tsx";

export function PositionActions(props: { position: Position; wallet: WalletApi }): JSX.Element {
  const [transferring, setTransferring] = useState(false);
  const connected = props.wallet.address !== undefined;
  return (
    <div className="flex items-center justify-end gap-3">
      <ClaimPanel position={props.position} wallet={props.wallet} />
      <Button
        variant="secondary"
        onClick={() => setTransferring(true)}
        disabled={!connected}
        title={connected ? undefined : "Connect a wallet to transfer"}
      >
        Transfer
      </Button>
      {transferring ? <TransferDialog position={props.position} wallet={props.wallet} onClose={() => setTransferring(false)} /> : null}
    </div>
  );
}
