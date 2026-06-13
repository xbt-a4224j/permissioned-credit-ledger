// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// #5/#66 identity layer interface — the trust boundary the permissioning check reads
// from. Collapsed to a single `verified` claim (#66): a wallet may hold the token iff
// it is KYC-verified. CreditToken._update (#8) reads isVerified; the recon engine
// re-checks the same claim off-chain (I4). ABI pinned before the implementation (#6).
interface IIdentityRegistry {
    // #5/#66 the claim set stored per wallet — just `verified` after the compliance collapse.
    struct Claims {
        bool verified;
    }

    // #5/#66 emitted on every claim mutation so the indexer can rebuild identity state.
    event ClaimsUpdated(address indexed account, bool verified);

    // #5/#66 hot-path read called by CreditToken._update (#8).
    function isVerified(address account) external view returns (bool);

    // #5/#66 full claim read (the KYC status read-back, #47).
    function claimsOf(address account) external view returns (Claims memory);
}
