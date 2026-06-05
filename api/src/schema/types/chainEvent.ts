// On-Chain Layer · GraphQL ChainEvent type — the canonical event log surfaced live · #39
// chain_events is the append-only input deterministic replay folds. Exposing recent events
// lets the Health view show a live feed of on-chain activity (PositionOpened, Transfer,
// InterestClaimed) — the contract layer made visible in real time.
import { builder } from "../builder.ts";

export interface ChainEventSource {
  id: string;
  name: string;
  blockNumber: number;
  logIndex: number;
  summary: string;    // #39 human-readable line derived from payload (e.g. "Loan #1 · 0xABCD invested $100")
  ingestedAt: Date;
}

export const ChainEvent = builder.simpleObject("ChainEvent", {
  fields: (t) => ({
    id: t.id({ nullable: false }),
    name: t.string({ nullable: false }),
    blockNumber: t.int({ nullable: false }),
    logIndex: t.int({ nullable: false }),
    summary: t.string({ nullable: false }),
    ingestedAt: t.field({ type: "DateTime", nullable: false }),
  }),
});
