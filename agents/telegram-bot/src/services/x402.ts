/**
 * x402 payment client — builds EIP-3009 transferWithAuthorization signatures
 */
import crypto from 'node:crypto'
import { Wallet, AbiCoder, keccak256 } from 'ethers'

const API_URL = process.env.INKD_API_URL ?? 'https://api.inkdprotocol.com'
const TREASURY_ADDRESS = process.env.INKD_TREASURY_ADDRESS ?? ''

// USDC on Base mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// EIP-712 domain for USDC (must match exactly)
const USDC_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453, // Base mainnet
  verifyingContract: USDC_ADDRESS,
}

// EIP-3009 transferWithAuthorization type
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
  Buffer.from('TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)')
)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentAuthorization {
  from: string
  to: string
  value: string
  validAfter: string
  validBefore: string
  nonce: string
}

export interface X402Payload {
  x402Version: number
  payload: {
    authorization: PaymentAuthorization
    signature: string
  }
}

export interface CreateProjectResponse {
  txHash: string
  projectId: string
  owner: string
  signer: string
  status: string
  blockNumber: string
}

export interface PushVersionResponse {
  txHash: string
  projectId: string
  versionTag: string
  arweaveHash: string
  agentAddress: string
  pusher: string
  status: string
  blockNumber: string
}

// ─── EIP-3009 Signature Building ──────────────────────────────────────────────

/**
 * Build EIP-712 domain separator for USDC
 */
function buildDomainSeparator(): string {
  const abiCoder = AbiCoder.defaultAbiCoder()
  const typeHash = keccak256(
    Buffer.from('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
  )
  return keccak256(
    abiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        typeHash,
        keccak256(Buffer.from(USDC_DOMAIN.name)),
        keccak256(Buffer.from(USDC_DOMAIN.version)),
        USDC_DOMAIN.chainId,
        USDC_DOMAIN.verifyingContract,
      ]
    )
  )
}

/**
 * Build the struct hash for transferWithAuthorization
 */
function buildStructHash(auth: PaymentAuthorization): string {
  const abiCoder = AbiCoder.defaultAbiCoder()
  return keccak256(
    abiCoder.encode(
      ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [
        TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
        auth.from,
        auth.to,
        auth.value,
        auth.validAfter,
        auth.validBefore,
        auth.nonce,
      ]
    )
  )
}

/**
 * Build the EIP-712 digest to sign
 */
function buildDigest(auth: PaymentAuthorization): string {
  const domainSeparator = buildDomainSeparator()
  const structHash = buildStructHash(auth)
  const abiCoder = AbiCoder.defaultAbiCoder()
  return keccak256(
    Buffer.concat([
      Buffer.from([0x19, 0x01]),
      Buffer.from(domainSeparator.slice(2), 'hex'),
      Buffer.from(structHash.slice(2), 'hex'),
    ])
  )
}

/**
 * Sign EIP-3009 transferWithAuthorization
 */
export async function signTransferAuthorization(
  wallet: Wallet,
  amount: bigint,
  treasuryAddress: string
): Promise<X402Payload> {
  const now = Math.floor(Date.now() / 1000)
  const nonce = '0x' + crypto.randomBytes(32).toString('hex')
  
  const auth: PaymentAuthorization = {
    from: wallet.address,
    to: treasuryAddress,
    value: amount.toString(),
    validAfter: '0',
    validBefore: (now + 3600).toString(), // 1 hour validity
    nonce,
  }
  
  const digest = buildDigest(auth)
  const signature = wallet.signingKey.sign(digest).serialized
  
  return {
    x402Version: 2,
    payload: {
      authorization: auth,
      signature,
    },
  }
}

/**
 * Build the x-payment header value
 */
export function buildPaymentHeader(payload: X402Payload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

// ─── API Calls with x402 ──────────────────────────────────────────────────────

/**
 * Create a project with x402 payment
 */
export async function createProjectWithPayment(
  wallet: Wallet,
  body: {
    name: string
    description?: string
    license?: string
  }
): Promise<CreateProjectResponse> {
  const treasuryAddress = TREASURY_ADDRESS
  if (!treasuryAddress) throw new Error('INKD_TREASURY_ADDRESS not set')
  
  // Create project costs $0.10 USDC = 100_000 (6 decimals)
  const amount = 100_000n
  
  const paymentPayload = await signTransferAuthorization(wallet, amount, treasuryAddress)
  const paymentHeader = buildPaymentHeader(paymentPayload)
  
  const res = await fetch(`${API_URL}/v1/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payment': paymentHeader,
    },
    body: JSON.stringify({
      name: body.name,
      description: body.description ?? '',
      license: body.license ?? 'MIT',
    }),
  })
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  
  return res.json() as Promise<CreateProjectResponse>
}

/**
 * Push a version with x402 payment
 */
export async function pushVersionWithPayment(
  wallet: Wallet,
  projectId: number,
  body: {
    arweaveHash: string
    versionTag: string
    changelog?: string
    contentSize: number
  }
): Promise<PushVersionResponse> {
  const treasuryAddress = TREASURY_ADDRESS
  if (!treasuryAddress) throw new Error('INKD_TREASURY_ADDRESS not set')
  
  // First get price estimate
  const { getUploadPriceEstimate } = await import('./api.js')
  const estimate = await getUploadPriceEstimate(body.contentSize)
  const amount = BigInt(estimate.total)
  
  const paymentPayload = await signTransferAuthorization(wallet, amount, treasuryAddress)
  const paymentHeader = buildPaymentHeader(paymentPayload)
  
  const res = await fetch(`${API_URL}/v1/projects/${projectId}/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payment': paymentHeader,
    },
    body: JSON.stringify({
      arweaveHash: body.arweaveHash,
      versionTag: body.versionTag,
      changelog: body.changelog ?? '',
      contentSize: body.contentSize,
    }),
  })
  
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  
  return res.json() as Promise<PushVersionResponse>
}
