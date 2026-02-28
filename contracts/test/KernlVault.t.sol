// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/KernlVault.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract KernlVaultTest is Test {
    KernlVault vault;
    address owner   = address(0xA);
    address agent1  = address(0xB);
    address agent2  = address(0xC);

    function setUp() public {
        KernlVault impl = new KernlVault();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(KernlVault.initialize, (owner))
        );
        vault = KernlVault(address(proxy));
        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);
    }

    function test_mint() public {
        vm.prank(agent1);
        uint256 id = vault.mint("arweave-hash-abc", "ipfs://meta", 1 ether);
        assertEq(vault.balanceOf(agent1, id), 1);
    }

    function test_purchase() public {
        vm.prank(agent1);
        uint256 id = vault.mint("arweave-hash-abc", "ipfs://meta", 1 ether);

        // agent1 must approve vault to transfer on sale
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);

        uint256 sellerBefore = agent1.balance;

        vm.prank(agent2);
        vault.purchase{value: 1 ether}(id, agent1);

        assertEq(vault.balanceOf(agent2, id), 1);
        assertEq(vault.balanceOf(agent1, id), 0);

        // seller receives 99% (1% protocol fee)
        assertEq(agent1.balance, sellerBefore + 0.99 ether);
        assertEq(vault.protocolFeeBalance(), 0.01 ether);
    }

    function test_burn() public {
        vm.prank(agent1);
        uint256 id = vault.mint("arweave-hash-abc", "ipfs://meta", 0);
        vm.prank(agent1);
        vault.burn(id);
        assertEq(vault.balanceOf(agent1, id), 0);
    }

    function test_setPrice() public {
        vm.prank(agent1);
        uint256 id = vault.mint("arweave-hash-abc", "ipfs://meta", 0);
        vm.prank(agent1);
        vault.setPrice(id, 2 ether);
        (,,,uint256 price,) = vault.tokens(id);
        assertEq(price, 2 ether);
    }

    function test_withdrawFees() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);
        vm.prank(agent2);
        vault.purchase{value: 1 ether}(id, agent1);

        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        vault.withdrawFees();
        assertEq(owner.balance, ownerBefore + 0.01 ether);
    }
}
