/**
 * x402 payment client — uses @x402/fetch + viem for proper payment flow
 */
import { createWalletClient, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { decryptPrivateKey } from './wallet.js'
import { encryptContent } from '../encryption.js'

const { wrapFetchWithPayment, x402Client } = require('@x402/fetch') as {
  wrapFetchWithPayment: (f: typeof fetch, c: unknown) => typeof fetch
  x402Client: new () => { register: (network: string, scheme: unknown) => unknown }
}
const { ExactEvmScheme } = require('@x402/evm') as {
  ExactEvmScheme: new (signer: unknown) => unknown
}

const API_URL = process.env.INKD_API_URL ?? 'https://api.inkdprotocol.com'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateProjectResponse {
  projectId: string
  txHash: string
  owner: string
  status: string
  blockNumber: string
}

export interface PushVersionResponse {
  txHash: string
  projectId: string
  versionTag: string
  arweaveHash: string
  agentAddress?: string
  pusher?: string
  status: string
  blockNumber: string
}

export interface UploadResponse {
  hash: string
  txId: string
  url: string
  bytes: number
  encrypted: boolean
}

// ─── Payment-aware fetch builder ──────────────────────────────────────────────

function buildPayFetch(encryptedKey: string): typeof fetch {
  const privateKey = decryptPrivateKey(encryptedKey)
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  })
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  })

  // Build signer with .address at top level (required by @x402/evm)
  const signer = {
    address: account.address,
    signTypedData: (msg: Parameters<typeof walletClient.signTypedData>[0]) =>
      walletClient.signTypedData({ ...msg, account } as Parameters<typeof walletClient.signTypedData>[0]),
    readContract: publicClient.readContract.bind(publicClient),
  }

  const networkId = 'eip155:8453' // Base mainnet
  const client = new x402Client().register(networkId, new ExactEvmScheme(signer))
  return wrapFetchWithPayment(fetch, client)
}

// ─── Upload to Arweave (free endpoint, no payment) ────────────────────────────

const API_SIZE_LIMIT = 3 * 1024 * 1024 // 3 MB — stay under Vercel's 4.5 MB limit (base64 overhead ~33%)
const TURBO_PAYMENT_URL = 'https://payment.ardrive.io/v1'
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const TURBO_DEPOSIT = '0x6A0A10FFD285c971B841bee8892878c0d583Bf67'

export async function uploadToArweave(
  data: Buffer,
  contentType: string,
  filename: string,
  privateKey?: string
): Promise<UploadResponse> {
  const payload = privateKey ? encryptContent(data, privateKey) : data
  const encrypted = !!privateKey

  // For large files, upload directly via Turbo instead of through the API (Vercel 4.5MB limit)
  if (payload.length > API_SIZE_LIMIT) {
    return uploadViaTurbo(payload, contentType, filename, encrypted)
  }

  const res = await fetch(`${API_URL}/v1/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: payload.toString('base64'),
      contentType,
      filename,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    // Fallback to direct Turbo on API error
    if (res.status === 413) {
      return uploadViaTurbo(payload, contentType, filename, encrypted)
    }
    throw new Error(`Upload to Arweave failed ${res.status}: ${text}`)
  }

  const result = await res.json() as UploadResponse
  return { ...result, encrypted }
}

/**
 * Upload large files directly via ArDrive Turbo.
 * Uses USDC on Base for payment — automatically tops up if needed.
 */
async function uploadViaTurbo(
  data: Buffer,
  contentType: string,
  filename: string,
  encrypted = false
): Promise<UploadResponse> {
  const serverKey = process.env.BOT_SERVER_WALLET_KEY
  if (!serverKey) throw new Error('BOT_SERVER_WALLET_KEY not set — cannot upload large files')

  // @ts-ignore - moduleResolution
  const { TurboFactory, EthereumSigner } = await import('@ardrive/turbo-sdk/node')
  const { Readable } = await import('stream')
  
  const signer = new EthereumSigner(serverKey)
  const turbo = TurboFactory.authenticated({ signer })

  // Check winc balance and top up if needed
  const { winc } = await turbo.getBalance()
  const [cost] = await turbo.getUploadCosts({ bytes: [data.length] })
  
  if (BigInt(winc) < BigInt(cost.winc)) {
    // Need to top up — send $1 USDC to Turbo and credit it
    await topUpTurboWithUsdc(serverKey, 1_000_000n) // 1 USDC
  }

  const tags = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name', value: 'inkd-protocol' },
    { name: 'File-Name', value: filename },
  ]

  const result = await turbo.uploadFile({
    fileStreamFactory: () => Readable.from(data),
    fileSizeFactory: () => data.length,
    dataItemOpts: { tags },
  })
  
  const txId = result.id
  return {
    hash: txId,
    txId,
    url: `https://arweave.net/${txId}`,
    bytes: data.length,
    encrypted,
  }
}

/**
 * Top up Turbo balance by sending USDC on Base and crediting the TX
 */
async function topUpTurboWithUsdc(privateKey: string, amount: bigint): Promise<void> {
  const { ethers } = await import('ethers')
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL ?? 'https://base.llamarpc.com')
  const wallet = new ethers.Wallet(privateKey, provider)
  
  const usdc = new ethers.Contract(
    USDC_BASE,
    ['function transfer(address,uint256) returns (bool)'],
    wallet
  )
  
  // Send USDC to Turbo deposit address
  const tx = await usdc.transfer(TURBO_DEPOSIT, amount)
  await tx.wait()
  
  // Credit the transaction at Turbo
  const creditRes = await fetch(`${TURBO_PAYMENT_URL}/account/balance/base-usdc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx_id: tx.hash }),
  })
  
  if (!creditRes.ok) {
    const text = await creditRes.text()
    throw new Error(`Failed to credit Turbo: ${text}`)
  }
}

// ─── Create project with x402 payment ─────────────────────────────────────────

export async function createProject(
  encryptedKey: string,
  body: { name: string; description?: string; license?: string }
): Promise<CreateProjectResponse> {
  const fetchPay = buildPayFetch(encryptedKey)

  const res = await fetchPay(`${API_URL}/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      description: body.description ?? '',
      license: body.license ?? 'MIT',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Create project failed ${res.status}: ${text}`)
  }

  return res.json() as Promise<CreateProjectResponse>
}

// ─── Push version with x402 payment ───────────────────────────────────────────

export async function pushVersion(
  encryptedKey: string,
  projectId: string | number,
  body: {
    arweaveHash: string
    versionTag: string
    changelog?: string
    contentSize?: number
  }
): Promise<PushVersionResponse> {
  const fetchPay = buildPayFetch(encryptedKey)

  const res = await fetchPay(`${API_URL}/v1/projects/${projectId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      arweaveHash: body.arweaveHash,
      versionTag: body.versionTag,
      changelog: body.changelog ?? '',
      contentSize: body.contentSize ?? 0,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Push version failed ${res.status}: ${text}`)
  }

  return res.json() as Promise<PushVersionResponse>
}

// ─── Create project with auto-retry on NameTaken ──────────────────────────────

export async function createProjectAutoName(
  encryptedKey: string,
  body: { name: string; description?: string; license?: string }
): Promise<CreateProjectResponse & { finalName: string }> {
  const baseName = body.name.slice(0, 60) // leave room for suffix
  
  for (let attempt = 0; attempt < 10; attempt++) {
    const name = attempt === 0 ? baseName : `${baseName}-${attempt + 1}`
    try {
      const result = await createProject(encryptedKey, { ...body, name })
      return { ...result, finalName: name }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNameTaken = msg.includes('NAME_TAKEN') || msg.includes('NameTaken') || msg.includes('0x9e4b2685')
      if (!isNameTaken) throw err
      // name taken — try next suffix
    }
  }
  throw new Error('Could not find available project name after 10 attempts')
}
