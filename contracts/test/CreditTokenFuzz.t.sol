// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

// #11 fuzz suite — accrual is monotonic non-decreasing in elapsed time while
// PERFORMING, a frozen/DEFAULT loan does not accrue, and a funded claim transfers
// exactly the accrued amount and never more. >=256 runs per property
// (foundry.toml fuzz.runs = 256). Every fuzzed input is bound().
contract CreditTokenFuzzTest is Test {
    IdentityRegistry internal id;
    MockUSDC internal reserve;

    address internal admin = address(0xA11CE);
    address internal holder = address(0x11);
    uint256 internal constant LOAN_ID = 1;

    function setUp() public {
        id = new IdentityRegistry(admin);
        reserve = new MockUSDC();
        vm.prank(admin);
        id.setClaims(holder, IIdentityRegistry.Claims(true));
    }

    // #11 deploy a token with a chosen per-second rate + mint a position to holder.
    function _tokenWith(uint256 ratePerSecond, uint256 principal) internal returns (CreditToken t) {
        t = new CreditToken(admin, address(id), address(reserve), ratePerSecond, principal);
        vm.prank(admin);
        t.mint(holder, LOAN_ID, principal);
    }

    // #11 AC4 (the fuzz): claimable(t2) >= claimable(t1) for t2 >= t1 while
    // PERFORMING. Integer truncation only ever loses value, so monotonicity holds.
    function testFuzz_accrual_monotonicInTime(uint256 principal, uint256 ratePerSecond, uint256 elapsed1, uint256 step)
        public
    {
        principal = bound(principal, 1e6, 1_000_000e6);
        ratePerSecond = bound(ratePerSecond, 1, 1e12);
        elapsed1 = bound(elapsed1, 0, 365 days);
        step = bound(step, 0, 365 days);

        CreditToken t = _tokenWith(ratePerSecond, principal);
        uint256 t0 = block.timestamp;
        vm.warp(t0 + elapsed1);
        uint256 c1 = t.claimable(holder);
        vm.warp(t0 + elapsed1 + step); // t2 >= t1
        uint256 c2 = t.claimable(holder);
        assertGe(c2, c1);
    }

    // #11 a frozen (NAV-anomaly) loan does not accrue past the freeze instant —
    // pins the on-chain side of NavAnomaly accrual-freeze (matrix row 9).
    function testFuzz_accrual_frozenLoanDoesNotAccrue(uint256 ratePerSecond, uint256 warmup, uint256 elapsed) public {
        ratePerSecond = bound(ratePerSecond, 1, 1e12);
        warmup = bound(warmup, 0, 365 days);
        elapsed = bound(elapsed, 1, 365 days);

        CreditToken t = _tokenWith(ratePerSecond, 1_000_000e6);
        vm.warp(block.timestamp + warmup);
        vm.prank(admin);
        t.freezeAccrual(LOAN_ID);
        uint256 frozenAt = t.claimable(holder);
        vm.warp(block.timestamp + elapsed);
        assertEq(t.claimable(holder), frozenAt); // flat after freeze
    }

    // #11 a funded claim transfers exactly accrued and never more; post-claim
    // claimable settles to ~0 (only the same-block sliver, which is 0 here).
    function testFuzz_claim_neverExceedsAccrued(uint256 principal, uint256 elapsed) public {
        principal = bound(principal, 1e6, 1_000_000e6);
        elapsed = bound(elapsed, 1, 365 days);

        CreditToken t = _tokenWith(1e9, principal);
        vm.warp(block.timestamp + elapsed);
        uint256 owed = t.claimable(holder);
        reserve.mint(address(t), owed + 1e6); // over-fund

        uint256 before = reserve.balanceOf(holder);
        vm.prank(holder);
        t.claim();
        uint256 paid = reserve.balanceOf(holder) - before;

        assertEq(paid, owed); // exactly accrued, never more
        assertEq(t.claimable(holder), 0); // reset (no time passed since settle)
    }
}
