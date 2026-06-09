// Live block + event log panel · #39
// Polls chainEvents + currentBlock every 2s so the Health view shows a real-time feed of
// on-chain activity: block counter ticking, PositionOpened/Transfer/InterestClaimed as they land.
import { useEffect, useRef, useState } from "react";
import { gql } from "../lib/graphqlClient.ts";
import { Card } from "./primitives.tsx";

interface ChainEventRow {
  id: string;
  name: string;
  blockNumber: number;
  summary: string;
  ingestedAt: string;
}

const QUERY = /* GraphQL */ `
  query ChainActivity {
    currentBlock
    chainEvents(limit: 20) { id name blockNumber summary ingestedAt }
  }
`;

// #39 short name badge colour per event type.
function eventTone(name: string): string {
  if (name === "PositionOpened") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (name === "InterestClaimed") return "bg-blue-50 text-blue-700 border-blue-200";
  if (name === "Transfer") return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function ChainActivity(): JSX.Element {
  const [block, setBlock] = useState<number | null>(null);
  const [events, setEvents] = useState<ChainEventRow[]>([]);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const fetch = async (): Promise<void> => {
      try {
        const data = await gql<{ currentBlock: number; chainEvents: ChainEventRow[] }>(QUERY);
        if (!alive) return;
        setBlock(data.currentBlock);
        setEvents(data.chainEvents);
        setError(false);
      } catch {
        if (alive) setError(true);
      }
      if (alive) timerRef.current = setTimeout(() => void fetch(), 1000); // #41 1s poll so the block counter ticks live
    };
    void fetch();
    return () => {
      alive = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-navy-900">Chain activity</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {error ? (
            <span className="text-rose-600">feed error</span>
          ) : block !== null ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-tabular tabular-nums text-slate-700">block {block.toLocaleString()}</span>
            </>
          ) : (
            <span>connecting…</span>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          No events yet — invest or claim to see activity here.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
              <span
                className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${eventTone(ev.name)}`}
              >
                {ev.name}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-800">{ev.summary}</div>
                <div className="mt-0.5 font-tabular text-xs tabular-nums text-slate-400">
                  block {ev.blockNumber}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
