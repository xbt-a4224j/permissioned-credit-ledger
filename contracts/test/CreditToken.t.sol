// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SeedIdentities} from "./helpers/SeedIdentities.sol";
import {ComplianceRegistry} from "../src/ComplianceRegistry.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {ICreditToken} from "../src/interfaces/ICreditToken.sol";
import {IComplianceRegistry} from "../src/interfaces/IComplianceRegistry.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ReceiverFrozen, ReceiverNotVerified, AccreditationRequired, InsufficientReserve} from "../src/Errors.sol";

// #10 transfer-gauntlet reason-code coverage — the contract half of the design:
// every gauntlet branch terminates in the EXACT typed custom error the matrix
// expects (rows 3,4,5,6,8) and the happy paths (rows 1,2,7) produce the right
// events/state. Every typed-revert test asserts the selector WITH decoded args
// (no bare expectRevert). 14 test functions total.
contract CreditTokenTest is SeedIdentities {
    function setUp() public {
        _deployAndSeed();
        // starting position for the accredited-US holder so transfers have supply.
        _mintTo(accreditedUS1, 100_000e6);
    }

    // === happy paths ===

    // matrix row 1: accredited-US invest emits PositionOpened and starts accrual.
    function test_invest_accreditedUS_emitsPositionOpened_andStartsAccrual() public {
        vm.expectEmit(true, false, false, true);
        emit ICreditToken.PositionOpened(accreditedUS2, LOAN_ID, 50_000e6);
        _mintTo(accreditedUS2, 50_000e6);
        assertEq(token.balanceOf(accreditedUS2), 50_000e6);
        // accrual clock started: claimable grows after a warp.
        vm.warp(block.timestamp + 30 days);
        assertGt(token.claimable(accreditedUS2), 0);
    }

    // matrix row 2: Reg-S non-US invest OK. A Reg-S non-US holder is NOT accredited,
    // so it can only invest in a Reg-S offering (a Reg-D token would revert
    // AccreditationRequired). Deploy a Reg-S instance and prove the mint succeeds.
    function test_invest_regS_ok() public {
        ComplianceRegistry regS = new ComplianceRegistry(admin, address(id), IComplianceRegistry.Offering.RegS);
        CreditToken regSToken = new CreditToken(admin, address(id), address(regS), address(reserve), RATE);
        vm.prank(admin);
        regSToken.mint(regsNonUS1, LOAN_ID, 25_000e6);
        assertEq(regSToken.balanceOf(regsNonUS1), 25_000e6);
    }

    // matrix row 7: funded claim emits InterestClaimed, debits reserve, resets accrued.
    function test_claim_funded_emitsInterestClaimed_debitsReserve_resetsAccrued() public {
        vm.warp(block.timestamp + 30 days);
        uint256 owed = token.claimable(accreditedUS1);
        assertGt(owed, 0);
        reserve.mint(address(token), owed * 2);
        uint256 reserveBefore = reserve.balanceOf(address(token));

        vm.expectEmit(true, false, false, true);
        emit ICreditToken.InterestClaimed(accreditedUS1, LOAN_ID, owed);
        vm.prank(accreditedUS1);
        token.claim();

        assertEq(reserve.balanceOf(accreditedUS1), owed); // paid
        assertEq(reserve.balanceOf(address(token)), reserveBefore - owed); // debited
        assertEq(token.claimable(accreditedUS1), 0); // accrued reset
    }

    // === typed-revert branches (selector WITH decoded args) ===

    // matrix row 3: unverified invest reverts NotEligible-family (unverified trips
    // ReceiverNotVerified, the precise typed revert the gauntlet emits first).
    function test_invest_unverified_revertsNotEligible() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        _mintTo(unverified, 1_000e6);
    }

    // matrix row 4: transfer to frozen receiver reverts ReceiverFrozen.
    function test_transfer_toFrozen_revertsReceiverFrozen() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverFrozen.selector, frozen));
        vm.prank(accreditedUS1);
        token.transfer(frozen, 10e6);
    }

    // matrix row 5: transfer to unverified receiver reverts ReceiverNotVerified.
    function test_transfer_toUnverified_revertsReceiverNotVerified() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        vm.prank(accreditedUS1);
        token.transfer(unverified, 10e6);
    }

    // matrix row 6: US non-accredited holding a Reg-D token reverts AccreditationRequired.
    function test_transfer_usNonAccredited_revertsAccreditationRequired() public {
        vm.expectRevert(abi.encodeWithSelector(AccreditationRequired.selector, usNonAccredited));
        vm.prank(accreditedUS1);
        token.transfer(usNonAccredited, 10e6);
    }

    // matrix row 8: claim against an underfunded reserve reverts InsufficientReserve(owed, bal).
    function test_claim_underfunded_revertsInsufficientReserve() public {
        vm.warp(block.timestamp + 30 days);
        uint256 owed = token.claimable(accreditedUS1);
        assertGt(owed, 0);
        uint256 bal = owed - 1;
        reserve.mint(address(token), bal);
        vm.expectRevert(abi.encodeWithSelector(InsufficientReserve.selector, owed, bal));
        vm.prank(accreditedUS1);
        token.claim();
    }

    // === gauntlet ordering ===

    // freeze precedes verification precedes compliance: a receiver that is frozen
    // AND unverified AND non-compliant reverts ReceiverFrozen FIRST.
    function test_gauntlet_frozenBeatsVerifiedBeatsCompliance() public {
        address worst = address(0x61);
        vm.prank(admin);
        // frozen + unverified + (US non-accredited under Reg-D) — all three fail.
        id.setClaims(worst, IIdentityRegistry.Claims(false, false, IIdentityRegistry.Jurisdiction.US, true));
        vm.expectRevert(abi.encodeWithSelector(ReceiverFrozen.selector, worst));
        vm.prank(accreditedUS1);
        token.transfer(worst, 10e6);
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
        token.mint(accreditedUS2, LOAN_ID, 1e6);
    }

    // === supporting assertions (balances / accrued / reserve / config) ===

    // decimals match the 6dp reserve.
    function test_support_decimalsIsSix() public view {
        assertEq(token.decimals(), 6);
    }

    // issuer mint sets loanOf and total supply.
    function test_support_mintSetsLoanOfAndSupply() public view {
        assertEq(token.loanOf(accreditedUS1), LOAN_ID);
        assertEq(token.totalSupply(), 100_000e6);
    }

    // happy holder-to-holder transfer moves balances both ways.
    function test_support_transferMovesBalances() public {
        vm.prank(accreditedUS1);
        token.transfer(accreditedUS2, 40_000e6);
        assertEq(token.balanceOf(accreditedUS2), 40_000e6);
        assertEq(token.balanceOf(accreditedUS1), 60_000e6);
    }

    // clawback burn from a frozen holder succeeds (gauntlet bypass on burn path).
    function test_support_clawbackBurnBypassesGauntlet() public {
        vm.prank(admin);
        id.setFrozen(accreditedUS1, true);
        vm.prank(admin);
        token.burn(accreditedUS1, 100_000e6);
        assertEq(token.balanceOf(accreditedUS1), 0);
    }
}
