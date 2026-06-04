// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// #5 compliance interface — the modular rule engine that turns identity claims
// into a Reg-D / Reg-S transfer decision. checkTransfer reverts the typed error
// per matrix branch (rows 3-6); canTransfer is the non-reverting preflight the
// API read-model uses. ABI pinned before ComplianceRegistry implementation (#7).
interface IComplianceRegistry {
    // #5 the offering regime fixed at deploy: RegD gates on accreditation,
    // RegS gates on non-US jurisdiction.
    enum Offering {
        RegD,
        RegS
    }

    // #5 non-reverting predicate for read-model / preflight use (#21).
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    // #5 reverting gauntlet variant — the chokepoint CreditToken._update (#8) calls;
    // reverts the first failing typed error in fixed order.
    function checkTransfer(address from, address to, uint256 amount) external view;

    function offering() external view returns (Offering);
}
