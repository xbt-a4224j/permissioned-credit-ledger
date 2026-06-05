// Money Layer (presentation) · the app shell — header, network pill, view switcher · #24
// The institutional frame the four views mount in. Header carries the project name + a network pill
// (Fuji | Local from VITE_CHAIN_LABEL). The Nav switches the two #24 views (Marketplace, Positions);
// #25 adds the invest/claim actions inside them and #26 adds the Health view + a global recon pill.
// #38 adds the Loans ops view (4th and final view per the ≤4-view cap).
import { useState, useEffect } from "react";
import { MarketplaceView } from "./views/MarketplaceView.tsx";
import { PositionDashboardView } from "./views/PositionDashboardView.tsx";
import { HealthView } from "./views/HealthView.tsx";
import { LoansView } from "./views/LoansView.tsx";
import { TranchesView } from "./views/TranchesView.tsx";
import { Badge } from "./components/primitives.tsx";
import { useWallet } from "./lib/wallet.ts";
import { DEMO_IDENTITIES } from "./lib/identities.ts";
import { logAction } from "./lib/actionLog.ts";
import type { Address } from "viem";
import { useReconStream } from "./lib/reconStream.ts";
import { InvestAction } from "./components/InvestAction.tsx";
import { PositionActions } from "./components/PositionActions.tsx";
import { Lifecycle } from "./components/Lifecycle.tsx";

// #24 the network label (Fuji testnet vs the local anvil node), read from Vite env at build.
const CHAIN_LABEL = (import.meta.env.VITE_CHAIN_LABEL ?? "Local") as "Fuji" | "Local";

// #38 four views: investor-facing (marketplace, positions) + platform-facing (loans, health).
type ViewKey = "marketplace" | "positions" | "loans" | "tranches" | "health";

// #38 investor tabs and platform tabs are kept separate so the separator renders between groups.
const INVESTOR_NAV: { key: ViewKey; label: string }[] = [
  { key: "marketplace", label: "Marketplace" },
  { key: "positions", label: "My positions" },
];
const PLATFORM_NAV: { key: ViewKey; label: string }[] = [
  { key: "loans", label: "Loans" },
  { key: "tranches", label: "Tranches" },
  { key: "health", label: "Health" },
];

export function App(): JSX.Element {
  const [view, setView] = useState<ViewKey>("marketplace");
  const wallet = useWallet();

  // Pre-select Accredited US #1 on load so the demo opens ready — no "Select an identity…" blank.
  useEffect(() => {
    if (wallet.address === undefined && DEMO_IDENTITIES[0] !== undefined) {
      wallet.selectDemoIdentity(DEMO_IDENTITIES[0].address);
    }
  }, []);
  // #26 one recon source for the WHOLE shell: the header pill and the Health panel read the same
  // stream so a HALT is visible from every view — never a cheery green ticker while the engine halts.
  const recon = useReconStream();
  const halted = recon?.state === "HALTED";
  // #26 row-9 NavAnomaly freezes the dashboard accrual ticker (reusing #24's freeze path).
  const navFrozen = halted && recon?.haltCode === "NavAnomaly";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-base font-semibold tracking-tight text-navy-900">Permissioned Credit Ledger</div>
              <div className="text-xs text-slate-400 leading-none mt-0.5">Tokenized credit · provable yield integrity</div>
            </div>
            <Badge tone="navy" title={`Connected network: ${CHAIN_LABEL}`}>{CHAIN_LABEL}</Badge>
            {/* #26 the global recon pill — green OK / red HALTED, visible from every view. */}
            <Badge tone={halted ? "halt" : "positive"} title="Reconciliation engine status">
              {halted ? "HALTED" : "OK"}
            </Badge>
          </div>
          {/* #34 demo identity picker — the server is the signer, so the actor is just an address.
              One click selects a seeded identity; no browser wallet required. */}
          <div className="flex items-center gap-2">
            <label htmlFor="actor" className="text-xs font-medium text-slate-500">Acting as</label>
            <select
              id="actor"
              value={wallet.address ?? ""}
              onChange={(e) => { wallet.selectDemoIdentity(e.target.value as Address); logAction({ action: "identity_switch", actor: e.target.value }); }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            >
              <option value="" disabled>
                Select an identity…
              </option>
              {DEMO_IDENTITIES.map((id) => (
                <option key={id.address} value={id.address} title={id.note}>
                  {id.label}
                </option>
              ))}
            </select>
            {wallet.address !== undefined ? (
              <Badge tone="positive" title="Acting wallet">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</Badge>
            ) : null}
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-6" aria-label="Primary">
          {/* #38 investor tabs */}
          {INVESTOR_NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => { setView(n.key); logAction({ action: "view_change", view: n.key }); }}
              aria-current={view === n.key ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                view === n.key ? "border-navy-700 text-navy-900" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {n.label}
            </button>
          ))}
          {/* #38 faint vertical divider between investor tabs and platform (operator) tabs */}
          <span aria-hidden="true" className="mx-1 h-4 w-px self-center bg-slate-300" />
          {/* #38 platform / operator tabs */}
          {PLATFORM_NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => { setView(n.key); logAction({ action: "view_change", view: n.key }); }}
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {view === "marketplace" ? (
          <MarketplaceView renderAction={(loan) => <InvestAction loan={loan} wallet={wallet} />} />
        ) : view === "positions" ? (
          <PositionDashboardView
            holder={wallet.address}
            globalFrozen={navFrozen}
            renderActions={(position) => <PositionActions position={position} wallet={wallet} />}
          />
        ) : view === "loans" ? (
          // #38 the platform operator view: NAV gate + servicing cash feed per loan.
          <LoansView />
        ) : view === "tranches" ? (
          // #42 the structuring module: the tranche waterfall visualizer.
          <TranchesView />
        ) : (
          <HealthView status={recon} />
        )}
      </main>

      {/* #40 always-visible lifecycle strip — the end-to-end sequence at a glance, for the room. */}
      <Lifecycle />
    </div>
  );
}
