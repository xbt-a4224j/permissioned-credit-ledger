// #25 the invest/claim/transfer flow — the UI mirror of scripts/verify_matrix.ts.
// A table test over the matrix rows: rows {3,6} (invest path), {4,5} (transfer path), {8} (claim
// path) must each render the matching typed ReasonBadge and NO success state; rows {1,2} (invest OK)
// and {7} (claim OK) must render a confirmed/success chip and NO badge. The GraphQL boundary is
// mocked (gql) so the test drives the typed extensions.code path without a chain.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { Loan, Position } from "./types.ts";
import type { WalletApi } from "./lib/wallet.ts";
import { REASON_META, type ReasonCode } from "./lib/reasonCodes.ts";

// #25 mock the gql client: a typed revert is a thrown GraphqlCodeError; a success resolves a ref.
// The error class is defined INSIDE the (hoisted) factory; the test imports it back from the mock.
const gqlMock = vi.fn();
vi.mock("./lib/graphqlClient.ts", () => {
  class GraphqlCodeError extends Error {
    code: string | null;
    constructor(message: string, code: string | null) {
      super(message);
      this.code = code;
    }
  }
  return { gql: (...a: unknown[]) => gqlMock(...a), GraphqlCodeError };
});

import { GraphqlCodeError } from "./lib/graphqlClient.ts";
import { InvestDialog } from "./components/InvestDialog.tsx";
import { ClaimPanel } from "./components/ClaimPanel.tsx";
import { TransferDialog } from "./components/TransferDialog.tsx";
import { InvestAction } from "./components/InvestAction.tsx";

afterEach(() => {
  cleanup();
  gqlMock.mockReset();
});

// #25 a connected wallet stub (ensureChain is a no-op; address present so actions are enabled).
const wallet: WalletApi = {
  address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  chainId: 0x7a69,
  connect: async () => {},
  ensureChain: async () => {},
  selectDemoIdentity: () => {},
  isDemo: false,
};

const loan: Loan = {
  id: "1" as Loan["id"],
  principal: 1_000_000n,
  subscribed: 0n,
  ratePerSecond: 1000n,
  ltvBps: 6500,
  dscrBps: 12500,
  status: "Active",
  collateralType: "CRE",
  dataRoomUri: null,
};
const position: Position = {
  id: "1:0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as Position["id"],
  loanId: "1" as Loan["id"],
  holder: wallet.address as Position["holder"],
  principal: 5_000_000n,
  accrued: 1_000_000n,
  claimable: 1_000_000n,
};

// #25 make gql throw a typed revert (the extensions.code path).
function mockRevert(code: ReasonCode): void {
  gqlMock.mockRejectedValue(new GraphqlCodeError(code, code));
}
// #25 make gql resolve a confirmed receipt for the given mutation field.
function mockOk(field: "invest" | "transfer" | "claim"): void {
  gqlMock.mockResolvedValue({ [field]: { hash: "0xabc", state: "CONFIRMED", reasonCode: null, blockNumber: "1", position: null } });
}

// the matrix rows under test, each mapped to a (kind, expectation).
interface Row {
  row: number;
  kind: "invest" | "transfer" | "claim";
  code?: ReasonCode;
}
const ROWS: Row[] = [
  { row: 1, kind: "invest" },
  { row: 2, kind: "invest" },
  { row: 3, kind: "invest", code: "NotEligible" },
  { row: 6, kind: "invest", code: "AccreditationRequired" },
  { row: 4, kind: "transfer", code: "ReceiverFrozen" },
  { row: 5, kind: "transfer", code: "ReceiverNotVerified" },
  { row: 7, kind: "claim" },
  { row: 8, kind: "claim", code: "InsufficientReserve" },
];

function renderFlow(kind: Row["kind"]): void {
  if (kind === "invest") render(<InvestDialog loan={loan} wallet={wallet} onClose={() => {}} />);
  else if (kind === "transfer") render(<TransferDialog position={position} wallet={wallet} onClose={() => {}} />);
  else render(<ClaimPanel position={position} wallet={wallet} />);
}

async function fireAction(kind: Row["kind"]): Promise<void> {
  if (kind === "transfer") {
    fireEvent.change(screen.getByPlaceholderText("0x…"), {
      target: { value: "0x90f79bf6eb2c4f870365e785982e1f101e93b906" },
    });
  }
  const label = kind === "invest" ? "Invest" : kind === "transfer" ? "Transfer" : "Claim";
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("wallet gating", () => {
  it("disables the Invest button with a tooltip until a wallet is connected", () => {
    const noWallet: WalletApi = { connect: async () => {}, ensureChain: async () => {}, selectDemoIdentity: () => {}, isDemo: false };
    render(<InvestAction loan={loan} wallet={noWallet} />);
    const btn = screen.getByRole("button", { name: "Invest" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Select an identity to invest");
  });
});

describe("invest/claim/transfer flows (matrix mirror)", () => {
  it.each(ROWS)("row $row ($kind) -> $code | confirmed", async (r) => {
    if (r.code !== undefined) mockRevert(r.code);
    else mockOk(r.kind);
    renderFlow(r.kind);
    await fireAction(r.kind);

    if (r.code !== undefined) {
      // the typed ReasonBadge appears; no success copy renders.
      await waitFor(() => expect(screen.getByText(REASON_META[r.code!].label)).toBeInTheDocument());
      expect(screen.queryAllByText(/Confirmed|Position opened|InterestClaimed/)).toHaveLength(0);
    } else {
      // a success/confirmed state renders; no reason badge.
      await waitFor(() => expect(screen.queryAllByText(/Confirmed|Position opened|InterestClaimed/).length).toBeGreaterThan(0));
      for (const c of Object.values(REASON_META)) expect(screen.queryByText(c.label)).not.toBeInTheDocument();
    }
  });
});
