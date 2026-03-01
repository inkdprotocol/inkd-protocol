// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  Deploy — InkdVault deployment script
 * @notice Deploys the InkdVault implementation and UUPS proxy to Base Sepolia or Mainnet.
 *
 *         Usage:
 *           forge script script/Deploy.s.sol:Deploy \
 *             --rpc-url base_sepolia \
 *             --broadcast \
 *             --verify \
 *             -vvvv
 */

import "forge-std/Script.sol";
import "../src/InkdVault.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);

        vm.startBroadcast(deployerKey);

        // 1. Deploy implementation
        InkdVault implementation = new InkdVault();
        console.log("Implementation:", address(implementation));

        // 2. Deploy proxy, initializing with deployer as owner
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(InkdVault.initialize, (deployer))
        );
        console.log("Proxy (InkdVault):", address(proxy));

        // 3. Verify initialization
        InkdVault vault = InkdVault(address(proxy));
        require(vault.owner() == deployer, "Owner mismatch");
        require(vault.protocolFeeBps() == 100, "Fee mismatch");

        console.log("Protocol fee:", vault.protocolFeeBps(), "bps");
        console.log("Deployment complete.");

        vm.stopBroadcast();
    }
}
