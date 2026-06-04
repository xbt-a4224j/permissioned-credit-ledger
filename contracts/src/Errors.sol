// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// #5 custom error taxonomy — the five typed reason codes the whole transfer
// gauntlet and claim path revert with. Declared once at file scope and imported
// by name everywhere (registries, token, tests) so there is a single source of
// truth for every 4-byte selector the indexer (#16) and GraphQL mapper (#21)
// decode. These ARE the reason codes — never stringly-typed failures.
//
// Engine states NavAnomaly / ReconMismatch are off-chain TS unions (#14/#17/#18),
// NOT Solidity errors — deliberately kept out of this file.

// #5 matrix row 3: receiver not eligible (verified && !frozen failed, or Reg-S
// jurisdiction mismatch). Carries the offending account.
error NotEligible(address account);

// #5 matrix row 4: transfer/mint to a frozen receiver.
error ReceiverFrozen(address account);

// #5 matrix row 5: transfer/mint to an unverified receiver.
error ReceiverNotVerified(address account);

// #5 matrix row 6: Reg-D offering requires the receiver to be accredited.
error AccreditationRequired(address account);

// #5 matrix row 8: claim against an underfunded reserve. Typed args expose the
// shortfall (requested vs available) for the off-chain reconciler.
error InsufficientReserve(uint256 requested, uint256 available);
