// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SeedIdentities} from "./helpers/SeedIdentities.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {ICreditToken} from "../src/interfaces/ICreditToken.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ReceiverNotVerified, InsufficientReserve, ExceedsPrincipal} from "../src/Errors.sol";

// #10/#66 transfer-gauntlet reason-code coverage — the contract half of the design.
// After the compliance collapse the sole transfer revert is ReceiverNotVerified;
// the happy paths produce the right events/state, and claim/cap branches terminate
// in the exact typed custom error. Every typed-revert test asserts the selector WITH
// decoded args (no bare expectRevert).
contract CreditTokenTest is SeedIdentities {
    function setUp() public {
        _deployAndSeed();
        // starting position for a verified holder so transfers have supply.
        _mintTo(verified1, 100_000e6);
    }

    // === happy paths ===

    // verified invest emits PositionOpened and starts accrual.
    function test_invest_verified_emitsPositionOpened_andStartsAccrual() public {
        vm.expectEmit(true, false, false, true);
        emit ICreditToken.PositionOpened(verified2, LOAN_ID, 50_000e6);
        _mintTo(verified2, 50_000e6);
        assertEq(token.balanceOf(verified2), 50_000e6);
        // accrual clock started: claimable grows after a warp.
        vm.warp(block.timestamp + 30 days);
        assertGt(token.claimable(verified2), 0);
    }

    // funded claim emits InterestClaimed, debits reserve, resets accrued.
    function test_claim_funded_emitsInterestClaimed_debitsReserve_resetsAccrued() public {
        vm.warp(block.timestamp + 30 days);
        uint256 owed = token.claimable(verified1);
        assertGt(owed, 0);
        reserve.mint(address(token), owed * 2);
        uint256 reserveBefore = reserve.balanceOf(address(token));

        vm.expectEmit(true, false, false, true);
        emit ICreditToken.InterestClaimed(verified1, LOAN_ID, owed);
        vm.prank(verified1);
        token.claim();

        assertEq(reserve.balanceOf(verified1), owed); // paid
        assertEq(reserve.balanceOf(address(token)), reserveBefore - owed); // debited
        assertEq(token.claimable(verified1), 0); // accrued reset
    }

    // #5 issuance cap: minting up to the loan's principal succeeds; the next unit reverts
    // ExceedsPrincipal(attempted, cap). Enforced on-chain so issuance can never out-run the loan.
    function test_mint_uptoCap_ok_thenExceedsPrincipal_reverts() public {
        uint256 cap = 1_000_000e6;
        CreditToken capped = new CreditToken(admin, address(id), address(reserve), RATE, cap);
        vm.startPrank(admin);
        capped.mint(verified1, LOAN_ID, cap); // exactly to the cap: OK
        assertEq(capped.totalSupply(), cap);
        // one more unit pushes total supply past the principal -> typed revert with (attempted, cap).
        vm.expectRevert(abi.encodeWithSelector(ExceedsPrincipal.selector, cap + 1, cap));
        capped.mint(verified2, LOAN_ID, 1);
        vm.stopPrank();
    }

    // === typed-revert branches (selector WITH decoded args) ===

    // unverified invest reverts ReceiverNotVerified (the sole surviving compliance revert).
    function test_invest_unverified_revertsReceiverNotVerified() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        _mintTo(unverified, 1_000e6);
    }

    // transfer to unverified receiver reverts ReceiverNotVerified.
    function test_transfer_toUnverified_revertsReceiverNotVerified() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        vm.prank(verified1);
        token.transfer(unverified, 10e6);
    }

    // claim against an underfunded reserve reverts InsufficientReserve(owed, bal).
    function test_claim_underfunded_revertsInsufficientReserve() public {
        vm.warp(block.timestamp + 30 days);
        uint256 owed = token.claimable(verified1);
        assertGt(owed, 0);
        uint256 bal = owed - 1;
        reserve.mint(address(token), bal);
        vm.expectRevert(abi.encodeWithSelector(InsufficientReserve.selector, owed, bal));
        vm.prank(verified1);
        token.claim();
    }

    // === role gate ===

    // non-issuer mint reverts AccessControlUnauthorizedAccount.
    function test_mint_roleGate_revertsUnauthorized() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xBAD), token.ISSUER_ROLE()
            )
        );
        vm.prank(address(0xBAD));
        token.mint(verified2, LOAN_ID, 1e6);
    }

    // === supporting assertions (balances / accrued / reserve / config) ===

    // decimals match the 6dp reserve.
    function test_support_decimalsIsSix() public view {
        assertEq(token.decimals(), 6);
    }

    // issuer mint sets loanOf and total supply.
    function test_support_mintSetsLoanOfAndSupply() public view {
        assertEq(token.loanOf(verified1), LOAN_ID);
        assertEq(token.totalSupply(), 100_000e6);
    }

    // happy holder-to-holder transfer moves balances both ways.
    function test_support_transferMovesBalances() public {
        vm.prank(verified1);
        token.transfer(verified2, 40_000e6);
        assertEq(token.balanceOf(verified2), 40_000e6);
        assertEq(token.balanceOf(verified1), 60_000e6);
    }

    // clawback burn succeeds (gauntlet bypass on the burn path).
    function test_support_clawbackBurnBypassesGauntlet() public {
        vm.prank(admin);
        token.burn(verified1, 100_000e6);
        assertEq(token.balanceOf(verified1), 0);
    }
}
