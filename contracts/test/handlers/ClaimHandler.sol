// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CreditToken} from "../../src/CreditToken.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";

// #11 invariant handler — drives mint / warpTime / claim / fundReserve against the
// real CreditToken under the fuzzer, bounding actors to the seeded identities and
// every numeric input via bound(). Maintains ghost totals (funded / claimed) and a
// call counter so the invariant suite can prove the handler actually ran (a
// handler whose selectors aren't wired silently passes every invariant — landmine).
contract ClaimHandler is Test {
    CreditToken public token;
    MockUSDC public reserve;
    address public admin;

    // #11/#66 bounded actor set: the 2 verified holders the token admits.
    address[2] public holders;

    // #11 ghost accounting for conservation invariants.
    uint256 public ghostTotalFunded; // total mock-USDC ever put in the reserve
    uint256 public ghostTotalClaimed; // total ever paid out via claim()
    uint256 public callCount; // proves the handler was exercised

    constructor(CreditToken token_, MockUSDC reserve_, address admin_, address[2] memory holders_) {
        token = token_;
        reserve = reserve_;
        admin = admin_;
        holders = holders_;
    }

    // #11 helper: sum settled+pending claimable over the bounded holder set.
    function totalClaimable() public view returns (uint256 sum) {
        for (uint256 i = 0; i < holders.length; i++) {
            sum += token.claimable(holders[i]);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return holders[seed % holders.length];
    }

    // #11/#66 mint a bounded position to a verified holder the token admits. Both
    // holders are verified, so every mint lands rather than reverting.
    function mint(uint256 actorSeed, uint256 amount) external {
        callCount++;
        address to = _actor(actorSeed);
        amount = bound(amount, 1e6, 1_000_000e6);
        vm.prank(admin);
        token.mint(to, 1, amount);
    }

    // #11 advance time by a bounded delta, then top the reserve up to cover all
    // current claimable — models a solvent servicer so claimable<=reserve stays a
    // genuine check on the claim accounting (not on funding timing).
    function warpTime(uint256 delta) external {
        callCount++;
        delta = bound(delta, 1, 30 days);
        vm.warp(block.timestamp + delta);
        uint256 need = totalClaimable();
        uint256 have = reserve.balanceOf(address(token));
        if (need > have) {
            uint256 top = need - have;
            reserve.mint(address(token), top);
            ghostTotalFunded += top;
        }
    }

    // #11 explicit extra funding action (independent of warp top-up).
    function fundReserve(uint256 amount) external {
        callCount++;
        amount = bound(amount, 0, 1_000_000e6);
        reserve.mint(address(token), amount);
        ghostTotalFunded += amount;
    }

    // #11 a seeded holder claims; record the payout in the ghost total.
    function claim(uint256 actorSeed) external {
        callCount++;
        address who = _actor(actorSeed);
        uint256 before = reserve.balanceOf(who);
        vm.prank(who);
        token.claim();
        ghostTotalClaimed += reserve.balanceOf(who) - before;
    }
}
