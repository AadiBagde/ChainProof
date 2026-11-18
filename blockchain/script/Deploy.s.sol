// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {EvidenceRegistry} from "../src/EvidenceRegistry.sol";
import {CustodyManager} from "../src/CustodyManager.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        EvidenceRegistry registry = new EvidenceRegistry();
        console.log("EvidenceRegistry deployed at:", address(registry));
        console.log("  owner:", registry.owner());

        CustodyManager manager = new CustodyManager(address(registry));
        console.log("CustodyManager  deployed at:", address(manager));
        console.log("  registry ref:", address(manager.registry()));

        registry.setCustodyManager(address(manager));
        console.log("EvidenceRegistry.setCustodyManager() called successfully");

        vm.stopBroadcast();

        address recordedManager = registry.custodyManager();
        bool    isSet           = registry.custodyManagerSet();
        address registryInMgr  = address(manager.registry());

        require(recordedManager == address(manager),  "WIRING FAIL: registry.custodyManager mismatch");
        require(isSet,                                 "WIRING FAIL: custodyManagerSet is false");
        require(registryInMgr  == address(registry),  "WIRING FAIL: manager.registry mismatch");

        console.log("------------------------------------------------------------");
        console.log("Deployment verified on chain ID:", block.chainid);
        console.log("  EvidenceRegistry :", address(registry));
        console.log("  CustodyManager   :", address(manager));
        console.log("  Wiring           : OK");
        console.log("------------------------------------------------------------");
        console.log("Add these to frontend/.env.local:");
        console.log("  VITE_EVIDENCE_REGISTRY_ADDRESS=", address(registry));
        console.log("  VITE_CUSTODY_MANAGER_ADDRESS=", address(manager));
        console.log("  VITE_CHAIN_ID=", block.chainid);
        console.log("------------------------------------------------------------");
        console.log("NOTE: Restarting Anvil erases deployed state.");
        console.log("      Rerun this script after every fresh Anvil start.");
    }
}
