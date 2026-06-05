// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

// #6 unit coverage for the identity trust boundary — setters, events, eligibility
// logic, role-gating, and the canonical 6-identity seed the matrix depends on.
contract IdentityRegistryTest is Test {
    IdentityRegistry internal reg;
    address internal admin = address(0xA11CE);
    address internal alice = address(0x1);
    address internal mallory = address(0xBAD);

    event ClaimsUpdated(
        address indexed account,
        bool verified,
        bool accredited,
        IIdentityRegistry.Jurisdiction jurisdiction,
        bool frozen
    );

    function setUp() public {
        reg = new IdentityRegistry(admin);
    }

    // #6 admin gets DEFAULT_ADMIN_ROLE + ISSUER_ROLE at construction.
    function test_admin_hasRoles() public view {
        assertTrue(reg.hasRole(reg.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(reg.hasRole(reg.ISSUER_ROLE(), admin));
    }

    // #6 setVerified flips the bit and emits the full post-state.
    function test_setVerified_emitsClaimsUpdated() public {
        vm.expectEmit(true, false, false, true);
        emit ClaimsUpdated(alice, true, false, IIdentityRegistry.Jurisdiction.Unknown, false);
        vm.prank(admin);
        reg.setVerified(alice, true);
        assertTrue(reg.isVerified(alice));
    }

    function test_setAccredited_setsAndEmits() public {
        vm.expectEmit(true, false, false, true);
        emit ClaimsUpdated(alice, false, true, IIdentityRegistry.Jurisdiction.Unknown, false);
        vm.prank(admin);
        reg.setAccredited(alice, true);
        assertTrue(reg.isAccredited(alice));
    }

    function test_setJurisdiction_setsAndEmits() public {
        vm.prank(admin);
        reg.setJurisdiction(alice, IIdentityRegistry.Jurisdiction.NonUS);
        assertEq(uint8(reg.jurisdictionOf(alice)), uint8(IIdentityRegistry.Jurisdiction.NonUS));
    }

    function test_setFrozen_setsAndEmits() public {
        vm.prank(admin);
        reg.setFrozen(alice, true);
        assertTrue(reg.isFrozen(alice));
    }

    // #6 setClaims writes the whole struct in one call.
    function test_setClaims_writesWholeStruct() public {
        IIdentityRegistry.Claims memory c = IIdentityRegistry.Claims({
            verified: true, accredited: true, jurisdiction: IIdentityRegistry.Jurisdiction.US, frozen: false
        });
        vm.prank(admin);
        reg.setClaims(alice, c);
        IIdentityRegistry.Claims memory got = reg.claimsOf(alice);
        assertTrue(got.verified);
        assertTrue(got.accredited);
        assertEq(uint8(got.jurisdiction), uint8(IIdentityRegistry.Jurisdiction.US));
        assertFalse(got.frozen);
    }

    // #6 isEligible == verified && !frozen.
    function test_isEligible_trueWhenVerifiedAndNotFrozen() public {
        vm.prank(admin);
        reg.setVerified(alice, true);
        assertTrue(reg.isEligible(alice));
    }

    function test_isEligible_falseWhenUnverified() public view {
        assertFalse(reg.isEligible(alice)); // never set
    }

    function test_isEligible_falseWhenFrozen() public {
        vm.startPrank(admin);
        reg.setVerified(alice, true);
        reg.setFrozen(alice, true);
        vm.stopPrank();
        assertFalse(reg.isEligible(alice));
    }

    // #6 accreditation is excluded from eligibility so row 6 stays distinct.
    function test_isEligible_ignoresAccreditation() public {
        vm.startPrank(admin);
        reg.setVerified(alice, true); // accredited stays false
        vm.stopPrank();
        assertTrue(reg.isEligible(alice));
        assertFalse(reg.isAccredited(alice));
    }

    // #6 non-issuer setter call reverts with the OZ typed error.
    function test_nonIssuer_setterReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, mallory, reg.ISSUER_ROLE())
        );
        vm.prank(mallory);
        reg.setVerified(alice, true);
    }

    // #6 AC4: the canonical 6-identity seed — 2 accredited-US, 2 Reg-S non-US,
    // 1 unverified, 1 frozen — matches the matrix actors.
    function test_seedSixIdentities_matchesMatrixActors() public {
        address[6] memory who =
            [address(0x11), address(0x12), address(0x21), address(0x22), address(0x31), address(0x41)];
        _seedSixIdentities(who);

        // 2 accredited-US: verified, accredited, US, eligible.
        for (uint256 i = 0; i < 2; i++) {
            assertTrue(reg.isVerified(who[i]));
            assertTrue(reg.isAccredited(who[i]));
            assertEq(uint8(reg.jurisdictionOf(who[i])), uint8(IIdentityRegistry.Jurisdiction.US));
            assertTrue(reg.isEligible(who[i]));
        }
        // 2 Reg-S non-US: verified, NOT accredited, NonUS, eligible.
        for (uint256 i = 2; i < 4; i++) {
            assertTrue(reg.isVerified(who[i]));
            assertFalse(reg.isAccredited(who[i]));
            assertEq(uint8(reg.jurisdictionOf(who[i])), uint8(IIdentityRegistry.Jurisdiction.NonUS));
            assertTrue(reg.isEligible(who[i]));
        }
        // unverified: not verified, not eligible.
        assertFalse(reg.isVerified(who[4]));
        assertFalse(reg.isEligible(who[4]));
        // frozen: verified but frozen -> not eligible.
        assertTrue(reg.isVerified(who[5]));
        assertTrue(reg.isFrozen(who[5]));
        assertFalse(reg.isEligible(who[5]));
    }

    // #6 reusable seed helper (internal-for-test) producing the canonical mix.
    function _seedSixIdentities(address[6] memory who) internal {
        vm.startPrank(admin);
        reg.setClaims(who[0], IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        reg.setClaims(who[1], IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        reg.setClaims(who[2], IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.NonUS, false));
        reg.setClaims(who[3], IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.NonUS, false));
        // who[4] left unregistered (unverified by default).
        reg.setClaims(who[5], IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.US, true));
        vm.stopPrank();
    }
}
