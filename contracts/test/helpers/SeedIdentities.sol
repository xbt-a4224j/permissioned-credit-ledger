// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {ComplianceRegistry} from "../../src/ComplianceRegistry.sol";
import {CreditToken} from "../../src/CreditToken.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {IComplianceRegistry} from "../../src/interfaces/IComplianceRegistry.sol";
import {IIdentityRegistry} from "../../src/interfaces/IIdentityRegistry.sol";

// #10 reusable setUp mixin — deploys IdentityRegistry + ComplianceRegistry +
// CreditToken + MockUSDC reserve and seeds the 6 canonical identities (2
// accredited-US, 2 Reg-S non-US, 1 unverified, 1 frozen). Shared by #10 (matrix
// coverage) and #11 (fuzz/invariant) so both suites assert against one seed
// surface and the same actor addresses the deploy script (#12) will use.
abstract contract SeedIdentities is Test {
    IdentityRegistry internal id;
    ComplianceRegistry internal compliance; // Reg-D (accreditation-gated) token
    CreditToken internal token;
    MockUSDC internal reserve;

    address internal admin = address(0xA11CE);
    uint256 internal constant LOAN_ID = 1;
    // Tiny per-second rate (scaled by RATE_SCALE = 1e18): visible accrual without
    // overflow at 365-day warps on the seeded principal sizes.
    uint256 internal constant RATE = 1e9;

    // #10 the 6 canonical actors — deterministic addresses mirroring the matrix.
    address internal accreditedUS1 = address(0x11);
    address internal accreditedUS2 = address(0x12);
    address internal regsNonUS1 = address(0x21);
    address internal regsNonUS2 = address(0x22);
    address internal unverified = address(0x31);
    address internal frozen = address(0x41);
    // Extra: US holder that is verified but NOT accredited (row 6 actor).
    address internal usNonAccredited = address(0x51);

    function _deployAndSeed() internal {
        id = new IdentityRegistry(admin);
        compliance = new ComplianceRegistry(admin, address(id), IComplianceRegistry.Offering.RegD);
        reserve = new MockUSDC();
        token = new CreditToken(admin, address(id), address(compliance), address(reserve), RATE);

        vm.startPrank(admin);
        // 2 accredited-US.
        id.setClaims(accreditedUS1, IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        id.setClaims(accreditedUS2, IIdentityRegistry.Claims(true, true, IIdentityRegistry.Jurisdiction.US, false));
        // 2 Reg-S non-US.
        id.setClaims(regsNonUS1, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.NonUS, false));
        id.setClaims(regsNonUS2, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.NonUS, false));
        // unverified left unregistered (verified == false by default).
        // 1 frozen (verified but frozen).
        id.setClaims(frozen, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.US, true));
        // row-6 actor: verified US, not accredited.
        id.setClaims(usNonAccredited, IIdentityRegistry.Claims(true, false, IIdentityRegistry.Jurisdiction.US, false));
        vm.stopPrank();
    }

    // #10 issuer mint helper (gauntlet runs on the recipient).
    function _mintTo(address to, uint256 amount) internal {
        vm.prank(admin);
        token.mint(to, LOAN_ID, amount);
    }
}
