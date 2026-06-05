// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

// #6 IdentityRegistry — the trust boundary the eligibility gauntlet reads from.
// Stores per-wallet claims {verified, accredited, jurisdiction, frozen} and serves
// the hot-path view functions CreditToken._update (#8) calls. Issuer-only setters.
// Matrix rows 1-5 resolve against these reads.
contract IdentityRegistry is AccessControl, IIdentityRegistry {
    // #6 issuer role gates every claim mutation; admin holds it at deploy.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // #6 wallet -> claims; default (un-set) is all-false / Jurisdiction.Unknown.
    mapping(address => Claims) private _claims;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    // --- reads (hot path, view-only, called by the gauntlet) ---

    // #6 matrix rows 3-5: verification check used by the compliance gauntlet.
    function isVerified(address account) external view returns (bool) {
        return _claims[account].verified;
    }

    // #6 eligibility = verified && !frozen. Deliberately EXCLUDES accreditation so
    // row 6 (AccreditationRequired) stays a distinct typed revert in #7.
    function isEligible(address account) external view returns (bool) {
        Claims storage c = _claims[account];
        return c.verified && !c.frozen;
    }

    // #6 matrix row 4: freeze check (highest-precedence gauntlet step).
    function isFrozen(address account) external view returns (bool) {
        return _claims[account].frozen;
    }

    // #6 matrix row 6: accreditation check for the Reg-D path.
    function isAccredited(address account) external view returns (bool) {
        return _claims[account].accredited;
    }

    // #6 matrix row 2: jurisdiction check for the Reg-S path.
    function jurisdictionOf(address account) external view returns (Jurisdiction) {
        return _claims[account].jurisdiction;
    }

    function claimsOf(address account) external view returns (Claims memory) {
        return _claims[account];
    }

    // --- issuer-only setters (each emits ClaimsUpdated for the indexer) ---

    // #6 set the whole claim set in one call (used by the seed path).
    function setClaims(address account, Claims calldata claims) external onlyRole(ISSUER_ROLE) {
        _claims[account] = claims;
        _emitClaims(account);
    }

    function setVerified(address account, bool verified) external onlyRole(ISSUER_ROLE) {
        _claims[account].verified = verified;
        _emitClaims(account);
    }

    function setAccredited(address account, bool accredited) external onlyRole(ISSUER_ROLE) {
        _claims[account].accredited = accredited;
        _emitClaims(account);
    }

    function setJurisdiction(address account, Jurisdiction j) external onlyRole(ISSUER_ROLE) {
        _claims[account].jurisdiction = j;
        _emitClaims(account);
    }

    function setFrozen(address account, bool frozen) external onlyRole(ISSUER_ROLE) {
        _claims[account].frozen = frozen;
        _emitClaims(account);
    }

    // #6 single emission point so every mutation surfaces the full post-state.
    function _emitClaims(address account) private {
        Claims storage c = _claims[account];
        emit ClaimsUpdated(account, c.verified, c.accredited, c.jurisdiction, c.frozen);
    }
}
