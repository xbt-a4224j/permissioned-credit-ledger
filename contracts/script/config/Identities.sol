// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Canonical seed config (the loan-tape genesis) · #12/#66
// The single source of the deterministic world Deploy.s.sol (#12) stands up and the
// off-chain layer (indexer #16, resolvers #21, matrix verifier #27) asserts against:
// the 3 canonical identities (#66 collapsed compliance to verified-only) and the 6 loans
// modeled as first-lien MORTGAGES. Addresses are the well-known Anvil/avalanche-local
// accounts (mnemonic-index 1,2,5) so live-chain behavior and the test seed
// (helpers/SeedIdentities.sol) line up. No RPC/chainId here — the same library deploys
// unchanged to a local node and to Fuji via an --rpc-url swap.

import {ICreditToken} from "../../src/interfaces/ICreditToken.sol";

library Identities {
    // #12/#66 the 3 canonical actors — deterministic Anvil accounts. Two verified holders
    // and one left unverified (the permissioning demo beat). Index 0 is the deployer/issuer.
    address internal constant VERIFIED_1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // idx 1
    address internal constant VERIFIED_2 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // idx 2
    address internal constant UNVERIFIED = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc; // idx 5

    // #12/#66 a seed identity: the wallet plus its single `verified` claim. An unverified
    // wallet (verified == false) reverts ReceiverNotVerified on any mint/transfer to it.
    struct SeedIdentity {
        address wallet;
        bool verified;
    }

    // The loan-tape row: a first-lien MORTGAGE on a Property. collateralType is the seam
    // (CRE today, residential-ready). ratePerSecond/status are varied so the demo and matrix
    // exercise live accrual, a delinquent loan, and a defaulted (accrual-halted) loan.
    // LTV/DSCR are off-chain mortgage attributes carried straight into the manifest.
    struct SeedLoan {
        uint256 loanId;
        string collateralType; // "CRE" | "RESIDENTIAL"
        string label; // human property label for the loan tape
        uint256 principal; // 6dp (matches CreditToken/USDC decimals)
        uint256 ratePerSecond; // scaled by CreditToken.RATE_SCALE (1e18)
        uint16 ltvBps; // loan-to-value, basis points
        uint16 dscrBps; // debt-service-coverage ratio, basis points
        ICreditToken.LoanStatus status;
    }

    // #12/#66 the 3 canonical identities: 2 verified holders + 1 unverified.
    // Matches helpers/SeedIdentities.sol's claim mix.
    function seedIdentities() internal pure returns (SeedIdentity[3] memory s) {
        s[0] = SeedIdentity(VERIFIED_1, true);
        s[1] = SeedIdentity(VERIFIED_2, true);
        s[2] = SeedIdentity(UNVERIFIED, false);
    }

    // #12 the 6 loans as first-lien mortgages: 5 CRE + 1 RESIDENTIAL, varied LTV/DSCR,
    // varied ratePerSecond and status. The residential row proves collateral-generality
    // (same rails, different asset). RATE_SCALE = 1e18, so ratePerSecond ~1e8..1e9 gives
    // visible-but-bounded accrual at the seeded principals across 365-day warps.
    function seedLoans() internal pure returns (SeedLoan[6] memory l) {
        // Loan 1 — CRE, performing, the anchor position for the indexer backfill.
        l[0] = SeedLoan(
            1, "CRE", "Office Tower - 100 Market St", 5_000_000e6, 1e9, 6500, 14000, ICreditToken.LoanStatus.PERFORMING
        );
        // Loan 2 — CRE, performing, higher leverage / thinner coverage.
        l[1] = SeedLoan(
            2,
            "CRE",
            "Industrial Park - 4500 Logistics Pkwy",
            3_200_000e6,
            8e8,
            7200,
            12500,
            ICreditToken.LoanStatus.PERFORMING
        );
        // Loan 3 — CRE, performing.
        l[2] = SeedLoan(
            3, "CRE", "Retail Center - 88 Harbour Rd", 2_750_000e6, 7e8, 6000, 15500, ICreditToken.LoanStatus.PERFORMING
        );
        // Loan 4 — CRE, DELINQUENT (still accruing; off-chain NAV-watched).
        l[3] = SeedLoan(
            4,
            "CRE",
            "Multifamily - 210 Riverside Ave",
            4_100_000e6,
            9e8,
            7500,
            11000,
            ICreditToken.LoanStatus.DELINQUENT
        );
        // Loan 5 — CRE, DEFAULT (accrual halted at deploy, mirrors row 9 path).
        l[4] =
            SeedLoan(5, "CRE", "Hotel - 1 Grand Plaza", 6_800_000e6, 12e8, 8000, 9500, ICreditToken.LoanStatus.DEFAULT);
        // Loan 6 — RESIDENTIAL, performing. The seam: residential plugs into the same rails
        // (consumer-law gating is a NAMED-BUT-CUT extension point, DESIGN.md).
        l[5] = SeedLoan(
            6,
            "RESIDENTIAL",
            "Single-Family - 27 Elm Court",
            850_000e6,
            5e8,
            8500,
            13000,
            ICreditToken.LoanStatus.PERFORMING
        );
    }

    // #12 stringify a LoanStatus for the manifest (the off-chain status replay reads it).
    function statusName(ICreditToken.LoanStatus st) internal pure returns (string memory) {
        if (st == ICreditToken.LoanStatus.PERFORMING) return "PERFORMING";
        if (st == ICreditToken.LoanStatus.DELINQUENT) return "DELINQUENT";
        return "DEFAULT";
    }
}
