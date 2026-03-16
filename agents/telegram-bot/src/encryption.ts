import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

function deriveKey(privateKey: string): Buffer {
  return createHash("sha256")
    .update(privateKey + "inkd-private-v1")
    .digest()
}

export function encryptContent(data: Buffer, privateKey: string): Buffer {
  const key = deriveKey(privateKey)
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: [4 bytes: iv length][iv][4 bytes: tag length][tag][ciphertext]
  const ivLen = Buffer.alloc(4); ivLen.writeUInt32BE(iv.length, 0)
  const tagLen = Buffer.alloc(4); tagLen.writeUInt32BE(tag.length, 0)
  return Buffer.concat([ivLen, iv, tagLen, tag, encrypted])
}

export function decryptContent(data: Buffer, privateKey: string): Buffer {
  const key = deriveKey(privateKey)
  let offset = 0
  const ivLen = data.readUInt32BE(offset); offset += 4
  const iv = data.subarray(offset, offset + ivLen); offset += ivLen
  const tagLen = data.readUInt32BE(offset); offset += 4
  const tag = data.subarray(offset, offset + tagLen); offset += tagLen
  const ciphertext = data.subarray(offset)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
