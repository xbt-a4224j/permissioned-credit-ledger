// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IComplianceRegistry} from "../src/interfaces/IComplianceRegistry.sol";
import {ICreditToken} from "../src/interfaces/ICreditToken.sol";
import {
    NotEligible,
    ReceiverFrozen,
    ReceiverNotVerified,
    AccreditationRequired,
    InsufficientReserve
} from "../src/Errors.sol";

// #5 compile-time proof the interface + error surface exists before any
// implementation lands (interfaces-before-implementations rule).
contract InterfacesTest is Test {
    // #5 AC4: interfaceIds resolve and every custom-error selector is referenceable
    // from a second file via import — the indexer/API decode by these selectors.
    function test_interfaceSurfaceExists() public pure {
        assertTrue(type(IIdentityRegistry).interfaceId != bytes4(0));
        assertTrue(type(IComplianceRegistry).interfaceId != bytes4(0));
        assertTrue(type(ICreditToken).interfaceId != bytes4(0));

        // Reference each of the five reason-code selectors so a stale/renamed
        // error breaks the build, not silently the decoder.
        assertTrue(NotEligible.selector != bytes4(0));
        assertTrue(ReceiverFrozen.selector != bytes4(0));
        assertTrue(ReceiverNotVerified.selector != bytes4(0));
        assertTrue(AccreditationRequired.selector != bytes4(0));
        assertTrue(InsufficientReserve.selector != bytes4(0));
    }
}
