// Resources & endpoints panel — the operator's quick-links · #26
// A flat directory of every live surface in the running stack so a platform operator can jump
// straight to the GraphQL playground, the SSE feed, the warehouse health, the EVM RPC, or the block
// explorer without hunting for ports. URLs derive from the same VITE_ env the app uses, with the
// fixed-port dev defaults — so this stays correct whether running local or against Fuji.
import { Card } from "./primitives.tsx";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:41990/graphql";
const API_BASE = API_URL.replace(/\/graphql\/?$/, "");
const WAREHOUSE_URL = (import.meta.env.VITE_WAREHOUSE_URL as string | undefined) ?? "http://localhost:47100";
const RPC_URL = (import.meta.env.VITE_RPC_URL as string | undefined) ?? "http://localhost:18545";
const EXPLORER_URL = (import.meta.env.VITE_EXPLORER_URL as string | undefined) ?? "";

interface Endpoint {
  label: string;
  href: string;
  hint: string;
}

const ENDPOINTS: Endpoint[] = [
  { label: "GraphQL API", href: API_URL, hint: "Pothos + graphql-yoga — open for the in-browser playground" },
  { label: "SSE live feed", href: `${API_BASE}/sse`, hint: "Server-sent accrual + recon stream" },
  { label: "API health", href: `${API_BASE}/health`, hint: "Liveness probe (JSON)" },
  { label: "Data platform", href: `${WAREHOUSE_URL}/actuator/health`, hint: "Java warehouse sidecar — Spring actuator" },
  { label: "EVM RPC", href: RPC_URL, hint: "Local anvil node (chain id 31337)" },
  ...(EXPLORER_URL !== "" ? [{ label: "Block explorer", href: EXPLORER_URL, hint: "On-chain transactions + contracts" } as Endpoint] : []),
];

export function ResourcesPanel(): JSX.Element {
  return (
    <Card className="p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-navy-900">Resources &amp; endpoints</div>
        <p className="text-xs text-slate-400">Every live surface in the running stack.</p>
      </div>
      <ul className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
        {ENDPOINTS.map((e) => (
          <li key={e.label} className="flex flex-col gap-0.5 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">{e.label}</span>
              <a
                href={e.href}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-xs text-navy-600 hover:underline"
                title={e.href}
              >
                {e.href.replace(/^https?:\/\//, "")}
              </a>
            </div>
            <span className="text-xs text-slate-400">{e.hint}</span>
          </li>
        ))}
        {EXPLORER_URL === "" ? (
          <li className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Block explorer</span>
            <span className="text-xs text-slate-400">Local anvil has no explorer; set <span className="font-mono">VITE_EXPLORER_URL</span> (Fuji uses Snowtrace).</span>
          </li>
        ) : null}
      </ul>
    </Card>
  );
}
