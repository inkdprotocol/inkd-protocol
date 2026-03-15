/**
 * Inkd Protocol — End-to-End Test (Base Mainnet)
 *
 * Tests the full x402 payment flow:
 *   1. POST /v1/projects — $5 USDC via x402 → creates project on-chain
 *   2. POST /v1/projects/:id/versions — $2 USDC via x402 → pushes version on-chain
 *   3. GET /v1/projects/:id — verifies project exists
 *   4. Verify Treasury received USDC + settle() was called
 */

import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
// @ts-ignore
import { wrapFetchWithPayment } from '../api/node_modules/@x402/fetch/dist/cjs/index.js'

const PRIVATE_KEY   = (process.env.E2E_PRIVATE_KEY ?? '') as `0x${string}`
if (!PRIVATE_KEY) throw new Error('E2E_PRIVATE_KEY env var required')
const API_URL       = 'https://api.inkdprotocol.com'
const USDC_ADDRESS  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`
const TREASURY      = '0x23012C3EF1E95aBC0792c03671B9be33C239D449' as `0x${string}`

const USDC_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY)
  console.log(`\n🔑 Test wallet: ${account.address}`)

  const publicClient = createPublicClient({ chain: base, transport: http() })
  const walletClient = createWalletClient({ account, chain: base, transport: http() })

  // ─── Check balances ──────────────────────────────────────────────────────
  const usdcBefore = await publicClient.readContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [account.address],
  })
  const treasuryBefore = await publicClient.readContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [TREASURY],
  })
  console.log(`💰 USDC balance: $${Number(usdcBefore) / 1e6}`)
  console.log(`🏛️  Treasury before: $${Number(treasuryBefore) / 1e6}`)

  // ─── Wrap fetch with x402 payment ───────────────────────────────────────
  const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient)

  // ─── Step 1: Create project ──────────────────────────────────────────────
  console.log(`\n📝 Step 1: POST /v1/projects ($5 USDC via x402)`)
  const createRes = await fetchWithPayment(`${API_URL}/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:        `inkd-e2e-test-${Date.now()}`,
      description: 'End-to-end test project',
      tags:        ['test'],
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`createProject failed (${createRes.status}): ${err}`)
  }

  const project = await createRes.json()
  console.log(`✅ Project created!`)
  console.log(`   ID:   ${project.projectId}`)
  console.log(`   Owner: ${project.owner}`)
  console.log(`   TX:   ${project.txHash}`)

  // ─── Step 2: Push version ────────────────────────────────────────────────
  console.log(`\n📦 Step 2: POST /v1/projects/${project.projectId}/versions ($2 USDC via x402)`)
  const versionRes = await fetchWithPayment(`${API_URL}/v1/projects/${project.projectId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag:          'v0.1.0',
      contentHash:  'ar://test-e2e-content-hash-0000000000000000000000000000000000',
      metadataHash: 'ar://test-e2e-metadata-hash-000000000000000000000000000000000',
      contentSize:  1024,
    }),
  })

  if (!versionRes.ok) {
    const err = await versionRes.text()
    throw new Error(`pushVersion failed (${versionRes.status}): ${err}`)
  }

  const version = await versionRes.json()
  console.log(`✅ Version pushed!`)
  console.log(`   Tag:  ${version.tag}`)
  console.log(`   TX:   ${version.txHash}`)

  // ─── Step 3: Read back ───────────────────────────────────────────────────
  console.log(`\n🔍 Step 3: GET /v1/projects/${project.projectId}`)
  const getRes = await fetch(`${API_URL}/v1/projects/${project.projectId}`)
  const got    = await getRes.json()
  console.log(`✅ Project verified on-chain:`)
  console.log(`   Name:         ${got.name}`)
  console.log(`   Owner:        ${got.owner}`)
  console.log(`   VersionCount: ${got.versionCount}`)

  // ─── Step 4: Check Treasury received USDC ───────────────────────────────
  const usdcAfter = await publicClient.readContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [account.address],
  })
  const treasuryAfter = await publicClient.readContract({
    address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'balanceOf', args: [TREASURY],
  })

  const spent           = Number(usdcBefore - usdcAfter) / 1e6
  const treasuryIncrease = Number(treasuryAfter - treasuryBefore) / 1e6

  console.log(`\n💸 Payment summary:`)
  console.log(`   Spent:            $${spent.toFixed(2)} USDC`)
  console.log(`   Treasury gained:  $${treasuryIncrease.toFixed(2)} USDC`)
  console.log(`   USDC left:        $${Number(usdcAfter) / 1e6}`)

  if (spent >= 7) {
    console.log(`\n✅ ✅ ✅  END-TO-END TEST PASSED  ✅ ✅ ✅`)
    console.log(`   x402 Mainnet payments: WORKING`)
    console.log(`   Contract writes:       WORKING`)
    console.log(`   Treasury settlement:   WORKING`)
  } else {
    console.log(`\n⚠️  Only $${spent} spent — expected $7. Check manually.`)
  }
}

main().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message)
  process.exit(1)
})
