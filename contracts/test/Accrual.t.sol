// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ComplianceRegistry} from "../src/ComplianceRegistry.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ICreditToken} from "../src/interfaces/ICreditToken.sol";
import {IComplianceRegistry} from "../src/interfaces/IComplianceRegistry.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {InsufficientReserve} from "../src/Errors.sol";

// #9 attacker reserve: re-enters claim() on transfer. CreditToken.claim is
// nonReentrant + checks-effects-interactions, so the re-entry must be repelled.
contract MaliciousReserve is ERC20 {
    CreditToken public token;
    bool internal attacking;

    constructor() ERC20("Evil", "EVL") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setToken(CreditToken t) external {
        token = t;
    }

    // On payout transfer, attempt to re-enter claim(). The guard makes this revert.
    function _update(address from, address to, uint256 value) internal override {
        if (address(token) != address(0) && !attacking && from == address(token)) {
            attacking = true;
            token.claim(); // re-entry attempt -> ReentrancyGuardReentrantCall
        }
        super._update(from, to, value);
    }
}

// #9 accrual + reentrancy-safe claim unit + property coverage. Matrix rows 7
// (funded claim), 8 (InsufficientReserve), 9 (frozen accrual stops).
contract AccrualTest is Test {
    IdentityRegistry internal id;
    ComplianceRegistry internal compliance;
    CreditToken internal token;
    MockUSDC internal reserve;

    address internal admin = address(0xA11CE);
    address internal holder = address(0x11);
    uint256 internal constant LOAN_ID = 1;
    // rate chosen tiny: visible accrual without overflow at 365-day warps.
    uint256 internal constant RATE = 1e9; // per second, scaled by RATE_SCALE (1e18)

    function setUp() public {
        id = new IdentityRegistry(admin);
        compliance = new ComplianceRegistry(admin, address(id), IComplianceRegistry.Offering.RegD);
        reserve = new MockUSDC();
        token = new CreditToken(admin, address(id), address(compliance), address(reserve), RATE);

        vm.prank(admin);
        id.setClaims(holder, IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        vm.prank(admin);
        token.mint(holder, LOAN_ID, 100_000e6);
    }

    // #9 accrual grows over time while PERFORMING.
    function test_accrual_growsOverTime() public {
        assertEq(token.claimable(holder), 0);
        vm.warp(block.timestamp + 30 days);
        assertGt(token.claimable(holder), 0);
    }

    // #9 matrix row 7: funded claim emits InterestClaimed, debits reserve by owed,
    // resets accrued to 0 in the same tx.
    function test_claim_funded_debitsReserve_resetsAccrued() public {
        vm.warp(block.timestamp + 30 days);
        uint256 owed = token.claimable(holder);
        assertGt(owed, 0);
        reserve.mint(address(token), owed * 2); // fund generously

        uint256 reserveBefore = reserve.balanceOf(address(token));
        vm.expectEmit(true, false, false, true);
        emit ICreditToken.InterestClaimed(holder, LOAN_ID, owed);
        vm.prank(holder);
        token.claim();

        assertEq(reserve.balanceOf(holder), owed);
        assertEq(reserve.balanceOf(address(token)), reserveBefore - owed);
        assertEq(token.claimable(holder), 0); // accrued reset (status still accruing but dt~0)
    }

    // #9 matrix row 8: underfunded reserve reverts InsufficientReserve(owed, bal)
    // with EXACT args.
    function test_claim_underfunded_revertsInsufficientReserve() public {
        vm.warp(block.timestamp + 30 days);
        uint256 owed = token.claimable(holder);
        assertGt(owed, 0);
        uint256 bal = owed - 1; // one short
        reserve.mint(address(token), bal);

        vm.expectRevert(abi.encodeWithSelector(InsufficientReserve.selector, owed, bal));
        vm.prank(holder);
        token.claim();
    }

    // #9 matrix row 9: freezeAccrual stops further accrual — claimable flat across
    // a subsequent warp.
    function test_freezeAccrual_stopsAccrual() public {
        vm.warp(block.timestamp + 10 days);
        uint256 before = token.claimable(holder);
        assertGt(before, 0);

        vm.expectEmit(true, false, false, false);
        emit ICreditToken.AccrualFrozen(LOAN_ID);
        vm.prank(admin);
        token.freezeAccrual(LOAN_ID);

        vm.warp(block.timestamp + 100 days);
        assertEq(token.claimable(holder), before); // flat: no accrual after freeze
    }

    // #9 DEFAULT status halts accrual (no accrual when DEFAULT).
    function test_defaultStatus_stopsAccrual() public {
        vm.warp(block.timestamp + 10 days);
        uint256 before = token.claimable(holder);
        vm.prank(admin);
        token.setLoanStatus(LOAN_ID, ICreditToken.LoanStatus.DEFAULT);
        vm.warp(block.timestamp + 100 days);
        assertEq(token.claimable(holder), before);
    }

    // #9 DELINQUENT still accrues (only DEFAULT halts).
    function test_delinquentStatus_stillAccrues() public {
        vm.prank(admin);
        token.setLoanStatus(LOAN_ID, ICreditToken.LoanStatus.DELINQUENT);
        vm.warp(block.timestamp + 10 days);
        assertGt(token.claimable(holder), 0);
    }

    // #9 reentrancy: a malicious reserve that re-enters claim on transfer is
    // repelled by nonReentrant — the whole claim reverts.
    function test_claim_reentrancy_repelled() public {
        MaliciousReserve evil = new MaliciousReserve();
        CreditToken t = new CreditToken(admin, address(id), address(compliance), address(evil), RATE);
        evil.setToken(t);

        vm.prank(admin);
        t.mint(holder, LOAN_ID, 100_000e6);
        vm.warp(block.timestamp + 30 days);
        uint256 owed = t.claimable(holder);
        evil.mint(address(t), owed * 2);

        // The re-entry inside transfer trips the guard; OZ bubbles the inner
        // ReentrancyGuardReentrantCall so the outer claim reverts.
        vm.prank(holder);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        t.claim();

        // State unchanged: holder got nothing, accrued not zeroed.
        assertEq(evil.balanceOf(holder), 0);
        assertGt(t.claimable(holder), 0);
    }

    // #9 AC3: fuzz — accrual is monotonic non-decreasing in elapsed time while
    // PERFORMING. >=256 runs (foundry.toml fuzz.runs = 256).
    function testFuzz_accrual_monotonicInTime(uint256 elapsed1, uint256 elapsed2) public {
        elapsed1 = bound(elapsed1, 0, 365 days);
        elapsed2 = bound(elapsed2, 0, 365 days);
        uint256 t0 = block.timestamp;
        vm.warp(t0 + elapsed1);
        uint256 c1 = token.claimable(holder);
        vm.warp(t0 + elapsed1 + elapsed2); // strictly >= previous time
        uint256 c2 = token.claimable(holder);
        assertGe(c2, c1);
    }

    // #9 AC4: invariant-style property — settled+pending claimable for the sole
    // holder is covered by the reserve once funded to that level. (The scaled
    // multi-holder stateful invariant lives in #11.)
    function test_claimable_neverExceedsFundedReserve() public {
        vm.warp(block.timestamp + 200 days);
        uint256 owed = token.claimable(holder);
        reserve.mint(address(token), owed);
        assertLe(token.claimable(holder), reserve.balanceOf(address(token)));
        vm.prank(holder);
        token.claim(); // succeeds exactly at the boundary
        assertEq(reserve.balanceOf(holder), owed);
    }
}
