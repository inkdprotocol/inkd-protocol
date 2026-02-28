// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/// @title  KernlVault
/// @notice The ownership layer for AI Agents.
///         Every file, code snippet, or piece of knowledge is a token.
///         Own the token = own the data. Transfer = handover. Burn = delete.
contract KernlVault is
    ERC1155Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ─── State ───────────────────────────────────────────────────────────────

    uint256 public nextTokenId;
    uint256 public protocolFeeBps;    // default 100 = 1%
    uint256 public protocolFeeBalance;

    struct DataToken {
        address creator;
        string  arweaveHash;   // Arweave TX id of encrypted payload
        string  metadataURI;   // name, description, type, size
        uint256 price;         // 0 = not for sale
        uint256 createdAt;
    }

    mapping(uint256 => DataToken) public tokens;

    // ─── Events ──────────────────────────────────────────────────────────────

    event DataMinted(uint256 indexed tokenId, address indexed creator, string arweaveHash, uint256 price);
    event DataPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event DataBurned(uint256 indexed tokenId, address indexed burner);

    // ─── Init ────────────────────────────────────────────────────────────────

    function initialize(address _owner) public initializer {
        __ERC1155_init("");
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        protocolFeeBps = 100;
    }

    // ─── Core ────────────────────────────────────────────────────────────────

    /// @notice Mint a new data token — file, code, memory, anything
    function mint(
        string calldata arweaveHash,
        string calldata metadataURI,
        uint256 price
    ) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        tokens[tokenId] = DataToken({
            creator:     msg.sender,
            arweaveHash: arweaveHash,
            metadataURI: metadataURI,
            price:       price,
            createdAt:   block.timestamp
        });
        _mint(msg.sender, tokenId, 1, "");
        emit DataMinted(tokenId, msg.sender, arweaveHash, price);
    }

    /// @notice Buy a token from its current owner
    function purchase(uint256 tokenId, address seller) external payable nonReentrant {
        DataToken memory dt = tokens[tokenId];
        require(dt.price > 0, "Not for sale");
        require(msg.value >= dt.price, "Insufficient payment");
        require(balanceOf(seller, tokenId) >= 1, "Seller has no token");

        uint256 fee    = (msg.value * protocolFeeBps) / 10_000;
        uint256 payout = msg.value - fee;

        protocolFeeBalance += fee;
        _safeTransferFrom(seller, msg.sender, tokenId, 1, "");
        payable(seller).transfer(payout);

        emit DataPurchased(tokenId, msg.sender, seller, msg.value);
    }

    /// @notice Update listing price — 0 to delist
    function setPrice(uint256 tokenId, uint256 price) external {
        require(balanceOf(msg.sender, tokenId) >= 1, "Not owner");
        tokens[tokenId].price = price;
        emit PriceUpdated(tokenId, price);
    }

    /// @notice Burn — revokes access, data becomes unreachable
    function burn(uint256 tokenId) external {
        require(balanceOf(msg.sender, tokenId) >= 1, "Not owner");
        _burn(msg.sender, tokenId, 1);
        emit DataBurned(tokenId, msg.sender);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setProtocolFee(uint256 bps) external onlyOwner {
        require(bps <= 500, "Max 5%");
        protocolFeeBps = bps;
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = protocolFeeBalance;
        protocolFeeBalance = 0;
        payable(owner()).transfer(amount);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function uri(uint256 tokenId) public view override returns (string memory) {
        return tokens[tokenId].metadataURI;
    }
}
