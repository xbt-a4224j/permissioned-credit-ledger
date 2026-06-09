// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// #5 credit token interface — the on-chain claimable balance the
// reconciliation engine validates against off-chain servicing cash. Declares the
// event/selector surface the indexer (#16) decodes and the claim/mint/burn
// entrypoints. ABI pinned before CreditToken implementation (#8/#9).
interface ICreditToken {
    // #5 loan-series lifecycle: accrual runs while PERFORMING/DELINQUENT and
    // halts at DEFAULT (no accrual when DEFAULT). Single loan series per token.
    enum LoanStatus {
        PERFORMING,
        DELINQUENT,
        DEFAULT
    }

    // #5 emitted on mint — the position the indexer backfills (matrix rows 1,2).
    event PositionOpened(address indexed holder, uint256 loanId, uint256 amount);
    // #5 emitted on a funded claim (matrix row 7).
    event InterestClaimed(address indexed holder, uint256 loanId, uint256 amount);
    // #5 NAV-anomaly hook: accrual frozen for the series (matrix row 9).
    event AccrualFrozen(uint256 indexed loanId);
    // #5 loan status transition (drives the off-chain accrual-gate replay).
    event LoanStatusChanged(uint256 indexed loanId, LoanStatus status);

    // #5 settled-as-of-now claimable interest for a holder.
    function claimable(address holder) external view returns (uint256);
    // #5 reentrancy-safe settle -> zero -> pay from reserve (#9).
    function claim() external;
    // #5 issuer-gated issuance; opens a position and emits PositionOpened.
    function mint(address to, uint256 loanId, uint256 amount) external;
    // #5 issuer-gated clawback; bypasses the gauntlet by design.
    function burn(address from, uint256 amount) external;
}
