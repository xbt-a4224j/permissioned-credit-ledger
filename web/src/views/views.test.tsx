// #24 view rendering — Marketplace renders >=6 cards w/ LTV+DSCR; the dashboard ticker lives + freezes.
// Mocks the gql() client (the GraphQL boundary) and a synthetic EventSource so the views render off
// fixture data without a running API. Asserts the AC: >=6 LoanCards with visible LTV/DSCR, a live
// SSE accrual frame updates the claimable, and the frozen flag stops the ticker (row-9 setup).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, cleanup, within } from "@testing-library/react";
import type { IdentityAddr } from "../types.ts";

// #24 mock the single gql client. resolveValue is swapped per test.
const gqlMock = vi.fn();
vi.mock("../lib/graphqlClient.ts", () => ({ gql: (...a: unknown[]) => gqlMock(...a), GraphqlCodeError: class {} }));

import { MarketplaceView } from "./MarketplaceView.tsx";
import { PositionDashboardView } from "./PositionDashboardView.tsx";

// #24 a synthetic EventSource so the dashboard's useAccrualStream has a frame to consume.
class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  private listeners = new Map<string, ((ev: MessageEvent) => void)[]>();
  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (ev: MessageEvent) => void): void {
    const a = this.listeners.get(type) ?? [];
    a.push(fn);
    this.listeners.set(type, a);
  }
  emit(type: string, data: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn({ data } as MessageEvent);
  }
  close(): void {}
}

beforeEach(() => {
  gqlMock.mockReset();
  MockEventSource.instances = [];
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
});
afterEach(cleanup);

// #24 a seeded loan tape: 5 CRE (#1-#5) + 1 RESIDENTIAL (#6) == the scope cap.
function loanTape(): { loans: unknown[] } {
  return {
    loans: Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      principal: String(1_000_000n * BigInt(i + 1)),
      subscribed: String(250_000n * BigInt(i + 1)), // a quarter taken — Unsubscribed must render
      ratePerSecond: "1000",
      ltvBps: 6500 + i * 200,
      dscrBps: 12000 + i * 250,
      status: "Active",
      dataRoomUri: null,
    })),
  };
}

describe("MarketplaceView", () => {
  it("renders >=6 loan cards with visible LTV and DSCR", async () => {
    gqlMock.mockResolvedValue(loanTape());
    render(<MarketplaceView />);
    // 6 loan series headings render once data resolves.
    const series = await screen.findAllByText(/^#\d+$/);
    expect(series.length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText("LTV").length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText("DSCR").length).toBeGreaterThanOrEqual(6);
    // the seam is visible: the residential card carries its badge.
    expect(screen.getByText("RESIDENTIAL")).toBeInTheDocument();
    expect(screen.getAllByText("CRE").length).toBe(5);
  });

  it("shows the error state with a retry on a failed query", async () => {
    gqlMock.mockRejectedValue(new Error("api down"));
    render(<MarketplaceView />);
    expect(await screen.findByText("Could not load data")).toBeInTheDocument();
  });
});

describe("PositionDashboardView", () => {
  const holder = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as IdentityAddr;
  function positions(): { positions: unknown[] } {
    return {
      positions: [
        { id: "1:0x70997970c51812dc3a010c7d01b50e0d17dc79c8", loanId: "1", holder, principal: "5000000", accrued: "1000000", claimable: "1000000" },
      ],
    };
  }

  it("updates claimable when an accrual SSE frame arrives, and freezes when frozen", async () => {
    gqlMock.mockResolvedValue(positions());
    render(<PositionDashboardView holder={holder} />);
    await screen.findByText("$1.0000");

    const es = MockEventSource.instances[0]!;
    act(() =>
      es.emit(
        "accrual",
        JSON.stringify({ loanId: "1", holder, accrued: "1000000", claimable: "2500000", at: new Date(1_700_000_000_000).toISOString() }),
      ),
    );
    expect(await screen.findByText("$2.5000")).toBeInTheDocument();
  });

  it("freezes the ticker (shows last claimable, Frozen badge) when globalFrozen is set", async () => {
    gqlMock.mockResolvedValue(positions());
    render(<PositionDashboardView holder={holder} globalFrozen />);
    const cell = await screen.findByText("$1.0000");
    expect(cell).toBeInTheDocument();
    // a frozen accrual frame must NOT advance the displayed value.
    const es = MockEventSource.instances[0]!;
    act(() =>
      es.emit(
        "accrual",
        JSON.stringify({ loanId: "1", holder, accrued: "1000000", claimable: "9999999", at: new Date(1_700_000_000_000).toISOString() }),
      ),
    );
    expect(screen.queryByText("$9.9999")).not.toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /#1/ })).getByText("Frozen")).toBeInTheDocument();
  });

  it("shows the empty state for a holder with no positions", async () => {
    gqlMock.mockResolvedValue({ positions: [] });
    render(<PositionDashboardView holder={holder} />);
    expect(await screen.findByText("No open positions for this holder.")).toBeInTheDocument();
  });
});
