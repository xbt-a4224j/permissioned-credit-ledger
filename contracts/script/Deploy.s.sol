// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Deterministic genesis: deploy the permissioned stack + seed manifest · #12/#66
// One command stands up the KNOWN world every downstream block consumes: the shared
// IdentityRegistry + MockUSDC reserve, plus 6 CreditToken loans (single loan per token).
// Seeds the 3 canonical identities (#66 verified-only) and the 6 loans as first-lien
// MORTGAGES (5 CRE + 1 RESIDENTIAL, varied LTV/DSCR/rate/status), then writes
// deployments/<chainId>.json — the seed manifest the off-chain layer (indexer #16,
// resolvers #21, matrix verifier #27) reads. No hardcoded RPC/chainId: the same script runs
// unchanged against a local anvil node (CI/tests) and Avalanche Fuji (the live demo) via an
// --rpc-url swap.

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {CreditToken} from "../src/CreditToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ICreditToken} from "../src/interfaces/ICreditToken.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {Identities} from "./config/Identities.sol";

contract Deploy is Script {
    // #12 reserve funding: generous enough that funded claims (matrix row 7) succeed for
    // the demo; the underfunded path (row 8, InsufficientReserve) is exercised by the
    // matrix verifier (#27) over-claiming, not by under-funding the seed.
    uint256 internal constant RESERVE_FUNDING = 1_000_000e6;
    // #12 the anchor position opened for VERIFIED_1 on loan 1 so the indexer has a
    // PositionOpened event to backfill immediately.
    uint256 internal constant ANCHOR_POSITION = 100_000e6;

    function run() external {
        // #12 single-sender demo deploy: the broadcaster is admin + issuer + reserve
        // funder. Prod would seed from per-role keys (documented, not built here).
        vm.startBroadcast();

        // --- shared infrastructure (one identity registry, one reserve) ---
        IdentityRegistry identity = new IdentityRegistry(msg.sender);
        MockUSDC reserve = new MockUSDC();

        // --- seed the 3 canonical identities (#66 verified-only) ---
        // The two verified holders can hold tokens; UNVERIFIED (verified == false) reverts
        // ReceiverNotVerified on any mint/transfer to it (matrix row 3).
        Identities.SeedIdentity[3] memory people = Identities.seedIdentities();
        for (uint256 i = 0; i < people.length; i++) {
            identity.setClaims(people[i].wallet, IIdentityRegistry.Claims(people[i].verified));
        }

        // --- deploy the 6 loans (one CreditToken each) + set per-loan status ---
        Identities.SeedLoan[6] memory loans = Identities.seedLoans();
        address[6] memory tokens;
        for (uint256 i = 0; i < loans.length; i++) {
            Identities.SeedLoan memory ln = loans[i];
            CreditToken token =
                new CreditToken(msg.sender, address(identity), address(reserve), ln.ratePerSecond, ln.principal);
            // #12 set the loan status so DELINQUENT/DEFAULT loans exist in the world.
            // DEFAULT stamps the accrual halt at deploy (mirrors the off-chain replay).
            if (ln.status != ICreditToken.LoanStatus.PERFORMING) {
                token.setLoanStatus(ln.loanId, ln.status);
            }
            tokens[i] = address(token);
        }

        // --- fund the reserve, then open the anchor position (verified holder only) ---
        // Fund the anchor loan's reserve so funded claims (row 7) succeed for the demo.
        // Landmine (#12 notes): the _update permissioning check runs on mint, so open the
        // anchor position only AFTER VERIFIED_1 is verified — which it is, seeded above.
        reserve.mint(tokens[0], RESERVE_FUNDING);
        CreditToken(tokens[0]).mint(Identities.VERIFIED_1, loans[0].loanId, ANCHOR_POSITION);

        vm.stopBroadcast();

        // #12 log every deployed address for capture by env wiring / copy_abis (#13).
        console2.log("IdentityRegistry  :", address(identity));
        console2.log("MockUSDC reserve  :", address(reserve));
        for (uint256 i = 0; i < tokens.length; i++) {
            console2.log("CreditToken loan", loans[i].loanId, ":", tokens[i]);
        }

        _writeManifest(address(identity), address(reserve), tokens);
    }

    // The manifest is the off-chain layer's genesis input · #12/#66
    // Writes deployments/<chainId>.json with the registry+reserve addresses and, per loan,
    // { loanId, token, collateralType, label, principal, ltvBps, dscrBps, ratePerSecond,
    // status }. chainId comes from block.chainid so local (31337) and Fuji (43113) each get
    // their own manifest. Uses Foundry's JSON serializer for deterministic output.
    function _writeManifest(address identity, address reserve, address[6] memory tokens) internal {
        Identities.SeedLoan[6] memory loans = Identities.seedLoans();

        // Build the per-loan JSON (an object keyed by loanId — the Foundry serializer
        // idiom) first so it nests under the root manifest object.
        string memory loansKey = "loans";
        string memory loansJson;
        for (uint256 i = 0; i < loans.length; i++) {
            Identities.SeedLoan memory ln = loans[i];
            string memory obj = string.concat("loan", vm.toString(ln.loanId));
            vm.serializeUint(obj, "loanId", ln.loanId);
            vm.serializeAddress(obj, "token", tokens[i]);
            vm.serializeString(obj, "collateralType", ln.collateralType);
            vm.serializeString(obj, "label", ln.label);
            vm.serializeString(obj, "principal", vm.toString(ln.principal));
            vm.serializeUint(obj, "ltvBps", ln.ltvBps);
            vm.serializeUint(obj, "dscrBps", ln.dscrBps);
            vm.serializeString(obj, "ratePerSecond", vm.toString(ln.ratePerSecond));
            string memory loanObj = vm.serializeString(obj, "status", Identities.statusName(ln.status));
            // Accumulate under one shared key (the last call returns the full loans object).
            loansJson = vm.serializeString(loansKey, vm.toString(ln.loanId), loanObj);
        }

        // Root manifest object.
        string memory root = "manifest";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "identityRegistry", identity);
        vm.serializeAddress(root, "reserve", reserve);
        string memory finalJson = vm.serializeString(root, loansKey, loansJson);

        string memory path = string.concat(vm.projectRoot(), "/../deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(finalJson, path);
        console2.log("manifest written  :", path);
    }
}
