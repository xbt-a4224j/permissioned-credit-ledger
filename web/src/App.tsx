// The app shell — header, network pill, view switcher · #24
// The institutional frame the four views mount in. Header carries the project name + a network pill
// (Fuji | Local from VITE_CHAIN_LABEL). The Nav switches the two #24 views (Marketplace, Positions);
// #25 adds the invest/claim actions inside them and #26 adds the Health view + a global recon pill.
// #38 adds the Servicing ops view (the 4-view cap holds: Marketplace, Positions, Servicing, Health).
import { useState, useEffect } from "react";
import { MarketplaceView } from "./views/MarketplaceView.tsx";
import { PositionDashboardView } from "./views/PositionDashboardView.tsx";
import { HealthView } from "./views/HealthView.tsx";
import { LoansView } from "./views/LoansView.tsx";
import { Badge } from "./components/primitives.tsx";
import { useWallet } from "./lib/wallet.ts";
import { DEMO_IDENTITIES } from "./lib/identities.ts";
import { logAction } from "./lib/actionLog.ts";
import type { Address } from "viem";
import { useReconStream } from "./lib/reconStream.ts";
import { InvestAction } from "./components/InvestAction.tsx";
import { PositionActions } from "./components/PositionActions.tsx";
import { KycBadge } from "./components/KycBadge.tsx";

// #24 the network label (Fuji testnet vs the local anvil node), read from Vite env at build.
const CHAIN_LABEL = (import.meta.env.VITE_CHAIN_LABEL ?? "Local") as "Fuji" | "Local";

// #38 four views: investor-facing (marketplace, positions) + platform-facing (loans, health).
type ViewKey = "marketplace" | "positions" | "loans" | "health";

// #38 investor tabs and platform tabs are kept separate so the separator renders between groups.
const INVESTOR_NAV: { key: ViewKey; label: string }[] = [
  { key: "marketplace", label: "Marketplace" },
  { key: "positions", label: "My positions" },
];
const PLATFORM_NAV: { key: ViewKey; label: string }[] = [
  { key: "loans", label: "Servicing" },
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
  // The acting-wallet picker drives invest/claim, which only exist on the investor tabs. On the
  // platform/operator tabs the actor is the issuer (NAV/cash are issuer-signed), so the picker is
  // hidden there — showing it would imply those ops are attributed to a holder, which they aren't.
  const isInvestorView = view === "marketplace" || view === "positions";

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
              One click selects a seeded identity; no browser wallet required. Shown only on the
              investor tabs (marketplace / positions); on operator tabs the actor is the issuer. */}
          {isInvestorView ? (
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
                <Badge tone="positive" title="Acting wallet — click to copy" onClick={() => { navigator.clipboard.writeText(wallet.address ?? ""); }}>{wallet.address}</Badge>
              ) : null}
              {/* #39 KYC status + verify entry point for the acting wallet. */}
              {wallet.address !== undefined ? <KycBadge key={wallet.address} wallet={wallet.address} /> : null}
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-500" title="Operator tabs act as the issuer, not a holder">
              Acting as <span className="text-navy-900">Issuer / servicer</span>
            </div>
          )}
        </div>
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-6" aria-label="Primary">
          {/* #42 group label — make the two-sided platform (investor ↔ operator) split legible. */}
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Investor</span>
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
          <span aria-hidden="true" className="mx-2 h-4 w-px self-center bg-slate-300" />
          {/* #42 group label for the platform/operator side. */}
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Platform</span>
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
          <MarketplaceView
            renderAction={(loan) => (loan.status === "Active" ? <InvestAction loan={loan} wallet={wallet} /> : null)}
          />
        ) : view === "positions" ? (
          <PositionDashboardView
            holder={wallet.address}
            globalFrozen={navFrozen}
            renderActions={(position) => <PositionActions position={position} wallet={wallet} />}
          />
        ) : view === "loans" ? (
          // #38 the platform operator view: per-loan NAV gate + the global servicing-cash panel.
          <LoansView />
        ) : (
          <HealthView status={recon} />
        )}
      </main>

    </div>
  );
}
