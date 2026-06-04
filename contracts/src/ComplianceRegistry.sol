// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IComplianceRegistry} from "./interfaces/IComplianceRegistry.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {NotEligible, ReceiverFrozen, ReceiverNotVerified, AccreditationRequired} from "./Errors.sol";

// #7 ComplianceRegistry — the modular Reg-D / Reg-S rule engine that turns raw
// identity claims into a transfer decision and produces the typed revert per
// matrix branch. checkTransfer runs the gauntlet in fixed precedence order;
// canTransfer is the non-reverting preflight. Pure function of registry state
// (the recon engine's identity-valid invariant relies on this).
contract ComplianceRegistry is AccessControl, IComplianceRegistry {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // #7 the identity source of truth this registry decides against.
    IIdentityRegistry public immutable identity;
    // #7 offering regime fixed once at deploy (RegD = accreditation-gated).
    Offering public immutable offering;

    constructor(address admin, address identityRegistry, Offering _offering) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        identity = IIdentityRegistry(identityRegistry);
        offering = _offering;
    }

    // #7 the reverting gauntlet — fixed order, reverts the FIRST failing typed
    // error. Order is observable (matrix rows 3-6): freeze beats verification
    // beats eligibility beats the offering-specific rule.
    // `from`/`amount` are named for module extensibility; the seeded ruleset
    // only gates on `to`.
    function checkTransfer(address from, address to, uint256 amount) public view {
        // #7 gauntlet step 1: frozen receiver — matrix row 4.
        if (identity.isFrozen(to)) revert ReceiverFrozen(to);
        // #7 gauntlet step 2: unverified receiver — matrix row 5.
        if (!identity.isVerified(to)) revert ReceiverNotVerified(to);
        // #7 gauntlet step 3: not eligible (verified && !frozen) — matrix row 3.
        if (!identity.isEligible(to)) revert NotEligible(to);
        // #7 gauntlet step 4a: Reg-D requires accreditation — matrix row 6.
        if (offering == Offering.RegD && !identity.isAccredited(to)) {
            revert AccreditationRequired(to);
        }
        // #7 gauntlet step 4b: Reg-S requires non-US jurisdiction — matrix row 2.
        // A US holder under Reg-S is "not eligible", not "un-accredited".
        if (offering == Offering.RegS && identity.jurisdictionOf(to) != IIdentityRegistry.Jurisdiction.NonUS) {
            revert NotEligible(to);
        }
    }

    // #7 non-reverting parity wrapper for read-model / preflight (#21). Mirrors
    // the same predicates without reverting so the API can show eligibility.
    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        if (identity.isFrozen(to)) return false;
        if (!identity.isVerified(to)) return false;
        if (!identity.isEligible(to)) return false;
        if (offering == Offering.RegD && !identity.isAccredited(to)) return false;
        if (offering == Offering.RegS && identity.jurisdictionOf(to) != IIdentityRegistry.Jurisdiction.NonUS) {
            return false;
        }
        return true;
    }
}
