// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// #5/#66 custom error taxonomy — the typed reason codes the transfer gauntlet and
// claim path revert with. Declared once at file scope and imported by name everywhere
// (token, tests) so there is a single source of truth for every 4-byte selector the
// indexer (#16) and GraphQL mapper (#21) decode. These ARE the reason codes — never
// stringly-typed failures. (#66 collapsed compliance to verified-only: the offering /
// accreditation / sanctions-freeze reverts — NotEligible, AccreditationRequired,
// SenderFrozen, ReceiverFrozen — are gone with the ComplianceRegistry.)
//
// Engine states NavAnomaly / ReconMismatch are off-chain TS unions (#14/#17/#18),
// NOT Solidity errors — deliberately kept out of this file.

// #5/#66 transfer/mint to an unverified receiver — the sole compliance revert: a
// permissioned token only a KYC'd (verified) wallet may hold.
error ReceiverNotVerified(address account);

// #5 matrix row 8: claim against an underfunded reserve. Typed args expose the
// shortfall (requested vs available) for the off-chain reconciler.
error InsufficientReserve(uint256 requested, uint256 available);

// #5 issuance guard: a mint that would push total supply past the loan's principal
// is rejected ON-CHAIN — the chain is the single authority for how much of a loan
// exists, so the cap cannot be a (lagging) off-chain check. Typed args expose the
// attempted total vs the cap for the off-chain reconciler / UI badge.
error ExceedsPrincipal(uint256 requested, uint256 cap);
