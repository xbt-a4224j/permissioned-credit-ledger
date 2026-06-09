// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Canonical seed config (the loan-tape genesis) · #12
// The single source of the deterministic world Deploy.s.sol (#12) stands up and the
// off-chain layer (indexer #16, resolvers #21, matrix verifier #27) asserts against:
// the 6 canonical identities and the 6 loans modeled as first-lien MORTGAGES. Addresses
// are the well-known Anvil/avalanche-local accounts (mnemonic-index 1..6) so live-chain
// behavior and the test seed (helpers/SeedIdentities.sol) line up. No RPC/chainId here —
// the same library deploys unchanged to a local node and to Fuji via an --rpc-url swap.

import {ICreditToken} from "../../src/interfaces/ICreditToken.sol";
import {IIdentityRegistry} from "../../src/interfaces/IIdentityRegistry.sol";
import {IComplianceRegistry} from "../../src/interfaces/IComplianceRegistry.sol";

library Identities {
    // #12 the 6 canonical actors — deterministic Anvil accounts (mnemonic-index 1..6).
    // index 0 is the deployer/issuer (the broadcaster), kept out of the holder set.
    address internal constant ACCREDITED_US_1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // idx 1
    address internal constant ACCREDITED_US_2 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // idx 2
    address internal constant REGS_NONUS_1 = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // idx 3
    address internal constant REGS_NONUS_2 = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65; // idx 4
    address internal constant UNVERIFIED = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc; // idx 5
    address internal constant FROZEN = 0x976EA74026E726554dB657fA54763abd0C3a0aa9; // idx 6

    // #12 ISO-3166 numeric jurisdiction codes recorded in the manifest for the
    // off-chain layer: US = 840, Cayman (a representative Reg-S domicile) = 136.
    uint16 internal constant US_CODE = 840;
    uint16 internal constant NONUS_CODE = 136;

    // #12 a seed identity: the wallet plus its full on-chain claim set. `register`
    // false means the address is left UNREGISTERED so row 3 (NotEligible) fires
    // out of the box; `frozen` true drives row 4 (ReceiverFrozen).
    struct SeedIdentity {
        address wallet;
        bool register;
        bool verified;
        bool accredited;
        IIdentityRegistry.Jurisdiction jurisdiction;
        bool frozen;
        uint16 jurisdictionCode; // ISO-3166 numeric, for the manifest
    }

    // The loan-tape row: a first-lien MORTGAGE on a Property.
    // collateralType is the seam (CRE today, residential-ready). offering selects the
    // RegD (accreditation-gated) or RegS (non-US-gated) ComplianceRegistry the token
    // binds. ratePerSecond/status are varied so the demo and matrix exercise live
    // accrual, a delinquent loan, and a defaulted (accrual-halted) loan. LTV/DSCR are
    // off-chain mortgage attributes carried straight into the manifest.
    struct SeedLoan {
        uint256 loanId;
        string collateralType; // "CRE" | "RESIDENTIAL"
        string label; // human property label for the loan tape
        uint256 principal; // 6dp (matches CreditToken/USDC decimals)
        uint256 ratePerSecond; // scaled by CreditToken.RATE_SCALE (1e18)
        uint16 ltvBps; // loan-to-value, basis points
        uint16 dscrBps; // debt-service-coverage ratio, basis points
        IComplianceRegistry.Offering offering;
        ICreditToken.LoanStatus status;
    }

    // #12 the 6 canonical identities: 2 accredited-US, 2 Reg-S non-US, 1 unverified
    // (left unregistered), 1 frozen. Matches helpers/SeedIdentities.sol's claim mix.
    function seedIdentities() internal pure returns (SeedIdentity[6] memory s) {
        s[0] = SeedIdentity(ACCREDITED_US_1, true, true, true, IIdentityRegistry.Jurisdiction.US, false, US_CODE);
        s[1] = SeedIdentity(ACCREDITED_US_2, true, true, true, IIdentityRegistry.Jurisdiction.US, false, US_CODE);
        s[2] = SeedIdentity(REGS_NONUS_1, true, true, false, IIdentityRegistry.Jurisdiction.NonUS, false, NONUS_CODE);
        s[3] = SeedIdentity(REGS_NONUS_2, true, true, false, IIdentityRegistry.Jurisdiction.NonUS, false, NONUS_CODE);
        // UNVERIFIED: register == false -> left unregistered (row 3 fires).
        s[4] = SeedIdentity(UNVERIFIED, false, false, false, IIdentityRegistry.Jurisdiction.Unknown, false, NONUS_CODE);
        // FROZEN: verified but frozen (row 4 fires on first transfer).
        s[5] = SeedIdentity(FROZEN, true, true, true, IIdentityRegistry.Jurisdiction.US, true, US_CODE);
    }

    // #12 the 6 loans as first-lien mortgages: 5 CRE + 1 RESIDENTIAL, varied LTV/DSCR,
    // varied ratePerSecond and status. The residential row proves collateral-generality
    // (same rails, different asset). RATE_SCALE = 1e18, so ratePerSecond ~1e8..1e9 gives
    // visible-but-bounded accrual at the seeded principals across 365-day warps.
    function seedLoans() internal pure returns (SeedLoan[6] memory l) {
        // Loan 1 — CRE, Reg-D, performing, the anchor position for the indexer backfill.
        l[0] = SeedLoan(
            1,
            "CRE",
            "Office Tower - 100 Market St",
            5_000_000e6,
            1e9,
            6500, // 65% LTV
            14000, // 1.40x DSCR
            IComplianceRegistry.Offering.RegD,
            ICreditToken.LoanStatus.PERFORMING
        );
        // Loan 2 — CRE, Reg-D, performing, higher leverage / thinner coverage.
        l[1] = SeedLoan(
            2,
            "CRE",
            "Industrial Park - 4500 Logistics Pkwy",
            3_200_000e6,
            8e8,
            7200, // 72% LTV
            12500, // 1.25x DSCR
            IComplianceRegistry.Offering.RegD,
            ICreditToken.LoanStatus.PERFORMING
        );
        // Loan 3 — CRE, Reg-S (non-US offering), performing.
        l[2] = SeedLoan(
            3,
            "CRE",
            "Retail Center - 88 Harbour Rd",
            2_750_000e6,
            7e8,
            6000, // 60% LTV
            15500, // 1.55x DSCR
            IComplianceRegistry.Offering.RegS,
            ICreditToken.LoanStatus.PERFORMING
        );
        // Loan 4 — CRE, Reg-D, DELINQUENT (still accruing; off-chain NAV-watched).
        l[3] = SeedLoan(
            4,
            "CRE",
            "Multifamily - 210 Riverside Ave",
            4_100_000e6,
            9e8,
            7500, // 75% LTV
            11000, // 1.10x DSCR (stressed)
            IComplianceRegistry.Offering.RegD,
            ICreditToken.LoanStatus.DELINQUENT
        );
        // Loan 5 — CRE, Reg-D, DEFAULT (accrual halted at deploy, mirrors row 9 path).
        l[4] = SeedLoan(
            5,
            "CRE",
            "Hotel - 1 Grand Plaza",
            6_800_000e6,
            12e8,
            8000, // 80% LTV
            9500, // 0.95x DSCR (sub-1.0, in default)
            IComplianceRegistry.Offering.RegD,
            ICreditToken.LoanStatus.DEFAULT
        );
        // Loan 6 — RESIDENTIAL, Reg-D, performing. The seam: residential plugs into the
        // same rails (consumer-law gating is a NAMED-BUT-CUT extension point, DESIGN.md).
        l[5] = SeedLoan(
            6,
            "RESIDENTIAL",
            "Single-Family - 27 Elm Court",
            850_000e6,
            5e8,
            8500, // 85% LTV
            13000, // 1.30x DSCR
            IComplianceRegistry.Offering.RegD,
            ICreditToken.LoanStatus.PERFORMING
        );
    }

    // #12 stringify a LoanStatus for the manifest (the off-chain status replay reads it).
    function statusName(ICreditToken.LoanStatus st) internal pure returns (string memory) {
        if (st == ICreditToken.LoanStatus.PERFORMING) return "PERFORMING";
        if (st == ICreditToken.LoanStatus.DELINQUENT) return "DELINQUENT";
        return "DEFAULT";
    }

    // #12 stringify an Offering for the manifest.
    function offeringName(IComplianceRegistry.Offering o) internal pure returns (string memory) {
        return o == IComplianceRegistry.Offering.RegD ? "RegD" : "RegS";
    }
}
