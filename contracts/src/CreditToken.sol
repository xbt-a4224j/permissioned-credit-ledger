// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICreditToken} from "./interfaces/ICreditToken.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IComplianceRegistry} from "./interfaces/IComplianceRegistry.sol";

// #8 CreditToken — ERC-3643-lite permissioned security token representing a single
// loan series. Every balance change routes through the OZ v5 `_update` hook, the
// single chokepoint where the freeze -> receiver-verified -> compliance gauntlet
// runs and reverts the typed errors matrix rows 3-6 assert. Issuer-gated
// mint/burn. Accrual + reentrancy-safe claim land in #9.
contract CreditToken is ERC20, AccessControl, ICreditToken {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // #8 the identity + compliance registries the gauntlet consults.
    IIdentityRegistry public immutable identity;
    IComplianceRegistry public immutable compliance;

    // #8 holder -> loanId opened on mint (single loan series, single loanOf).
    mapping(address => uint256) public loanOf;

    // #8 loan-series status; accrual is gated on it in #9 (no accrual at DEFAULT).
    LoanStatus public status;

    constructor(address admin, address identityReg, address complianceReg) ERC20("Credit Token", "CRDT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        identity = IIdentityRegistry(identityReg);
        compliance = IComplianceRegistry(complianceReg);
    }

    // #8 6 decimals to match the mock-USDC reserve (#9).
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // #8 issuer-gated issuance: opens a position and emits PositionOpened. The
    // gauntlet still runs on the recipient via _update (mint path), so minting to
    // an unverified/frozen address reverts (matrix row 3).
    function mint(address to, uint256 loanId, uint256 amount) external onlyRole(ISSUER_ROLE) {
        loanOf[to] = loanId;
        _mint(to, amount);
        emit PositionOpened(to, loanId, amount);
    }

    // #8 issuer-gated clawback; bypasses the gauntlet by design (burn path in
    // _update skips checks) so a frozen holder's tokens can still be reclaimed.
    function burn(address from, uint256 amount) external onlyRole(ISSUER_ROLE) {
        _burn(from, amount);
    }

    // #8 issuer sets the loan-series status; emits LoanStatusChanged. Accrual gate
    // consumes this in #9 (DEFAULT halts accrual).
    function setLoanStatus(uint256 loanId, LoanStatus newStatus) external onlyRole(ISSUER_ROLE) {
        status = newStatus;
        emit LoanStatusChanged(loanId, newStatus);
    }

    // #8 THE chokepoint — every mint/transfer/burn funnels here. Run the gauntlet
    // on holder-to-holder transfers and on the recipient of a mint; skip burns
    // (to == 0) so issuer clawback works. compliance.checkTransfer reverts the
    // typed error; super._update runs LAST so a reverting check never mutates
    // balances. Matrix rows 3-6.
    function _update(address from, address to, uint256 amount) internal override {
        // Skip the gauntlet only on burns (to == address(0)); mints (from == 0)
        // and transfers both gate the recipient.
        if (to != address(0)) {
            compliance.checkTransfer(from, to, amount);
        }
        super._update(from, to, amount);
    }

    // #8 placeholder claim surface satisfying ICreditToken; real accrual/claim
    // (settle -> zero -> pay from reserve, nonReentrant) lands in #9.
    function claimable(address) public view virtual returns (uint256) {
        return 0;
    }

    function claim() external virtual {
        revert("not implemented until #9");
    }
}
