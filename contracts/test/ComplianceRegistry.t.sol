// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ComplianceRegistry} from "../src/ComplianceRegistry.sol";
import {IComplianceRegistry} from "../src/interfaces/IComplianceRegistry.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {SenderFrozen, NotEligible, ReceiverFrozen, ReceiverNotVerified, AccreditationRequired} from "../src/Errors.sol";

// #7 unit coverage for the Reg-D / Reg-S gauntlet — one test per typed-revert
// branch (rows 3-6), happy paths (rows 1,2), ordering precedence, and full
// bool/revert parity between canTransfer and checkTransfer.
contract ComplianceRegistryTest is Test {
    IdentityRegistry internal id;
    ComplianceRegistry internal regD;
    ComplianceRegistry internal regS;

    address internal admin = address(0xA11CE);
    address internal from = address(0x5E11E2); // generic non-frozen sender

    address internal accreditedUS = address(0x11);
    address internal regsNonUS = address(0x21);
    address internal unverified = address(0x31);
    address internal frozen = address(0x41);
    address internal usNonAccredited = address(0x51);

    function setUp() public {
        id = new IdentityRegistry(admin);
        regD = new ComplianceRegistry(admin, address(id), IComplianceRegistry.Offering.RegD);
        regS = new ComplianceRegistry(admin, address(id), IComplianceRegistry.Offering.RegS);

        vm.startPrank(admin);
        // accredited-US: verified, accredited, US.
        id.setClaims(accreditedUS, IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        // Reg-S non-US: verified, not accredited, NonUS.
        id.setClaims(regsNonUS, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.NonUS, false));
        // unverified left unset.
        // frozen: verified but frozen.
        id.setClaims(frozen, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.US, true));
        // US non-accredited: verified, NOT accredited, US.
        id.setClaims(usNonAccredited, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.US, false));
        vm.stopPrank();
    }

    // --- happy paths ---

    // #7 matrix row 1: accredited-US receiver passes the Reg-D gauntlet.
    function test_regD_accreditedUS_ok() public view {
        regD.checkTransfer(from, accreditedUS, 1e6); // no revert
        assertTrue(regD.canTransfer(from, accreditedUS, 1e6));
    }

    // #7 matrix row 2: Reg-S non-US receiver passes a Reg-S instance.
    function test_regS_nonUS_ok() public view {
        regS.checkTransfer(from, regsNonUS, 1e6); // no revert
        assertTrue(regS.canTransfer(from, regsNonUS, 1e6));
    }

    // --- typed-revert branches (exact selector with decoded arg) ---

    // #7 matrix row 4: frozen SENDER -> SenderFrozen (step 0, before any receiver check).
    // A frozen holder cannot initiate any outbound transfer.
    function test_fromFrozen_revertsSenderFrozen() public {
        vm.expectRevert(abi.encodeWithSelector(SenderFrozen.selector, frozen));
        regD.checkTransfer(frozen, accreditedUS, 1e6);
    }

    // #7 frozen receiver -> ReceiverFrozen (step 1, when sender is not frozen).
    function test_toFrozen_revertsReceiverFrozen() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverFrozen.selector, frozen));
        regD.checkTransfer(from, frozen, 1e6);
    }

    // #7 matrix row 3: unverified receiver -> ReceiverNotVerified (step 2).
    function test_toUnverified_revertsReceiverNotVerified() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        regD.checkTransfer(from, unverified, 1e6);
    }

    // #7 matrix row 6: US non-accredited under Reg-D -> AccreditationRequired.
    function test_usNonAccredited_regD_revertsAccreditationRequired() public {
        vm.expectRevert(abi.encodeWithSelector(AccreditationRequired.selector, usNonAccredited));
        regD.checkTransfer(from, usNonAccredited, 1e6);
    }

    // #7 matrix row 5: a US holder under Reg-S is NotEligible (jurisdiction
    // mismatch reuses NotEligible deliberately — not "un-accredited").
    function test_usHolder_regS_revertsNotEligible() public {
        vm.expectRevert(abi.encodeWithSelector(NotEligible.selector, accreditedUS));
        regS.checkTransfer(from, accreditedUS, 1e6);
    }

    // --- ordering precedence ---

    // #7 sender-freeze fires before any receiver check: a frozen sender sending to
    // a valid receiver reverts SenderFrozen (not ReceiverFrozen or anything else).
    function test_ordering_senderFrozenBeatsReceiver() public {
        vm.expectRevert(abi.encodeWithSelector(SenderFrozen.selector, frozen));
        regD.checkTransfer(frozen, accreditedUS, 1e6);
    }

    // #7 receiver-freeze beats receiver-verification: a frozen+unverified receiver
    // reverts ReceiverFrozen, not ReceiverNotVerified.
    function test_ordering_receiverFrozenBeatsVerified() public {
        address frozenAndUnverified = address(0x61);
        vm.prank(admin);
        id.setClaims(
            frozenAndUnverified, IIdentityRegistry.Claims(false, false, IIdentityRegistry.Jurisdiction.US, true)
        );
        vm.expectRevert(abi.encodeWithSelector(ReceiverFrozen.selector, frozenAndUnverified));
        regD.checkTransfer(from, frozenAndUnverified, 1e6);
    }

    // #7 verification precedes the offering-specific accreditation check: an
    // unverified, non-accredited receiver reverts ReceiverNotVerified, not
    // AccreditationRequired.
    function test_ordering_verifiedBeatsCompliance() public {
        vm.expectRevert(abi.encodeWithSelector(ReceiverNotVerified.selector, unverified));
        regD.checkTransfer(from, unverified, 1e6);
    }

    // --- bool/revert parity ---

    // #7 canTransfer returns false (never reverts) for every failing case — including
    // a frozen sender — and true for the happy cases.
    function test_canTransfer_parityWithCheckTransfer() public view {
        // frozen as sender
        assertFalse(regD.canTransfer(frozen, accreditedUS, 1e6));
        // failing receivers
        address[4] memory failingTo = [frozen, unverified, usNonAccredited, address(0x99)];
        for (uint256 i = 0; i < failingTo.length; i++) {
            assertFalse(regD.canTransfer(from, failingTo[i], 1e6));
        }
        // US holder fails under Reg-S.
        assertFalse(regS.canTransfer(from, accreditedUS, 1e6));
        // happy paths return true.
        assertTrue(regD.canTransfer(from, accreditedUS, 1e6));
        assertTrue(regS.canTransfer(from, regsNonUS, 1e6));
    }

    // #7 offering is fixed at deploy and readable.
    function test_offering_isImmutable() public view {
        assertEq(uint8(regD.offering()), uint8(IComplianceRegistry.Offering.RegD));
        assertEq(uint8(regS.offering()), uint8(IComplianceRegistry.Offering.RegS));
    }
}
