// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// #5 custom error taxonomy — the six typed reason codes the whole transfer
// gauntlet and claim path revert with. Declared once at file scope and imported
// by name everywhere (registries, token, tests) so there is a single source of
// truth for every 4-byte selector the indexer (#16) and GraphQL mapper (#21)
// decode. These ARE the reason codes — never stringly-typed failures.
//
// Engine states NavAnomaly / ReconMismatch are off-chain TS unions (#14/#17/#18),
// NOT Solidity errors — deliberately kept out of this file.

// #5 matrix row 4: frozen sender initiates a transfer. Checked first (step 0 of
// the gauntlet) so a frozen holder cannot move tokens out regardless of the receiver.
error SenderFrozen(address account);

// #5 receiver-side freeze: transfer/mint to a frozen receiver (step 1 of gauntlet,
// after sender check). No dedicated matrix row; covered by compliance unit tests.
error ReceiverFrozen(address account);

// #5 matrix row 3: transfer/mint to an unverified receiver (step 2: not verified).
error ReceiverNotVerified(address account);

// #5 matrix row 5: receiver is verified but not eligible for this offering —
// Reg-S jurisdiction mismatch (US holder on a Reg-S token). The compliance catch-all.
error NotEligible(address account);

// #5 matrix row 6: Reg-D offering requires the receiver to be accredited.
error AccreditationRequired(address account);

// #5 matrix row 8: claim against an underfunded reserve. Typed args expose the
// shortfall (requested vs available) for the off-chain reconciler.
error InsufficientReserve(uint256 requested, uint256 available);
