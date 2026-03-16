/**
 * @file encryption.ts
 * @description AES-256-GCM content encryption for private Inkd uploads,
 *              plus Lit Protocol integration stub for token-gated encryption.
 *              V1 uses passthrough (no encryption). V2 will use Lit Protocol
 *              so only the InkdToken owner can decrypt inscribed data.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { EncryptionConfig, EncryptedData, Address } from "./types";
import { EncryptionError } from "./errors";

// ─── AES-256-GCM helpers (wallet-key based) ──────────────────────────────────

/**
 * Derive a 32-byte AES key from an EVM private key.
 * Format: sha256(privateKey + "inkd-private-v1")
 */
function deriveAesKey(privateKey: string): Buffer {
  return createHash("sha256")
    .update(privateKey + "inkd-private-v1")
    .digest();
}

/**
 * Encrypt content with AES-256-GCM using a wallet private key.
 * Wire format: [4B iv-len][iv][4B tag-len][tag][ciphertext]
 *
 * @param data - Raw content to encrypt
 * @param privateKey - EVM wallet private key (hex, with or without 0x prefix)
 * @returns Encrypted buffer ready for Arweave upload
 */
export function encryptForWallet(data: Buffer, privateKey: string): Buffer {
  const key = deriveAesKey(privateKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ivLen = Buffer.alloc(4);  ivLen.writeUInt32BE(iv.length, 0);
  const tagLen = Buffer.alloc(4); tagLen.writeUInt32BE(tag.length, 0);
  return Buffer.concat([ivLen, iv, tagLen, tag, encrypted]);
}

/**
 * Decrypt content encrypted by `encryptForWallet`.
 *
 * @param data - Encrypted buffer from Arweave
 * @param privateKey - EVM wallet private key
 * @returns Decrypted content buffer
 */
export function decryptForWallet(data: Buffer, privateKey: string): Buffer {
  const key = deriveAesKey(privateKey);
  let offset = 0;
  const ivLen = data.readUInt32BE(offset); offset += 4;
  const iv = data.subarray(offset, offset + ivLen); offset += ivLen;
  const tagLen = data.readUInt32BE(offset); offset += 4;
  const tag = data.subarray(offset, offset + tagLen); offset += tagLen;
  const ciphertext = data.subarray(offset);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encryption provider interface.
 * V1 uses passthrough. V2 will use Lit Protocol.
 */
export interface IEncryptionProvider {
  /** Encrypt data before upload. */
  encrypt(data: Uint8Array, tokenId: bigint, contractAddress: Address): Promise<EncryptedData>;

  /** Decrypt data after download. Only works if caller holds the token. */
  decrypt(encryptedData: EncryptedData, tokenId: bigint, contractAddress: Address): Promise<Uint8Array>;
}

/**
 * V1 passthrough encryption — data is stored unencrypted.
 * Swappable with LitEncryptionProvider in V2.
 */
export class PassthroughEncryption implements IEncryptionProvider {
  async encrypt(data: Uint8Array, _tokenId: bigint, _contractAddress: Address): Promise<EncryptedData> {
    return {
      ciphertext: data,
      encryptedSymmetricKey: "",
      accessControlConditions: [],
    };
  }

  async decrypt(encryptedData: EncryptedData, _tokenId: bigint, _contractAddress: Address): Promise<Uint8Array> {
    return encryptedData.ciphertext;
  }
}

/**
 * Lit Protocol encryption provider (V2).
 * Encrypts data so only the ERC-721 InkdToken owner can decrypt it.
 *
 * @example
 * ```ts
 * const encryption = new LitEncryptionProvider({ network: "datil", chain: "base" });
 * await encryption.connect();
 *
 * const encrypted = await encryption.encryptForToken(data, tokenId);
 * const decrypted = await encryption.decryptWithToken(encrypted, tokenId);
 * ```
 */
export class LitEncryptionProvider implements IEncryptionProvider {
  private config: EncryptionConfig;
  private connected = false;

  constructor(config: EncryptionConfig) {
    this.config = config;
  }

  /** Connect to the Lit Protocol network. */
  async connect(): Promise<void> {
    // V2: Initialize LitNodeClient
    // const client = new LitNodeClient({ litNetwork: this.config.network });
    // await client.connect();
    throw new EncryptionError(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }

  /** Encrypt data for a specific InkdToken. Only the token owner can decrypt. */
  async encryptForToken(data: Uint8Array, tokenId: bigint, contractAddress?: Address): Promise<EncryptedData> {
    return this.encrypt(data, tokenId, contractAddress ?? ("0x0" as Address));
  }

  /** Decrypt data using InkdToken ownership proof. */
  async decryptWithToken(encryptedData: EncryptedData, tokenId: bigint, contractAddress?: Address): Promise<Uint8Array> {
    return this.decrypt(encryptedData, tokenId, contractAddress ?? ("0x0" as Address));
  }

  async encrypt(_data: Uint8Array, _tokenId: bigint, _contractAddress: Address): Promise<EncryptedData> {
    // V2: Build ERC-721 access control conditions
    // const accessControlConditions = [{
    //   contractAddress,
    //   standardContractType: "ERC721",
    //   chain: this.config.chain,
    //   method: "ownerOf",
    //   parameters: [tokenId.toString()],
    //   returnValueTest: { comparator: "=", value: ":userAddress" },
    // }];
    throw new EncryptionError(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }

  async decrypt(_encryptedData: EncryptedData, _tokenId: bigint, _contractAddress: Address): Promise<Uint8Array> {
    throw new EncryptionError(
      "LitEncryptionProvider is a V2 feature. Use PassthroughEncryption for V1."
    );
  }
}
