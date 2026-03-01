/**
 * @file abi.ts
 * @description InkdVault contract ABI for viem interaction.
 */

export const INKD_VAULT_ABI = [
  // ─── Read Functions ─────────────────────────────────────────────────────
  {
    type: "function",
    name: "tokens",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "arweaveHash", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "price", type: "uint256" },
      { name: "createdAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextTokenId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "protocolFeeBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "protocolFeeBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "uri",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVersionCount",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "count", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVersion",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "versionIndex", type: "uint256" },
    ],
    outputs: [{ name: "arweaveHash", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "checkAccess",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [{ name: "hasAccess", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "accessGrants",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [{ name: "expiresAt", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },

  // ─── Write Functions ────────────────────────────────────────────────────
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "arweaveHash", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "price", type: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "batchMint",
    inputs: [
      { name: "arweaveHashes", type: "string[]" },
      { name: "metadataURIs", type: "string[]" },
      { name: "prices", type: "uint256[]" },
    ],
    outputs: [{ name: "tokenIds", type: "uint256[]" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "purchase",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "seller", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "setPrice",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "burn",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addVersion",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newArweaveHash", type: "string" },
    ],
    outputs: [{ name: "versionIndex", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "grantAccess",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "wallet", type: "address" },
      { name: "expiresAt", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAccess",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ─── Events ─────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "DataMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "arweaveHash", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BatchMinted",
    inputs: [
      { name: "tokenIds", type: "uint256[]", indexed: false },
      { name: "creator", type: "address", indexed: true },
      { name: "count", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DataPurchased",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "protocolFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PriceUpdated",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "newPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DataBurned",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "burner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "VersionAdded",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "versionIndex", type: "uint256", indexed: false },
      { name: "newArweaveHash", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AccessGranted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "grantee", type: "address", indexed: true },
      { name: "expiresAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AccessRevoked",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "grantee", type: "address", indexed: true },
    ],
  },
] as const;
