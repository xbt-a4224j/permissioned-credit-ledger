// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SeedIdentities} from "./helpers/SeedIdentities.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {ReceiverNotVerified, ExceedsPrincipal} from "../src/Errors.sol";

// #65/#66 runtime-deploy contract proof. The tokenizeLoan mutation deploys a NEW CreditToken at
// runtime with the same constructor wiring as the seeded 6 (admin, identityRegistry, reserve,
// ratePerSecond, principalCap). This pins that a token deployed that way is fully gauntleted and
// capped — a verified mint passes, an unverified mint reverts the typed error, and issuance past
// the cap reverts ExceedsPrincipal — exactly as the seeded loans behave. Args reused: the deploy
// manifest's identityRegistry + reserve; ratePerSecond + principalCap per-loan.
contract RuntimeDeployTest is SeedIdentities {
    uint256 internal constant NEW_LOAN_ID = 7; // the next loan id the tokenize loop assigns
    uint256 internal constant CAP = 4_100_000e6; // a runtime loan's principal, in 6-decimal base units

    function setUp() public {
        _deployAndSeed();
    }

    // a CreditToken deployed at runtime with the seeded wiring behaves like the seeded 6:
    // verified mint passes the gauntlet, unverified reverts, and the cap holds.
    function test_runtimeDeploy_isFullyGauntletedAndCapped() public {
        CreditToken runtime = new CreditToken(admin, address(id), address(reserve), RATE, CAP);

        // 1. verified holder passes the gauntlet on the fresh token.
        vm.prank(admin);
        runtime.mint(verified1, NEW_LOAN_ID, 1_000_000e6);
        assertEq(runtime.balanceOf(verified1), 1_000_000e6);

        // 2. unverified receiver reverts the precise typed error (the gauntlet runs on mint).
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        runtime.mint(unverified, NEW_LOAN_ID, 1_000e6);

        // 3. the on-chain issuance cap holds: up to CAP ok, one past reverts ExceedsPrincipal.
        vm.startPrank(admin);
        runtime.mint(verified2, NEW_LOAN_ID, CAP - 1_000_000e6); // brings supply exactly to CAP
        assertEq(runtime.totalSupply(), CAP);
        vm.expectRevert(abi.encodeWithSelector(ExceedsPrincipal.selector, CAP + 1, CAP));
        runtime.mint(verified2, NEW_LOAN_ID, 1);
        vm.stopPrank();
    }
}
