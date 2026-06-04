// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// #5 identity layer interface — the trust boundary the eligibility gauntlet reads
// from (who is verified, accredited, what jurisdiction, who is frozen). Matrix
// rows 1-5 resolve against these view functions; the recon engine re-checks the
// same claims off-chain. ABI pinned before IdentityRegistry implementation (#6).
interface IIdentityRegistry {
    // #5 US vs non-US split for Reg-D / Reg-S gating. Unknown = 0 so an un-set
    // address is correctly NOT NonUS by default.
    enum Jurisdiction {
        Unknown,
        US,
        NonUS
    }

    // #5 the full claim set stored per wallet.
    struct Claims {
        bool verified;
        bool accredited;
        Jurisdiction jurisdiction;
        bool frozen;
    }

    // #5 emitted on every claim mutation so the indexer can rebuild identity state.
    event ClaimsUpdated(
        address indexed account, bool verified, bool accredited, Jurisdiction jurisdiction, bool frozen
    );

    // #5 hot-path reads called by CreditToken._update (#8).
    function isVerified(address account) external view returns (bool);
    function isEligible(address account) external view returns (bool);
    function isFrozen(address account) external view returns (bool);
    function isAccredited(address account) external view returns (bool);
    function jurisdictionOf(address account) external view returns (Jurisdiction);
    function claimsOf(address account) external view returns (Claims memory);
}
