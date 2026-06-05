// Money Layer (presentation) · the app shell — header, network pill, view switcher · #24
// The institutional frame the four views mount in. Header carries the project name + a network pill
// (Fuji | Local from VITE_CHAIN_LABEL). The Nav switches the two #24 views (Marketplace, Positions);
// #25 adds the invest/claim actions inside them and #26 adds the Health view + a global recon pill.
import { useState } from "react";
import { MarketplaceView } from "./views/MarketplaceView.tsx";
import { PositionDashboardView } from "./views/PositionDashboardView.tsx";
import { Badge, Button } from "./components/primitives.tsx";
import { useWallet } from "./lib/wallet.ts";
import { InvestAction } from "./components/InvestAction.tsx";
import { PositionActions } from "./components/PositionActions.tsx";

// #24 the network label (Fuji testnet vs the local anvil node), read from Vite env at build.
const CHAIN_LABEL = (import.meta.env.VITE_CHAIN_LABEL ?? "Local") as "Fuji" | "Local";

// #24 the views this shell switches between (extended to Health in #26).
type ViewKey = "marketplace" | "positions";

const NAV: { key: ViewKey; label: string }[] = [
  { key: "marketplace", label: "Marketplace" },
  { key: "positions", label: "My positions" },
];

export function App(): JSX.Element {
  const [view, setView] = useState<ViewKey>("marketplace");
  // #25 one wallet instance, shared across the views so the invest/claim/transfer flows and the
  // dashboard's holder filter all read the same connected address.
  const wallet = useWallet();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight text-navy-900">Permissioned Credit Ledger</span>
            <Badge tone="navy" title={`Connected network: ${CHAIN_LABEL}`}>{CHAIN_LABEL}</Badge>
          </div>
          {/* #25 wallet connect — the on/off-ramp at the UI edge. */}
          {wallet.address !== undefined ? (
            <Badge tone="positive" title="Wallet connected">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</Badge>
          ) : (
            <Button onClick={() => void wallet.connect()}>Connect wallet</Button>
          )}
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6" aria-label="Primary">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => setView(n.key)}
              aria-current={view === n.key ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                view === n.key ? "border-navy-700 text-navy-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {view === "marketplace" ? (
          <MarketplaceView renderAction={(loan) => <InvestAction loan={loan} wallet={wallet} />} />
        ) : (
          <PositionDashboardView
            holder={wallet.address}
            renderActions={(position) => <PositionActions position={position} wallet={wallet} />}
          />
        )}
      </main>
    </div>
  );
}
