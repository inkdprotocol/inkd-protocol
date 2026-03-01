/**
 * @file types.ts
 * @description Core TypeScript types for the Inkd Protocol SDK.
 */

// ─── On-Chain Types ─────────────────────────────────────────────────────────

/** On-chain data token as returned by the InkdVault contract. */
export interface DataToken {
  /** Unique on-chain token identifier. */
  tokenId: bigint;
  /** Address of the original minter. */
  creator: `0x${string}`;
  /** Current Arweave TX hash (latest version). */
  arweaveHash: string;
  /** Off-chain metadata URI (name, description, type, size). */
  metadataURI: string;
  /** Listing price in wei (0n = not for sale). */
  price: bigint;
  /** Unix timestamp of token creation. */
  createdAt: bigint;
}

/** Enriched token data including ownership and version info. */
export interface TokenData extends DataToken {
  /** Current owner address. */
  owner: `0x${string}`;
  /** Total number of versions. */
  versionCount: number;
  /** All Arweave hashes (version history, index 0 = original). */
  versions: string[];
}

/** Temporary access grant details. */
export interface AccessGrant {
  /** Token the grant applies to. */
  tokenId: bigint;
  /** Wallet granted temporary access. */
  grantee: `0x${string}`;
  /** Unix timestamp when access expires. */
  expiresAt: bigint;
}

// ─── Mint Options ───────────────────────────────────────────────────────────

/** Options for minting a single token. */
export interface MintOptions {
  /** Content type of the file (e.g., "application/json", "text/plain"). */
  contentType: string;
  /** Listing price in wei. Defaults to 0 (not for sale). */
  price?: bigint;
  /** Off-chain metadata URI. Auto-generated if not provided. */
  metadataURI?: string;
  /** Optional tags for Arweave upload. */
  tags?: Record<string, string>;
}

/** Options for minting multiple tokens at once. */
export interface BatchMintOptions {
  /** Content type applied to all files. */
  contentType: string;
  /** Listing prices per file. Must match files length. */
  prices?: bigint[];
  /** Metadata URIs per file. Must match files length. */
  metadataURIs?: string[];
}

// ─── Arweave Types ──────────────────────────────────────────────────────────

/** Result of an Arweave upload via Irys. */
export interface UploadResult {
  /** Arweave transaction hash. */
  hash: string;
  /** Full Arweave gateway URL. */
  url: string;
  /** Size of uploaded data in bytes. */
  size: number;
}

// ─── Client Config ──────────────────────────────────────────────────────────

/** Configuration for the InkdClient. */
export interface InkdClientConfig {
  /** InkdVault proxy contract address. */
  contractAddress: `0x${string}`;
  /** Chain ID (8453 = Base Mainnet, 84532 = Base Sepolia). */
  chainId: 8453 | 84532;
  /** Irys node URL for Arweave uploads. */
  irysUrl?: string;
  /** Arweave gateway URL for fetching data. */
  arweaveGateway?: string;
}

// ─── Transaction Types ──────────────────────────────────────────────────────

/** Result of a successful on-chain transaction. */
export interface TransactionResult {
  /** Transaction hash. */
  hash: `0x${string}`;
  /** Token ID (if applicable). */
  tokenId?: bigint;
}

/** Result of a batch mint transaction. */
export interface BatchTransactionResult {
  /** Transaction hash. */
  hash: `0x${string}`;
  /** Array of minted token IDs. */
  tokenIds: bigint[];
}

// ─── Encryption Types (V2 stub) ─────────────────────────────────────────────

/** Encryption configuration for Lit Protocol integration (V2). */
export interface EncryptionConfig {
  /** Lit Protocol network to use. */
  network: "cayenne" | "manzano" | "habanero";
  /** Chain for access control conditions. */
  chain: string;
}

/** Result of encrypting data via Lit Protocol. */
export interface EncryptedData {
  /** Encrypted data blob. */
  ciphertext: Uint8Array;
  /** Symmetric key encrypted by Lit nodes. */
  encryptedSymmetricKey: string;
  /** Access control conditions for decryption. */
  accessControlConditions: unknown[];
}
