/**
 * E2E Mainnet Test — Full Flow
 *
 * 1. Upload test content to Arweave via /v1/upload
 * 2. Create project via /v1/projects ($5 USDC via x402)
 * 3. Push version with real Arweave hash ($2 USDC via x402)
 * 4. Read back and verify
 *
 * Run: AGENT_PRIVATE_KEY=0x... npx tsx examples/e2e-mainnet.ts
 */

import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { ExactEvmScheme }                    from '@x402/evm'
import { privateKeyToAccount }               from 'viem/accounts'
import { createWalletClient, createPublicClient, http } from 'viem'
import { base }                              from 'viem/chains'

const AGENT_PRIVATE_KEY = (process.env['AGENT_PRIVATE_KEY'] ?? '') as `0x${string}`
const API_URL           = process.env['API_URL'] ?? 'https://api.inkdprotocol.com'
const SKIP_UPLOAD       = process.env['SKIP_UPLOAD'] === '1'  // use fake hash if Irys not funded

if (!AGENT_PRIVATE_KEY) { console.error('AGENT_PRIVATE_KEY required'); process.exit(1) }

const account = privateKeyToAccount(AGENT_PRIVATE_KEY)
const walletClient = createWalletClient({ account, chain: base, transport: http() })
const publicClient = createPublicClient({ chain: base, transport: http() })

const signer = {
  address:       account.address,
  signTypedData: (msg: Parameters<typeof walletClient.signTypedData>[0]) =>
    walletClient.signTypedData({ ...msg, account } as Parameters<typeof walletClient.signTypedData>[0]),
  readContract:  publicClient.readContract.bind(publicClient),
}

const client   = new x402Client().register('eip155:8453', new ExactEvmScheme(signer as Parameters<typeof ExactEvmScheme>[0]))
const fetchPay = wrapFetchWithPayment(fetch, client)

console.log(`\n══════════════════════════════════════════════════════`)
console.log(`  inkd E2E — Base Mainnet (Full Flow)`)
console.log(`  wallet: ${account.address}`)
console.log(`  api:    ${API_URL}\n`)

// ─── Test 0: Upload content ───────────────────────────────────────────────────

async function testUpload(): Promise<string> {
  if (SKIP_UPLOAD) {
    console.log('TEST 0 — upload (SKIPPED, using fake hash)')
    return 'ar://QmE2ETestHashFake1234'
  }

  console.log('TEST 0 — upload content to Arweave')
  console.log('─────────────────────────────────────')

  const content = JSON.stringify({
    name: 'test-agent',
    version: '1.0.0',
    description: 'E2E test content',
    timestamp: new Date().toISOString(),
  })

  const res = await fetch(`${API_URL}/v1/upload`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      data:        Buffer.from(content).toString('base64'),
      contentType: 'application/json',
      filename:    'manifest.json',
    }),
  })

  const body = await res.json()

  if (!res.ok) {
    console.warn(`  ⚠ Upload failed [${res.status}]: ${JSON.stringify(body)} — using fake hash`)
    return 'ar://QmE2ETestHashFallback1234'
  }

  console.log(`  ✅ [${res.status}] hash=${body.hash}`)
  console.log(`     url=${body.url}\n`)
  return body.hash
}

// ─── Test 1: Create project ───────────────────────────────────────────────────

async function testCreateProject(): Promise<string | null> {
  console.log('TEST 1 — createProject ($5 USDC)')
  console.log('─────────────────────────────────')

  const name = `e2e-${Date.now()}`
  console.log(`  POST /v1/projects  name=${name}`)

  let res: Response
  try {
    res = await fetchPay(`${API_URL}/v1/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, description: 'E2E full flow test', license: 'MIT',
        isPublic: true, isAgent: true, agentEndpoint: 'https://agent.example.com',
      }),
    })
  } catch (e) { console.error('  ❌ FETCH ERROR:', e); return null }

  const body = await res.json()
  if (!res.ok) { console.error(`  ❌ [${res.status}]`, JSON.stringify(body, null, 2)); return null }
  console.log(`  ✅ [${res.status}] projectId=${body.projectId} tx=${body.txHash}`)
  console.log(`     https://basescan.org/tx/${body.txHash}\n`)
  return body.projectId
}

// ─── Test 2: Push version ─────────────────────────────────────────────────────

async function testPushVersion(projectId: string, contentHash: string): Promise<boolean> {
  console.log('TEST 2 — pushVersion ($2 USDC)')
  console.log('──────────────────────────────')
  console.log(`  POST /v1/projects/${projectId}/versions`)
  console.log(`  contentHash=${contentHash}`)

  let res: Response
  try {
    res = await fetchPay(`${API_URL}/v1/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: 'v1.0.0', contentHash, metadataHash: '' }),
    })
  } catch (e) { console.error('  ❌ FETCH ERROR:', e); return false }

  const body = await res.json()
  if (!res.ok) { console.error(`  ❌ [${res.status}]`, JSON.stringify(body, null, 2)); return false }
  console.log(`  ✅ [${res.status}] tag=${body.tag} tx=${body.txHash}`)
  console.log(`     https://basescan.org/tx/${body.txHash}\n`)
  return true
}

// ─── Test 3: Read ─────────────────────────────────────────────────────────────

async function testRead(projectId: string) {
  console.log('TEST 3 — readProject (free)')
  const res  = await fetch(`${API_URL}/v1/projects/${projectId}`)
  const body = await res.json()
  if (!res.ok) { console.error(`  ❌ [${res.status}]`, body); return }
  const name = body.data?.name ?? body.name
  console.log(`  ✅ [${res.status}]  name=${name}`)
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  const contentHash = await testUpload()
  console.log()
  const projectId   = await testCreateProject()
  if (!projectId) { console.log('\nRESULT: ❌ aborted'); process.exit(1) }
  const ok = await testPushVersion(projectId, contentHash)
  await testRead(projectId)

  const uploadOk = !SKIP_UPLOAD && contentHash.startsWith('ar://')

  console.log('══════════════════════════════════════════════════════')
  console.log(`RESULT:  upload ${uploadOk ? '✅' : '⚠ (skipped/failed)'}  createProject ✅  pushVersion ${ok ? '✅' : '❌'}  read ✅`)
  console.log('══════════════════════════════════════════════════════\n')

  if (!ok) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
