// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {InkdRegistryV2} from "../src/InkdRegistryV2.sol";

/// @notice Upgrade InkdRegistry proxy to V2 implementation.
/// Must be called by the proxy's owner (DEV_SAFE: 0x52d288c6697044561F99e433F01cd3d5ed4638A1)
contract UpgradeRegistryV2 is Script {
    address constant REGISTRY_PROXY = 0xEd3067dDa601f19A5737babE7Dd3AbfD4a783e5d;
    address constant DEV_SAFE       = 0x52d288c6697044561F99e433F01cd3d5ed4638A1;

    function run() external {
        // Deploy new implementation (no initializer — UUPS)
        vm.startBroadcast();
        InkdRegistryV2 newImpl = new InkdRegistryV2();
        vm.stopBroadcast();

        console.log("New InkdRegistryV2 implementation:", address(newImpl));
        console.log("");
        console.log("=== SAFE TRANSACTION NEEDED ===");
        console.log("Go to: https://app.safe.global/transactions/queue?safe=base:0x52d288c6697044561F99e433F01cd3d5ed4638A1");
        console.log("");
        console.log("New Transaction:");
        console.log("  To:    ", REGISTRY_PROXY);
        console.log("  Value:  0");
        console.log("  Data:  upgradeToAndCall(address,bytes)");
        console.log("  Impl:  ", address(newImpl));
        console.log("  Data:   0x (no initializer)");
        console.log("");

        // Encode the upgradeToAndCall calldata for the Safe
        bytes memory upgradeCalldata = abi.encodeWithSignature(
            "upgradeToAndCall(address,bytes)",
            address(newImpl),
            bytes("")
        );
        console.log("Full calldata for Safe:");
        console.logBytes(upgradeCalldata);
    }
}
