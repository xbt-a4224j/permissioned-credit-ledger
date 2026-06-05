// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// #9 MockUSDC — the mocked servicing reserve claim() pays from. A minimal 6dp
// ERC20 with an open mint so tests and the deploy script can fund the reserve.
// Real fiat ramp / real USDC is deliberately cut (see DESIGN.md "what's cut").
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    // #9 6 decimals to match CreditToken and real USDC.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // #9 open mint — fund the reserve (or holders) in tests / seed deploy.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
