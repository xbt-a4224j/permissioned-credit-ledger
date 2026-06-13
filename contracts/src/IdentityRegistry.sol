// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

// #6/#66 IdentityRegistry — the trust boundary the permissioning check reads from.
// Stores a single per-wallet claim {verified} (#66 collapsed the old accreditation /
// jurisdiction / sanctions-freeze claims) and serves the hot-path isVerified read
// CreditToken._update (#8) calls. Issuer-only setters.
contract IdentityRegistry is AccessControl, IIdentityRegistry {
    // #6 issuer role gates every claim mutation; admin holds it at deploy.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // #6 wallet -> claims; default (un-set) is verified=false.
    mapping(address => Claims) private _claims;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    // --- reads (hot path, view-only, called by the permissioning check) ---

    // #6/#66 verification check — the sole gate: a wallet may hold the token iff verified.
    function isVerified(address account) external view returns (bool) {
        return _claims[account].verified;
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

    // #6 single emission point so every mutation surfaces the full post-state.
    function _emitClaims(address account) private {
        emit ClaimsUpdated(account, _claims[account].verified);
    }
}
