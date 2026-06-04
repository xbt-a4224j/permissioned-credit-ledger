// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ComplianceRegistry} from "../src/ComplianceRegistry.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {ICreditToken} from "../src/interfaces/ICreditToken.sol";
import {IComplianceRegistry} from "../src/interfaces/IComplianceRegistry.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {NotEligible, ReceiverFrozen, ReceiverNotVerified, AccreditationRequired} from "../src/Errors.sol";

// #8 transfer-gauntlet unit suite for CreditToken — proves the _update chokepoint
// reverts the right typed error per matrix branch (rows 3-6) and the happy mint
// path emits PositionOpened. Full happy/sad matrix coverage is #10.
contract CreditTokenTest is Test {
    IdentityRegistry internal id;
    ComplianceRegistry internal compliance; // Reg-D instance
    CreditToken internal token;

    address internal admin = address(0xA11CE);
    uint256 internal constant LOAN_ID = 1;

    address internal accreditedUS = address(0x11);
    address internal accreditedUS2 = address(0x12);
    address internal regsNonUS = address(0x21);
    address internal unverified = address(0x31);
    address internal frozen = address(0x41);

    function setUp() public {
        id = new IdentityRegistry(admin);
        compliance = new ComplianceRegistry(admin, address(id), IComplianceRegistry.Offering.RegD);
        token = new CreditToken(admin, address(id), address(compliance));

        vm.startPrank(admin);
        id.setClaims(accreditedUS, IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        id.setClaims(accreditedUS2, IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        id.setClaims(regsNonUS, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.NonUS, false));
        // unverified left unset.
        id.setClaims(frozen, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.US, true));
        vm.stopPrank();
    }

    // #8 decimals match the 6dp reserve.
    function test_decimals_isSix() public view {
        assertEq(token.decimals(), 6);
    }

    // #8 happy mint to accredited-US emits PositionOpened and credits balance.
    function test_mint_accreditedUS_emitsPositionOpened() public {
        vm.expectEmit(true, false, false, true);
        emit ICreditToken.PositionOpened(accreditedUS, LOAN_ID, 100e6);
        vm.prank(admin);
        token.mint(accreditedUS, LOAN_ID, 100e6);
        assertEq(token.balanceOf(accreditedUS), 100e6);
        assertEq(token.loanOf(accreditedUS), LOAN_ID);
        assertEq(token.totalSupply(), 100e6);
    }

    // #8 matrix row 3: minting to an unverified recipient reverts (gauntlet runs
    // on the mint recipient). Unverified trips ReceiverNotVerified first.
    function test_mint_unverified_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        vm.prank(admin);
        token.mint(unverified, LOAN_ID, 100e6);
    }

    // #8 matrix row 4: transfer to a frozen receiver reverts ReceiverFrozen.
    function test_transfer_toFrozen_revertsReceiverFrozen() public {
        _mintTo(accreditedUS, 100e6);
        vm.expectRevert(abi.encodeWithSelector(ReceiverFrozen.selector, frozen));
        vm.prank(accreditedUS);
        token.transfer(frozen, 10e6);
    }

    // #8 matrix row 5: transfer to an unverified receiver reverts.
    function test_transfer_toUnverified_revertsReceiverNotVerified() public {
        _mintTo(accreditedUS, 100e6);
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        vm.prank(accreditedUS);
        token.transfer(unverified, 10e6);
    }

    // #8 matrix row 6: transfer to a US non-accredited holder under Reg-D reverts
    // AccreditationRequired.
    function test_transfer_usNonAccredited_revertsAccreditationRequired() public {
        address usNonAccredited = address(0x51);
        vm.prank(admin);
        id.setClaims(usNonAccredited, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.US, false));
        _mintTo(accreditedUS, 100e6);
        vm.expectRevert(abi.encodeWithSelector(AccreditationRequired.selector, usNonAccredited));
        vm.prank(accreditedUS);
        token.transfer(usNonAccredited, 10e6);
    }

    // #8 happy transfer between two accredited-US holders succeeds.
    function test_transfer_accreditedToAccredited_ok() public {
        _mintTo(accreditedUS, 100e6);
        vm.prank(accreditedUS);
        token.transfer(accreditedUS2, 40e6);
        assertEq(token.balanceOf(accreditedUS2), 40e6);
        assertEq(token.balanceOf(accreditedUS), 60e6);
    }

    // #8 non-issuer mint/burn revert with the OZ access-control error.
    function test_mint_nonIssuer_revertsUnauthorized() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xBAD), token.ISSUER_ROLE()
            )
        );
        vm.prank(address(0xBAD));
        token.mint(accreditedUS, LOAN_ID, 1e6);
    }

    function test_burn_nonIssuer_revertsUnauthorized() public {
        _mintTo(accreditedUS, 100e6);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xBAD), token.ISSUER_ROLE()
            )
        );
        vm.prank(address(0xBAD));
        token.burn(accreditedUS, 1e6);
    }

    // #8 clawback burn from a FROZEN holder succeeds — gauntlet bypass on the
    // burn path (to == address(0)) proven.
    function test_burn_fromFrozenHolder_succeeds() public {
        // mint to a holder, then freeze them, then issuer claws back.
        _mintTo(accreditedUS, 100e6);
        vm.prank(admin);
        id.setFrozen(accreditedUS, true);
        vm.prank(admin);
        token.burn(accreditedUS, 100e6);
        assertEq(token.balanceOf(accreditedUS), 0);
    }

    // #8 issuer can set loan status; emits LoanStatusChanged.
    function test_setLoanStatus_emits() public {
        vm.expectEmit(true, false, false, true);
        emit ICreditToken.LoanStatusChanged(LOAN_ID, ICreditToken.LoanStatus.DELINQUENT);
        vm.prank(admin);
        token.setLoanStatus(LOAN_ID, ICreditToken.LoanStatus.DELINQUENT);
        assertEq(uint8(token.status()), uint8(ICreditToken.LoanStatus.DELINQUENT));
    }

    function _mintTo(address to, uint256 amount) internal {
        vm.prank(admin);
        token.mint(to, LOAN_ID, amount);
    }
}
