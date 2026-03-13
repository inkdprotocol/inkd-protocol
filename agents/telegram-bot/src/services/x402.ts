/**
 * x402 payment client — uses @x402/fetch + viem for proper payment flow
 */
import { createWalletClient, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { decryptPrivateKey } from './wallet.js'

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

export async function uploadToArweave(
  data: Buffer,
  contentType: string,
  filename: string
): Promise<UploadResponse> {
  const res = await fetch(`${API_URL}/v1/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: data.toString('base64'),
      contentType,
      filename,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload to Arweave failed ${res.status}: ${text}`)
  }

  return res.json() as Promise<UploadResponse>
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
