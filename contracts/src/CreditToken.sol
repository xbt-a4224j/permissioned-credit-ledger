// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICreditToken} from "./interfaces/ICreditToken.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ReceiverNotVerified, InsufficientReserve, ExceedsPrincipal} from "./Errors.sol";

// #8/#66 CreditToken — ERC-3643-lite permissioned security token representing a single
// loan series. Every balance change routes through the OZ v5 `_update` hook, the
// single chokepoint where the permissioning check runs: the recipient must be
// KYC-verified, else ReceiverNotVerified (matrix row 3). Issuer-gated mint/burn.
// #9 accrual (accrued = balance * ratePerSecond * elapsed, gated by loan status —
// no accrual at DEFAULT) + reentrancy-safe claim() paying from the mock-USDC
// reserve (checks-effects-interactions + ReentrancyGuard).
contract CreditToken is ERC20, AccessControl, ReentrancyGuard, ICreditToken {
    using SafeERC20 for IERC20;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // #8/#66 the identity registry the permissioning check consults (verified-only).
    IIdentityRegistry public immutable identity;

    // #9 the mock-USDC reserve claim() pays interest from.
    IERC20 public immutable reserve;
    // #5 the loan's principal — the hard cap on total issuance. mint() rejects any
    // amount that would push totalSupply past it, ON-CHAIN (the chain is the sole
    // authority for how much of a loan exists; an off-chain cap would lag and race).
    uint256 public immutable principalCap;
    // #9 per-second interest rate, scaled by RATE_SCALE; accrued = bal*rate*dt/SCALE.
    uint256 public ratePerSecond;

    // #9 fixed-point scale for ratePerSecond so a tiny rate is expressible and
    // 365-day warps don't overflow at the seeded principal sizes (#11/#12).
    uint256 public constant RATE_SCALE = 1e18;

    // #8 holder -> loanId opened on mint (single loan series, single loanOf).
    mapping(address => uint256) public loanOf;

    // #8 loan-series status; #9 gates accrual on it (no accrual at DEFAULT).
    LoanStatus public status;
    // #9 NAV-anomaly freeze (matrix row 9): once set, accrual stops for everyone.
    bool public accrualFrozen;
    // #9 loan-wide instant accrual halted (freeze or DEFAULT), 0 while accruing.
    // Interest earned BEFORE this instant is preserved lazily for every holder;
    // interest after it is excluded — without eagerly settling each holder.
    uint64 public accrualEndsAt;

    // #9 cumulative seconds the series has spent in FINALIZED halt windows — each
    // DEFAULT -> resume folds its span in here on resume. Subtracted from a
    // holder's elapsed so a resumed loan never accrues over the halted gap, even
    // for a holder left unsettled across the whole halt — without enumerating holders.
    uint64 public haltedElapsed;

    // #9 per-holder accrual bookkeeping.
    struct Accrual {
        uint64 lastAccruedAt; // accrual-clock instant of last settle
        uint64 haltedSnapshot; // haltedElapsed captured at that settle
        uint256 accrued; // settled-but-unclaimed interest
    }

    mapping(address => Accrual) public accruals;

    constructor(address admin, address identityReg, address reserveToken, uint256 ratePerSecond_, uint256 principalCap_)
        ERC20("Credit Token", "CRDT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        identity = IIdentityRegistry(identityReg);
        reserve = IERC20(reserveToken);
        ratePerSecond = ratePerSecond_;
        principalCap = principalCap_;
    }

    // #8 6 decimals to match the mock-USDC reserve.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // #8 issuer-gated issuance: opens a position and emits PositionOpened. The
    // permissioning check still runs on the recipient via _update (mint path), so
    // minting to an unverified address reverts ReceiverNotVerified (matrix row 3).
    function mint(address to, uint256 loanId, uint256 amount) external onlyRole(ISSUER_ROLE) {
        // #5 issuance cap: never mint more of a loan than its principal. Enforced here, on-chain,
        // because totalSupply is the authoritative record of how much exists — checked and applied
        // in one transaction, so it can't be raced the way a read-then-write off-chain guard can.
        uint256 newSupply = totalSupply() + amount;
        if (newSupply > principalCap) revert ExceedsPrincipal(newSupply, principalCap);
        loanOf[to] = loanId;
        _mint(to, amount);
        emit PositionOpened(to, loanId, amount);
    }

    // #8 issuer-gated clawback; bypasses the gauntlet by design (burn path in
    // _update skips checks) so a frozen holder's tokens can still be reclaimed.
    function burn(address from, uint256 amount) external onlyRole(ISSUER_ROLE) {
        _burn(from, amount);
    }

    // #9 issuer sets loan status; emits LoanStatusChanged. DEFAULT halts accrual
    // by stamping accrualEndsAt (preserving interest earned up to that instant),
    // mirroring the off-chain status replay. Re-activating clears the halt only if
    // it was a status-driven (not NAV-frozen) halt.
    function setLoanStatus(uint256 loanId, LoanStatus newStatus) external onlyRole(ISSUER_ROLE) {
        if (newStatus == LoanStatus.DEFAULT && accrualEndsAt == 0) {
            accrualEndsAt = uint64(block.timestamp);
        } else if (newStatus != LoanStatus.DEFAULT && !accrualFrozen && accrualEndsAt != 0) {
            // resume: fold the just-ended halt span into haltedElapsed before clearing,
            // so holders unsettled across it skip the gap (NAV freeze stays sticky).
            haltedElapsed += uint64(block.timestamp) - accrualEndsAt;
            accrualEndsAt = 0;
        }
        status = newStatus;
        emit LoanStatusChanged(loanId, newStatus);
    }

    // #9 NAV-anomaly hook (matrix row 9): freeze accrual for the series at now,
    // preserving already-earned interest. Sticky (never auto-resumes).
    function freezeAccrual(uint256 loanId) external onlyRole(ISSUER_ROLE) {
        accrualFrozen = true;
        if (accrualEndsAt == 0) accrualEndsAt = uint64(block.timestamp);
        emit AccrualFrozen(loanId);
    }

    // #9 effective end-instant for accrual: now while live, else the frozen/DEFAULT
    // halt instant. Interest is computed up to this clock so a halt preserves
    // pre-halt earnings for every holder without eager per-holder settlement.
    function _accrualClock() internal view returns (uint64) {
        return accrualEndsAt == 0 ? uint64(block.timestamp) : accrualEndsAt;
    }

    // #9 fold elapsed interest into the holder's settled `accrued` and stamp the
    // clock. Called from _update BEFORE balances move (snapshots the pre-change
    // balance) and at the top of claim().
    function _settleAccrual(address holder) internal {
        Accrual storage a = accruals[holder];
        uint64 clock = _accrualClock();
        if (a.lastAccruedAt == 0) {
            a.lastAccruedAt = uint64(block.timestamp);
            a.haltedSnapshot = haltedElapsed;
            return;
        }
        if (clock > a.lastAccruedAt) {
            uint64 span = clock - a.lastAccruedAt;
            uint64 halted = haltedElapsed - a.haltedSnapshot; // halt that fell inside the span
            uint64 elapsed = span > halted ? span - halted : 0;
            a.accrued += (balanceOf(holder) * ratePerSecond * elapsed) / RATE_SCALE;
        }
        // Stamp the accrual clock (not wall-clock) plus the halt accumulator so the
        // next settle measures from here and never re-counts the halted gap.
        a.lastAccruedAt = clock;
        a.haltedSnapshot = haltedElapsed;
    }

    // #9 settled-as-of-now claimable: settled `accrued` plus the not-yet-folded
    // pending slice up to the accrual clock (no state write). Matrix rows 7/8 read this.
    function claimable(address holder) public view returns (uint256) {
        Accrual storage a = accruals[holder];
        uint256 total = a.accrued;
        uint64 clock = _accrualClock();
        if (a.lastAccruedAt != 0 && clock > a.lastAccruedAt) {
            uint64 span = clock - a.lastAccruedAt;
            uint64 halted = haltedElapsed - a.haltedSnapshot;
            uint64 elapsed = span > halted ? span - halted : 0;
            total += (balanceOf(holder) * ratePerSecond * elapsed) / RATE_SCALE;
        }
        return total;
    }

    // #9 reentrancy-safe claim — checks-effects-interactions PLUS nonReentrant.
    // settle -> read owed -> check reserve -> ZERO accrued (effect) -> transfer
    // (interaction). Reverts InsufficientReserve(owed, bal) when underfunded (row 8).
    function claim() external nonReentrant {
        _settleAccrual(msg.sender);
        uint256 owed = accruals[msg.sender].accrued;
        uint256 bal = reserve.balanceOf(address(this));
        if (owed > bal) revert InsufficientReserve(owed, bal);
        accruals[msg.sender].accrued = 0; // effect before interaction
        reserve.safeTransfer(msg.sender, owed); // interaction last
        emit InterestClaimed(msg.sender, loanOf[msg.sender], owed);
    }

    // #8/#66 THE chokepoint — every mint/transfer/burn funnels here. The permissioning
    // check requires the recipient (mint recipient + transfer receiver) to be verified,
    // else ReceiverNotVerified; burns (to == 0) skip it so issuer clawback works.
    // super._update runs LAST so a reverting check never mutates balances. #9: settle
    // both parties' accrual on the PRE-change balance first.
    function _update(address from, address to, uint256 amount) internal override {
        if (to != address(0) && !identity.isVerified(to)) {
            revert ReceiverNotVerified(to);
        }
        // Settle on pre-change balances so the slice up to now is captured before
        // the transfer shifts principal between holders.
        if (from != address(0)) _settleAccrual(from);
        if (to != address(0)) _settleAccrual(to);
        super._update(from, to, amount);
    }
}
