// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {ClaimHandler} from "./handlers/ClaimHandler.sol";

// #11 stateful invariant — the on-chain half of the solvency guarantee: aggregate
// holder claimable never exceeds the reserve balance (recon invariant 2), and
// total paid out never exceeds total funded (conservation under adversarial call
// ordering). Runs >=256 invariant runs at depth 64 (foundry.toml).
contract CreditTokenInvariantTest is StdInvariant, Test {
    IdentityRegistry internal id;
    CreditToken internal token;
    MockUSDC internal reserve;
    ClaimHandler internal handler;

    address internal admin = address(0xA11CE);
    uint256 internal constant RATE = 1e9;

    function setUp() public {
        id = new IdentityRegistry(admin);
        reserve = new MockUSDC();
        token = new CreditToken(admin, address(id), address(reserve), RATE, type(uint256).max);

        // #66 bounded actor set: the 2 verified holders (the set the token admits).
        address[2] memory holders = [address(0x11), address(0x12)];
        vm.startPrank(admin);
        id.setClaims(holders[0], IIdentityRegistry.Claims(true));
        id.setClaims(holders[1], IIdentityRegistry.Claims(true));
        vm.stopPrank();

        handler = new ClaimHandler(token, reserve, admin, holders);

        // #11 LANDMINE GUARD: without targetContract + targetSelector the fuzzer
        // calls nothing and every invariant trivially passes. Wire both, and
        // invariant_handlerActuallyRan asserts the call counter advanced.
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.mint.selector;
        selectors[1] = handler.warpTime.selector;
        selectors[2] = handler.claim.selector;
        selectors[3] = handler.fundReserve.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // #11 recon invariant 2 (on-chain): sum(holder claimable) <= reserve balance.
    function invariant_claimableNeverExceedsReserve() public view {
        assertLe(handler.totalClaimable(), reserve.balanceOf(address(token)));
    }

    // #11 conservation: nothing claimed was conjured from nothing — total ever
    // paid out never exceeds total ever funded into the reserve, even under
    // adversarial mint/warp/claim ordering.
    function invariant_sumAccruedEqualsTotalClaimable() public view {
        assertLe(handler.ghostTotalClaimed(), handler.ghostTotalFunded());
    }

    // #11 proves the handler was actually exercised (guards the silent-pass trap).
    // Checked in afterInvariant — runs once AFTER the call sequence, so it isn't
    // evaluated against the empty initial state (where callCount is legitimately 0).
    function afterInvariant() public view {
        assertGt(handler.callCount(), 0, "handler never ran: targetContract/selectors unwired");
    }
}
