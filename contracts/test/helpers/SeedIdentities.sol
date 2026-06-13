// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {CreditToken} from "../../src/CreditToken.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {IIdentityRegistry} from "../../src/interfaces/IIdentityRegistry.sol";

// #10/#66 reusable setUp mixin — deploys IdentityRegistry + CreditToken + MockUSDC reserve
// and seeds the canonical identities (#66 verified-only): 2 verified holders + 1 unverified.
// Shared by #10 (matrix coverage) and #11 (fuzz/invariant) so both suites assert against one
// seed surface and the same actor addresses the deploy script (#12) will use.
abstract contract SeedIdentities is Test {
    IdentityRegistry internal id;
    CreditToken internal token;
    MockUSDC internal reserve;

    address internal admin = address(0xA11CE);
    uint256 internal constant LOAN_ID = 1;
    // Tiny per-second rate (scaled by RATE_SCALE = 1e18): visible accrual without
    // overflow at 365-day warps on the seeded principal sizes.
    uint256 internal constant RATE = 1e9;

    // #10/#66 the canonical actors — 2 verified holders + 1 unverified.
    address internal verified1 = address(0x11);
    address internal verified2 = address(0x12);
    address internal unverified = address(0x31);

    function _deployAndSeed() internal {
        id = new IdentityRegistry(admin);
        reserve = new MockUSDC();
        token = new CreditToken(admin, address(id), address(reserve), RATE, type(uint256).max);

        vm.startPrank(admin);
        id.setClaims(verified1, IIdentityRegistry.Claims(true));
        id.setClaims(verified2, IIdentityRegistry.Claims(true));
        // unverified left unregistered (verified == false by default).
        vm.stopPrank();
    }

    // #10 issuer mint helper (the permissioning check runs on the recipient).
    function _mintTo(address to, uint256 amount) internal {
        vm.prank(admin);
        token.mint(to, LOAN_ID, amount);
    }
}
