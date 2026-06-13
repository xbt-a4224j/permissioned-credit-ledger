// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

// #6/#66 unit coverage for the identity trust boundary — setters, events,
// verification reads, and role-gating. Collapsed to verified-only (#66).
contract IdentityRegistryTest is Test {
    IdentityRegistry internal reg;
    address internal admin = address(0xA11CE);
    address internal alice = address(0x1);
    address internal mallory = address(0xBAD);

    event ClaimsUpdated(address indexed account, bool verified);

    function setUp() public {
        reg = new IdentityRegistry(admin);
    }

    // #6 admin gets DEFAULT_ADMIN_ROLE + ISSUER_ROLE at construction.
    function test_admin_hasRoles() public view {
        assertTrue(reg.hasRole(reg.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(reg.hasRole(reg.ISSUER_ROLE(), admin));
    }

    // #6 setVerified flips the bit and emits the post-state.
    function test_setVerified_emitsClaimsUpdated() public {
        vm.expectEmit(true, false, false, true);
        emit ClaimsUpdated(alice, true);
        vm.prank(admin);
        reg.setVerified(alice, true);
        assertTrue(reg.isVerified(alice));
    }

    // #6 setClaims writes the whole struct in one call.
    function test_setClaims_writesWholeStruct() public {
        IIdentityRegistry.Claims memory c = IIdentityRegistry.Claims({verified: true});
        vm.prank(admin);
        reg.setClaims(alice, c);
        IIdentityRegistry.Claims memory got = reg.claimsOf(alice);
        assertTrue(got.verified);
    }

    // #6 unverified by default.
    function test_isVerified_falseWhenUnregistered() public view {
        assertFalse(reg.isVerified(alice)); // never set
    }

    // #6 non-issuer setter call reverts with the OZ typed error.
    function test_nonIssuer_setterReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, mallory, reg.ISSUER_ROLE())
        );
        vm.prank(mallory);
        reg.setVerified(alice, true);
    }
}
