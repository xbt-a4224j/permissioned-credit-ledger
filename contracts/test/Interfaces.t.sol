// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {ICreditToken} from "../src/interfaces/ICreditToken.sol";
import {ReceiverNotVerified, InsufficientReserve, ExceedsPrincipal} from "../src/Errors.sol";

// #5/#66 compile-time proof the interface + error surface exists before any
// implementation lands (interfaces-before-implementations rule).
contract InterfacesTest is Test {
    // #5 AC4: interfaceIds resolve and every custom-error selector is referenceable
    // from a second file via import — the indexer/API decode by these selectors.
    function test_interfaceSurfaceExists() public pure {
        assertTrue(type(IIdentityRegistry).interfaceId != bytes4(0));
        assertTrue(type(ICreditToken).interfaceId != bytes4(0));

        // Reference each surviving reason-code selector so a stale/renamed
        // error breaks the build, not silently the decoder.
        assertTrue(ReceiverNotVerified.selector != bytes4(0));
        assertTrue(InsufficientReserve.selector != bytes4(0));
        assertTrue(ExceedsPrincipal.selector != bytes4(0));
    }
}
